// ---------- game.js : core loop & state machine ----------
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = new UI();
    this.state = 'menu'; // menu | playing | paused | shop | gameover
    this.mode = 'solo';  // solo | host | guest (LAN co-op)
    this.gameMode = 'standard'; // 'standard' | 'horror'
    this.cam = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    this.time = 0; this.dt = 0;
    this.shakeAmt = 0;
    this.damageVignette = 0;
    this.hpMult = 1; this.dmgMult = 1;
    this.player2 = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.cam.w = this.canvas.width; this.cam.h = this.canvas.height;
  }

  // all active players (1 in solo, 2 in co-op)
  get players() { return this.player2 ? [this.player, this.player2] : [this.player]; }
  // the player whose stats/HUD belong to THIS browser tab
  get localPlayer() { return this.mode === 'guest' ? this.player2 : this.player; }

  nearestPlayer(x, y) {
    let best = this.player, bestD = Infinity;
    for (const p of this.players) {
      const d = Utils.dist(x, y, p.x, p.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  // mode: 'solo' (default) | 'host' | 'guest' — coop games always run 2 player slots
  newGame(mode, gameMode, mapIndex) {
    this.mode = mode || 'solo';
    this.gameMode = gameMode || 'standard';
    // Always start with Map 0 (Hangar) for wave 1!
    this.world = new World(mapIndex !== undefined ? mapIndex : 0);
    this.workbench = new Workbench(this.world.workbenchPos.x, this.world.workbenchPos.y);
    this.nearWorkbench = false;
    this.workbenchOpenLocal = false;
    this.shopTable = new ShopTable(120, 300);
    this.nearShop = false;
    this.trainingRange = new TrainingRange(120, 640);
    this.nearTrainingRange = false;
    this.trainingOpenLocal = false;
    this.inventoryOpenLocal = false;
    this._snapshotTimer = 0;
    const spawn = { x: this.world.w / 2, y: this.world.h / 2 - 180 };
    this.player = new Player(spawn.x - 20, spawn.y);
    this.player2 = this.mode !== 'solo' ? new Player(spawn.x + 20, spawn.y, this.mode === 'host') : null;
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.enemies = [];
    this.boss = null;
    this.coins = [];
    this.medkits = [];
    this.shields = [];
    this.lightningArcs = [];
    this.particles = new Particles();
    this.waves = new WaveManager(this);
    this.playTime = 0;
    const target = this.localPlayer || this.player;
    this.cam.x = target.x - this.cam.w / 2;
    this.cam.y = target.y - this.cam.h / 2;
    this.state = 'playing';
    this.midWaveShop = false;
    // per-client shop state (co-op: each player shops independently)
    this.shopOpenLocal = false;
    this.shopUpgradeIds = [];
    this.hostShopDone = false;
    this.guestShopDone = false;
    this._syncState = 'playing';
    this.ui.showHUD(true);
    if (this.mode !== 'guest') this.waves.startWave(1);
  }

  shake(a) { this.shakeAmt = Math.min(this.shakeAmt + a, 22); }

  // ----- events -----
  onEnemyKilled(e) {
    const killer = e.lastHitBy || this.player;
    killer.kills++;
    killer.score += e.def.score;
    Audio2.enemyDie();
    this.particles.burst(e.x, e.y, e.color, 12, 200);
    this.dropCoins(e.x, e.y, e.def.coins, killer);
    if (Utils.chance(killer.mods.lifesteal)) killer.heal(5);
    // chance to drop a medkit — likelier when the killer is hurt
    const hurt = 1 - killer.hp / killer.maxHp;
    if (Utils.chance(0.05 + hurt * 0.11)) this.dropMedkit(e.x, e.y, 25);
    // chance to drop a shield battery
    const shieldHurt = 1 - (killer.shieldHp || 0) / (killer.maxShieldHp || 100);
    if (Utils.chance(0.05 + shieldHurt * 0.11)) this.dropShield(e.x, e.y);
  }

  onBossKilled(b) {
    const killer = b.lastHitBy || this.player;
    killer.kills++;
    killer.score += b.score;
    Audio2.explosion();
    this.shake(20);
    this.particles.burst(b.x, b.y, '#ff3b52', 60, 340);
    this.particles.burst(b.x, b.y, '#ffcc33', 30, 260);
    this.dropCoins(b.x, b.y, b.coins, killer);
    // bosses always drop medkits and shields
    for (let i = 0; i < 2; i++) this.dropMedkit(b.x, b.y, 40);
    for (let i = 0; i < 2; i++) this.dropShield(b.x, b.y);
  }

  dropCoins(x, y, range, killer) {
    let n = Utils.randInt(range[0], range[1]);
    n = Math.round(n * (killer ? killer.mods.coinMult : 1));
    for (let i = 0; i < n; i++) {
      this.coins.push(new Coin(x + Utils.rand(-20, 20), y + Utils.rand(-20, 20), 1));
    }
  }

  dropMedkit(x, y, heal) {
    this.medkits.push(new Medkit(x + Utils.rand(-16, 16), y + Utils.rand(-16, 16), heal));
  }

  dropShield(x, y) {
    this.shields.push(new ShieldPickup(x + Utils.rand(-16, 16), y + Utils.rand(-16, 16)));
  }
  onPlayerDeath() {
    // co-op: only end the run once both players are down
    if (this.players.some((p) => p.hp > 0)) return;
    this.state = 'gameover';
    this.ui.showHUD(false);
    const mins = Math.floor(this.playTime / 60), secs = Math.floor(this.playTime % 60);
    const p = this.localPlayer;
    this.ui.showGameOver({
      wave: this.waves.wave, kills: p.kills, score: p.score,
      coins: p.coins, time: mins + ':' + String(secs).padStart(2, '0'),
    });
    Menus.show('gameover-menu');
  }

  // ----- wave lifecycle -----
  endWave() {
    if (!this.waves.active) return;
    this.waves.active = false;

    // auto-collect remaining coins for the whole squad
    for (const c of this.coins) { this.player.coins += c.value; }
    this.coins = [];
    this.medkits = [];
    this.shields = [];
    this.boss = null;
    
    // Switch map alternates between waves
    const mapIndex = (this.waves.wave) % 2; // (current wave is about to increment)
    if (this.world.layoutIndex !== mapIndex) {
      this.world = new World(mapIndex);
      // Reset players to spawning location to prevent getting stuck in walls
      const spawn = { x: this.world.w / 2, y: this.world.h / 2 - 180 };
      if (this.player) {
        this.player.x = spawn.x - 20;
        this.player.y = spawn.y;
      }
      if (this.player2) {
        this.player2.x = spawn.x + 20;
        this.player2.y = spawn.y;
      }
    }
    
    this.ui.showBanner('WELLE ERLEDIGT');
    
    // Roll new upgrades for the Trainingsrange terminal pool
    this.shopUpgrades = rollShopUpgrades(this.gameMode);
    this.shopUpgradeIds = this.shopUpgrades.map((u) => u.id);

    // Briefly wait and start next wave automatically (after 4s)
    setTimeout(() => {
      if (this.state === 'playing' || this.state === 'upgrade' || this.state === 'shop') {
        this.state = 'playing';
        this.ui.showHUD(true);
        this.waves.startWave(this.waves.wave + 1);
      }
    }, 4000);
  }

  // enter the per-client free-upgrade → shop flow (host and guest both call this)
  beginLocalIntermission() {
    this.midWaveShop = false;
    this.shopOpenLocal = true;
    this.ui.showHUD(false);
    this.ui.showUpgradeChoices(this);
    Menus.show('upgrade-menu');
  }

  openTacticalShop() {
    this.state = 'shop';
    this.ui.showHUD(false);
    this.ui.showTacticalShop(this);
    Menus.show('shop-menu');
  }

  // ----- shop interactions (used by the UI, work for solo + co-op) -----
  chooseUpgrade(up) {
    up.apply(this.localPlayer);
    if (this.mode === 'guest') Net.sendShopAction({ action: 'upgrade', id: up.id });
    Audio2.buy();
    Menus.hideAll();
    if (this.mode === 'solo') { this.openTacticalShop(); }
    else { this.ui.showTacticalShop(this); Menus.show('shop-menu'); }
  }

  purchase(kind, key, price) {
    const me = this.localPlayer;
    if (me.coins < price) return false;
    me.coins -= price;
    this.applyPurchase(me, kind, key);
    if (this.mode === 'guest') Net.sendShopAction({ action: 'buy', kind, key, price });
    Audio2.buy();
    return true;
  }

  applyPurchase(p, kind, key) {
    if (kind === 'weapon') p.unlock(key);
    else if (kind === 'ammo') {
      for (const k in p.weapons) if (p.weapons[k].unlocked) p.weapons[k].ammo = Math.round(WEAPON_DEFS[k].mag * p.mods.mag);
    } else if (kind === 'medkit') p.medkitsCount++;
    else if (kind === 'shield') p.shieldsCount++;
    else if (kind === 'bread') p.breadCount++;
    else if (kind === 'novacola') p.novacolaCount++;
  }

  leaveShop() {
    if (this.mode === 'solo') {
      this.closeShop();
    } else {
      this.hostShopDone = true;
      this.ui.showShopWaiting();
      this.maybeStartNextWaveCoop();
      Net.sendShopDone();
    }
  }

  openShopFromWorld() {
    if (this.mode === 'solo') {
      this.midWaveShop = true;
      this.openTacticalShop();
    } else {
      this.midWaveShop = true;
      this.shopOpenLocal = true;
      this.ui.showHUD(false);
      this.ui.showTacticalShop(this);
      Menus.show('shop-menu');
    }
  }

  openInventory() {
    this.inventoryOpenLocal = true;
    if (this.mode === 'solo') {
      this.state = 'inventory';
    }
    this.ui.showHUD(false);
    this.ui.showInventory(this);
    Menus.show('inventory-menu');
  }

  closeInventory() {
    this.inventoryOpenLocal = false;
    if (this.mode === 'solo') {
      this.state = 'playing';
    }
    Menus.hideAll();
    this.ui.showHUD(true);
  }

  openTrainingRange() {
    this.trainingOpenLocal = true;
    if (this.mode === 'solo') {
      this.state = 'upgrade'; // Freeze physics using existing upgrade state
    }
    this.ui.showHUD(false);
    this.ui.showUpgradeChoices(this);
    Menus.show('upgrade-menu');
  }

  closeTrainingRange() {
    this.trainingOpenLocal = false;
    if (this.mode === 'solo') {
      this.state = 'playing';
    }
    Menus.hideAll();
    this.ui.showHUD(true);
  }

  buyUpgradeAtTrainingRange(up, cost) {
    const me = this.localPlayer;
    if (me.score >= cost) {
      me.score -= cost;
      up.apply(me);
      if (Audio2.upgrade) Audio2.upgrade(); else Audio2.reload();
      
      this.particles.spawn(me.x, me.y, '#4af626', { count: 12, minSpeed: 40, maxSpeed: 120, life: 0.5, size: 3 });

      if (this.mode === 'guest') {
        Net.sendShopAction({ action: 'upgrade', id: up.id, cost });
      }

      // Roll replacement upgrade so choices are filled
      const idx = this.shopUpgrades.indexOf(up);
      if (idx !== -1) {
        let pool = UPGRADES.slice().filter((u) => u.id !== 'vision' || this.gameMode === 'horror');
        const currentIds = this.shopUpgrades.map(su => su.id);
        pool = pool.filter(u => !currentIds.includes(u.id));
        if (pool.length > 0) {
          const nextUp = Utils.pick(pool);
          this.shopUpgrades[idx] = nextUp;
          this.shopUpgradeIds[idx] = nextUp.id;
        } else {
          this.shopUpgrades.splice(idx, 1);
          this.shopUpgradeIds.splice(idx, 1);
        }
      }
      return true;
    }
    return false;
  }

  useInventoryItem(kind) {
    const me = this.localPlayer;
    let success = false;
    if (kind === 'bread') success = me.useBread(this);
    else if (kind === 'novacola') success = me.useNovacola(this);
    else if (kind === 'medkit') success = me.useMedkit(this);
    else if (kind === 'shield') success = me.useShield(this);

    if (success) {
      if (this.mode === 'guest') {
        Net.sendShopAction({ action: 'use-item', kind });
      }
      this.ui.showInventory(this); // refresh UI
    }
  }

  // ----- workbench (in-world weapon shop + per-weapon upgrades, "press E") -----
  openWorkbench() {
    this.workbenchOpenLocal = true;
    this.ui.showHUD(false);
    this.ui.showWorkbench(this);
    Menus.show('workbench-menu');
  }

  closeWorkbench() {
    this.workbenchOpenLocal = false;
    Menus.hideAll();
    this.ui.showHUD(true);
  }

  buyWeaponAtWorkbench(key, price) {
    const me = this.localPlayer;
    if (me.coins < price || (me.weapons[key] && me.weapons[key].unlocked)) return false;
    me.coins -= price;
    me.unlock(key);
    if (this.mode === 'guest') Net.sendWorkbenchAction({ action: 'buy-weapon', key, price });
    Audio2.buy();
    return true;
  }

  upgradeWeaponAtWorkbench(key, price) {
    const me = this.localPlayer;
    if (me.coins < price) return false;
    if (!me.upgradeWeapon(key)) return false;
    me.coins -= price;
    if (this.mode === 'guest') Net.sendWorkbenchAction({ action: 'upgrade-weapon', key, price });
    Audio2.buy();
    return true;
  }

  // host receives a guest workbench action and applies it to the guest's authoritative player
  onGuestWorkbenchAction(msg) {
    if (this.mode !== 'host' || !this.player2) return;
    if (this.player2.coins < msg.price) return;
    if (msg.action === 'buy-weapon') {
      if (this.player2.weapons[msg.key] && this.player2.weapons[msg.key].unlocked) return;
      this.player2.coins -= msg.price;
      this.player2.unlock(msg.key);
    } else if (msg.action === 'upgrade-weapon') {
      if (!this.player2.upgradeWeapon(msg.key)) return;
      this.player2.coins -= msg.price;
    }
  }

  showShopWaiting() {
    this.ui.showShopWaiting();
    Menus.show('shop-menu');
  }

  maybeStartNextWaveCoop() {
    if (!(this.hostShopDone && this.guestShopDone)) return;
    this.hostShopDone = false;
    this.guestShopDone = false;
    this.shopOpenLocal = false;
    Menus.hideAll();
    this.state = 'playing';
    this.ui.showHUD(true);
    this.waves.startWave(this.waves.wave + 1);
  }

  // host receives a guest shop action and applies it to the guest's authoritative player
  onGuestShopAction(msg) {
    if (this.mode !== 'host' || !this.player2) return;
    if (msg.action === 'upgrade') {
      const up = UPGRADES.find((u) => u.id === msg.id);
      const cost = msg.cost || (up ? up.price * 10 : 0);
      if (up && this.player2.score >= cost) {
        this.player2.score -= cost;
        up.apply(this.player2);
      }
    } else if (msg.action === 'buy') {
      if (this.player2.coins >= msg.price) {
        this.player2.coins -= msg.price;
        this.applyPurchase(this.player2, msg.kind, msg.key);
      }
    } else if (msg.action === 'use-item') {
      if (msg.kind === 'bread') this.player2.useBread(this);
      else if (msg.kind === 'novacola') this.player2.useNovacola(this);
      else if (msg.kind === 'medkit') this.player2.useMedkit(this);
      else if (msg.kind === 'shield') this.player2.useShield(this);
    }
  }

  onGuestShopDone() {
    if (this.mode !== 'host') return;
    this.guestShopDone = true;
    this.maybeStartNextWaveCoop();
  }

  closeShop() {
    Menus.hideAll();
    this.state = 'playing';
    this.ui.showHUD(true);
    if (this.midWaveShop) {
      this.midWaveShop = false;
    } else {
      this.waves.startWave(this.waves.wave + 1);
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    Menus.show('pause-menu');
  }
  resume() {
    if (this.state !== 'paused') return;
    Menus.hideAll();
    this.state = 'playing';
  }

  // ----- main update -----
  update(dt) {
    this.dt = dt;
    this.time += dt;
    Audio2.updateMusic(dt);

    // guest tabs never simulate — they just forward local input and render
    // whatever the host last broadcast (see applySnapshot()).
    if (this.mode === 'guest') {
      if (this.state === 'playing' && this.player2) {
        this.updateCamera(dt);
        Input.mouse.worldX = this.cam.x + Input.mouse.x;
        Input.mouse.worldY = this.cam.y + Input.mouse.y;
        // cosmetic proximity check (map layout is synced, so this matches the host's)
        this.nearWorkbench = this.workbench && Utils.dist(this.player2.x, this.player2.y, this.workbench.x, this.workbench.y) < this.workbench.interactRange;
        if (this.nearWorkbench && !this.shopOpenLocal && !this.workbenchOpenLocal && Input.wasPressed('f')) {
          this.openWorkbench();
        }
        this.nearShop = this.shopTable && Utils.dist(this.player2.x, this.player2.y, this.shopTable.x, this.shopTable.y) < this.shopTable.interactRange;
        if (this.nearShop && !this.shopOpenLocal && !this.workbenchOpenLocal && !this.trainingOpenLocal && Input.wasPressed('e')) {
          this.openShopFromWorld();
          Input.pressed['e'] = false;
        }
        this.nearTrainingRange = this.trainingRange && Utils.dist(this.player2.x, this.player2.y, this.trainingRange.x, this.trainingRange.y) < this.trainingRange.interactRange;
        if (this.nearTrainingRange && !this.shopOpenLocal && !this.workbenchOpenLocal && !this.trainingOpenLocal && Input.wasPressed('e')) {
          this.openTrainingRange();
          Input.pressed['e'] = false;
        }
        if (Input.wasPressed('i')) {
          if (this.inventoryOpenLocal) this.closeInventory(); else this.openInventory();
          Input.pressed['i'] = false;
        }
        if (this.shopOpenLocal || this.workbenchOpenLocal || this.inventoryOpenLocal || this.trainingOpenLocal) {
          // menu open: stand still, don't fire — send a neutral packet
          Net.sendInput({ keys: {}, justPressed: [], mouseWorldX: Input.mouse.worldX, mouseWorldY: Input.mouse.worldY, mouseDown: false, rightDown: false, rightPressed: false });
        } else {
          Net.sendInput({
            keys: { w: Input.key('w'), a: Input.key('a'), s: Input.key('s'), d: Input.key('d'), shift: Input.key('shift'), r: Input.key('r'),
                     '1': Input.key('1'), '2': Input.key('2'), '3': Input.key('3'), '4': Input.key('4'), '5': Input.key('5') },
            justPressed: Object.keys(Input.pressed).filter((k) => Input.pressed[k]),
            mouseWorldX: Input.mouse.worldX, mouseWorldY: Input.mouse.worldY, mouseDown: Input.mouse.down,
            rightDown: Input.mouse.rightDown, rightPressed: Input.mouse.rightPressed,
          });
        }
      }
      this.ui.updateHUD(this);
      Input.clearFrame();
      return;
    }

    // Toggle inventory menu with 'I'
    if (Input.wasPressed('i')) {
      if (this.inventoryOpenLocal) {
        this.closeInventory();
      } else if (this.state === 'playing') {
        this.openInventory();
      }
      Input.pressed['i'] = false;
    }

    if (this.state !== 'playing') {
      if (this.trainingOpenLocal && (Input.wasPressed('e') || Input.wasPressed('escape'))) {
        this.closeTrainingRange();
        Input.pressed['e'] = false;
        Input.pressed['escape'] = false;
      }
      // still keep the guest in sync while we're in the shop/upgrade/gameover screens,
      // otherwise they freeze on the last 'playing' snapshot forever.
      if (this.mode === 'host') this.sendSnapshotThrottled(dt);
      Input.clearFrame();
      return;
    }
    if (Input.wasPressed('escape')) { this.pause(); Input.clearFrame(); return; }

    this.playTime += dt;
    // convert mouse to world
    Input.mouse.worldX = this.cam.x + Input.mouse.x;
    Input.mouse.worldY = this.cam.y + Input.mouse.y;

    // workbench interact ("press F")
    this.nearWorkbench = this.workbench && Utils.dist(this.player.x, this.player.y, this.workbench.x, this.workbench.y) < this.workbench.interactRange;
    if (this.nearWorkbench && !this.workbenchOpenLocal && Input.wasPressed('f')) {
      this.openWorkbench();
    }
    this.nearShop = this.shopTable && Utils.dist(this.player.x, this.player.y, this.shopTable.x, this.shopTable.y) < this.shopTable.interactRange;
    if (this.nearShop && !this.shopOpenLocal && Input.wasPressed('e')) {
      this.openShopFromWorld();
      Input.pressed['e'] = false;
    }
    this.nearTrainingRange = this.trainingRange && Utils.dist(this.player.x, this.player.y, this.trainingRange.x, this.trainingRange.y) < this.trainingRange.interactRange;
    if (this.nearTrainingRange && !this.trainingOpenLocal && Input.wasPressed('e')) {
      this.openTrainingRange();
      Input.pressed['e'] = false;
    }

    this.world.update(dt);
    for (const p of this.players) if (p.hp > 0) p.update(dt, this);
    this.waves.update(dt);

    for (const e of this.enemies) e.update(dt, this);
    if (this.boss && !this.boss.dead) this.boss.update(dt, this);

    this.updateProjectiles(dt);
    this.updateEnemyProjectiles(dt);

    for (const c of this.coins) c.update(dt, this);
    this.coins = this.coins.filter((c) => !c.dead);
    for (const m of this.medkits) m.update(dt, this);
    this.medkits = this.medkits.filter((m) => !m.dead);
    for (const s of this.shields) s.update(dt, this);
    this.shields = this.shields.filter((s) => !s.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.lightningArcs) {
      for (const arc of this.lightningArcs) arc.life -= dt;
      this.lightningArcs = this.lightningArcs.filter((a) => a.life > 0);
    }
    this.particles.update(dt);

    this.updateCamera(dt);

    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    if (this.damageVignette > 0) this.damageVignette = Math.max(0, this.damageVignette - dt * 2);

    // wave clear?
    if (this.waves.isCleared()) this.endWave();

    this.ui.updateHUD(this);
    Input.clearFrame();
    if (this.player2 && this.player2.isRemote) this.player2.input.clearFrame();

    if (this.mode === 'host') this.sendSnapshotThrottled(dt);
  }

  // broadcasting a full snapshot every single frame (60/s) needlessly saturates
  // both the host's and guest's CPU with JSON (de)serialization; ~20/s is still smooth.
  sendSnapshotThrottled(dt) {
    this._snapshotTimer -= dt;
    if (this._snapshotTimer > 0) return;
    this._snapshotTimer = 1 / 20;
    Net.sendSnapshot(this.buildSnapshot());
  }

  buildSnapshot() {
    return {
      state: this.state,
      gameMode: this.gameMode,
      wave: this.waves ? this.waves.wave : 1,
      layoutIndex: this.world ? this.world.layoutIndex : 0,
      shopUpgradeIds: this.shopUpgradeIds || [],
      cam: { x: this.cam.x, y: this.cam.y },
      players: this.players.map((p) => ({
        x: p.x, y: p.y, aimAngle: p.aimAngle, hp: p.hp, maxHp: p.maxHp,
        coins: p.coins, score: p.score, kills: p.kills,
        currentWeapon: p.currentWeapon, ammo: p.weapons[p.currentWeapon].ammo, magCapacity: p.magSize(),
        reloading: p.reloading, reloadTimer: p.reloadTimer, reloadTotal: p.reloadTotal,
        dashCd: p.dashCd, dashCdTotal: p.dashCooldown(), hitFlash: p.hitFlash, invuln: p.invuln, walkPhase: p.walkPhase,
        visionRange: p.mods.visionRange, meleeSwing: p.meleeSwing, meleeArc: p.meleeArc, meleeRange: p.meleeRange, shieldHp: p.shieldHp,
        novaColaTimer: p.novaColaTimer || 0,
        medkitsCount: p.medkitsCount || 0,
        shieldsCount: p.shieldsCount || 0,
        breadCount: p.breadCount || 0,
        novacolaCount: p.novacolaCount || 0,
      })),
      enemies: this.enemies.map((e) => ({ x: e.x, y: e.y, radius: e.radius, color: e.color, hp: e.hp, maxHp: e.maxHp, type: e.type, hitFlash: e.hitFlash })),
      boss: this.boss && !this.boss.dead ? {
        x: this.boss.x, y: this.boss.y, radius: this.boss.radius, hp: this.boss.hp, maxHp: this.boss.maxHp,
        name: this.boss.name, phase2: this.boss.phase2, spin: this.boss.spin, hitFlash: this.boss.hitFlash,
      } : null,
      projectiles: this.projectiles.map((pr) => ({ x: pr.x, y: pr.y, radius: pr.radius, color: pr.color, angle: pr.angle, aoe: pr.aoe })),
      enemyProjectiles: this.enemyProjectiles.map((ep) => ({ x: ep.x, y: ep.y, radius: ep.radius, color: ep.color })),
      coins: this.coins.map((c) => ({ x: c.x, y: c.y })),
      medkits: this.medkits.map((m) => ({ x: m.x, y: m.y, life: m.life })),
      shakeAmt: this.shakeAmt,
    };
  }

  applySnapshot(s) {
    if (!this.world) return; // not ready yet
    const prevSync = this._syncState;
    this._syncState = s.state;
    this.state = s.state;
    this.gameMode = s.gameMode || 'standard';
    if (this.waves) this.waves.wave = s.wave;
    if (s.layoutIndex !== undefined && this.world && this.world.layoutIndex !== s.layoutIndex) {
      this.world = new World(s.layoutIndex);
    }
    // reconstruct the (identical) upgrade options the host rolled, so our menu matches
    if (s.shopUpgradeIds) {
      this.shopUpgradeIds = s.shopUpgradeIds;
      this.shopUpgrades = s.shopUpgradeIds.map((id) => UPGRADES.find((u) => u.id === id)).filter(Boolean);
    }

    const assign = (p, d) => Object.assign(p, d);
    if (s.players[0]) {
      assign(this.player, s.players[0]);
      if (!this.player.mods) this.player.mods = {};
      this.player.mods.visionRange = s.players[0].visionRange || 1;
    }
    // While my own shop is open I own my inventory locally — take only render/status
    // fields from the host so my coins/weapons/upgrades don't get clobbered mid-purchase.
    if (s.players[1] && this.player2) {
      const d = s.players[1];
      if (this.shopOpenLocal && this.localPlayer === this.player2) {
        this.player2.x = d.x; this.player2.y = d.y; this.player2.aimAngle = d.aimAngle;
        this.player2.hp = d.hp; this.player2.maxHp = d.maxHp; this.player2.hitFlash = d.hitFlash;
        this.player2.invuln = d.invuln; this.player2.walkPhase = d.walkPhase; this.player2.shieldHp = d.shieldHp;
        this.player2.novaColaTimer = d.novaColaTimer || 0;
        this.player2.medkitsCount = d.medkitsCount || 0;
        this.player2.shieldsCount = d.shieldsCount || 0;
        this.player2.breadCount = d.breadCount || 0;
        this.player2.novacolaCount = d.novacolaCount || 0;
      } else {
        assign(this.player2, d);
        if (!this.player2.mods) this.player2.mods = {};
        this.player2.mods.visionRange = d.visionRange || 1;
      }
    }

    this.enemies = s.enemies.map((d) => Object.assign(Object.create(Enemy.prototype), d, { draw: Enemy.prototype.draw, dead: false }));
    this.boss = s.boss ? Object.assign(Object.create(Boss.prototype), s.boss, { dead: false }) : null;
    this.projectiles = s.projectiles.map((d) => Object.assign(Object.create(Projectile.prototype), d, {
      trail: [], vx: Math.cos(d.angle) * 500, vy: Math.sin(d.angle) * 500,
    }));
    this.enemyProjectiles = s.enemyProjectiles;
    this.coins = s.coins.map((d) => new Coin(d.x, d.y));
    this.medkits = s.medkits.map((d) => { const m = new Medkit(d.x, d.y); m.life = d.life; return m; });
    this.shakeAmt = s.shakeAmt;

    // ----- menu / phase handling (guest) -----
    if (s.state === 'gameover') {
      this.ui.showHUD(false);
      this.ui.showGameOver({ wave: s.wave, kills: this.localPlayer.kills, score: this.localPlayer.score, coins: this.localPlayer.coins, time: '--:--' });
      Menus.show('gameover-menu');
    } else if (s.state === 'shop') {
      // enter my own intermission exactly once (when the wave first ends)
      if (prevSync !== 'shop') this.beginLocalIntermission();
      // otherwise leave my local shop navigation alone
    } else if (s.state === 'playing') {
      // host started the next wave — leave the intermission (unless I have a
      // personal mid-wave shop overlay open)
      if (!(this.shopOpenLocal && this.midWaveShop)) {
        this.shopOpenLocal = false;
        this.ui.showHUD(true);
        Menus.hideAll();
      }
    }
  }

  updateProjectiles(dt) {
    for (const pr of this.projectiles) {
      pr.update(dt, this.world);
      if (pr.dead) continue;
      // vs boss
      if (this.boss && !this.boss.dead && Utils.dist(pr.x, pr.y, this.boss.x, this.boss.y) < this.boss.radius + pr.radius) {
        this.hitTarget(pr, this.boss);
      }
      if (pr.dead) continue;
      for (const e of this.enemies) {
        if (e.dead || pr.hitSet.has(e)) continue;
        if (Utils.dist(pr.x, pr.y, e.x, e.y) < e.radius + pr.radius) {
          this.hitTarget(pr, e);
          if (pr.dead) break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  hitTarget(pr, target) {
    if (pr.aoe > 0) {
      // explosion: damage all in radius
      this.explode(pr.x, pr.y, pr.aoe, pr.damage, pr.owner);
      pr.dead = true;
      return;
    }
    target.lastHitBy = pr.owner;
    target.takeDamage(pr.damage, this);
    this.applyProjectileEffects(pr, target);
    pr.hitSet.add(target);
    this.particles.spawn(pr.x, pr.y, pr.color, { count: 5, angle: pr.angle, spread: 1.2, minSpeed: 40, maxSpeed: 130, life: 0.2, size: 3 });
    if (pr.hitSet.size > pr.pierce) pr.dead = true;
  }

  // burn / slow / lightning-chain from special weapons
  applyProjectileEffects(pr, target) {
    if (pr.burn && target.applyBurn) target.applyBurn(pr.burn, 2.5, pr.owner);
    if (pr.slow && target.applySlow) target.applySlow(pr.slow);
    if (pr.chain > 0) this.chainLightning(target, pr.damage * 0.6, pr.chain, pr.owner, new Set([target]));
  }

  chainLightning(from, dmg, jumps, owner, hitSet) {
    if (jumps <= 0) return;
    let best = null, bestD = 260; // max jump distance
    for (const e of this.enemies) {
      if (e.dead || hitSet.has(e)) continue;
      const d = Utils.dist(from.x, from.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return;
    hitSet.add(best);
    // draw the arc
    this.particles.spawn(best.x, best.y, '#4ad9ff', { count: 6, minSpeed: 40, maxSpeed: 160, life: 0.2, size: 3 });
    if (this.lightningArcs) this.lightningArcs.push({ x1: from.x, y1: from.y, x2: best.x, y2: best.y, life: 0.12 });
    best.lastHitBy = owner;
    best.takeDamage(dmg, this);
    this.chainLightning(best, dmg * 0.75, jumps - 1, owner, hitSet);
  }

  explode(x, y, radius, dmg, owner) {
    this.particles.burst(x, y, '#ffb14d', 24, 260);
    this.particles.burst(x, y, '#b14dff', 16, 200);
    Audio2.explosion();
    this.shake(10);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Utils.dist(x, y, e.x, e.y);
      if (d < radius + e.radius) { e.lastHitBy = owner; e.takeDamage(dmg * (1 - d / (radius + e.radius) * 0.5), this); }
    }
    if (this.boss && !this.boss.dead && Utils.dist(x, y, this.boss.x, this.boss.y) < radius + this.boss.radius) {
      this.boss.lastHitBy = owner;
      this.boss.takeDamage(dmg, this);
    }
  }

  updateEnemyProjectiles(dt) {
    for (const ep of this.enemyProjectiles) {
      ep.x += ep.vx * dt; ep.y += ep.vy * dt;
      ep.life -= dt;
      const hitWall = pointInRects(ep.x, ep.y, this.world.rects, ep.radius);
      if (ep.life <= 0 || hitWall) {
        if (ep.isExplosive) this.explodeEnemyProj(ep.x, ep.y, ep.aoe || 80, ep.dmg);
        ep.dead = true;
        continue;
      }
      for (const p of this.players) {
        if (p.hp <= 0) continue;
        if (Utils.dist(ep.x, ep.y, p.x, p.y) < p.radius + ep.radius) {
          if (ep.isExplosive) {
            this.explodeEnemyProj(ep.x, ep.y, ep.aoe || 80, ep.dmg);
          } else {
            p.takeDamage(ep.dmg, this);
          }
          ep.dead = true;
          break;
        }
      }
    }
    this.enemyProjectiles = this.enemyProjectiles.filter((e) => !e.dead);
  }

  explodeEnemyProj(x, y, radius, dmg) {
    this.particles.burst(x, y, '#ff8b26', 18, 220);
    this.particles.burst(x, y, '#ffaa00', 12, 160);
    Audio2.explosion();
    this.shake(8);
    for (const p of this.players) {
      if (p.hp > 0) {
        const d = Utils.dist(x, y, p.x, p.y);
        if (d < radius + p.radius) {
          p.takeDamage(dmg * (1 - d / (radius + p.radius) * 0.5), this);
        }
      }
    }
  }

  // ----- render -----
  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'menu') { this.renderMenuBg(); return; }
    if (!this.world) return;

    let sx = 0, sy = 0;
    if (this.shakeAmt > 0) { sx = Utils.rand(-this.shakeAmt, this.shakeAmt); sy = Utils.rand(-this.shakeAmt, this.shakeAmt); }
    ctx.save();
    ctx.translate(-this.cam.x + sx, -this.cam.y + sy);

    // 1. Draw elements that are hidden in the dark
    this.world.draw(ctx, this.cam, this.time);
    if (this.workbench) this.workbench.draw(ctx, this.time, this.nearWorkbench);
    if (this.shopTable) this.shopTable.draw(ctx, this.time, this.nearShop);
    if (this.trainingRange) this.trainingRange.draw(ctx, this.time, this.nearTrainingRange);
    for (const c of this.coins) c.draw(ctx, this.time);
    for (const m of this.medkits) m.draw(ctx, this.time);
    for (const s of this.shields) s.draw(ctx, this.time);
    for (const e of this.enemies) e.draw(ctx, this.time);
    if (this.boss && !this.boss.dead) this.boss.draw(ctx, this.time);
    for (const p of this.players) if (p.hp > 0) p.draw(ctx, this.time);

    // 2. Apply Flashlight Mask (overlay in screen coordinates) if in Horror mode
    if (this.gameMode === 'horror') {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.drawFlashlightMask(ctx);
      ctx.restore();
    }

    // 3. Draw glowing elements on top of the dark overlay (projectiles, sparks, explosions)
    for (const ep of this.enemyProjectiles) {
      ctx.shadowBlur = 10; ctx.shadowColor = ep.color; ctx.fillStyle = ep.color;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, ep.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    for (const pr of this.projectiles) pr.draw(ctx);

    // tesla lightning arcs
    if (this.lightningArcs) {
      for (const arc of this.lightningArcs) {
        ctx.globalAlpha = Utils.clamp(arc.life / 0.12, 0, 1);
        ctx.strokeStyle = '#bfefff'; ctx.lineWidth = 2.5;
        ctx.shadowBlur = 12; ctx.shadowColor = '#4ad9ff';
        ctx.beginPath();
        // jagged bolt between the two points
        const segs = 5;
        ctx.moveTo(arc.x1, arc.y1);
        for (let i = 1; i < segs; i++) {
          const t = i / segs;
          const mxp = arc.x1 + (arc.x2 - arc.x1) * t + Utils.rand(-10, 10);
          const myp = arc.y1 + (arc.y2 - arc.y1) * t + Utils.rand(-10, 10);
          ctx.lineTo(mxp, myp);
        }
        ctx.lineTo(arc.x2, arc.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    this.particles.draw(ctx);

    ctx.restore();

    // damage vignette
    if (this.damageVignette > 0) {
      const g = ctx.createRadialGradient(this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.3,
        this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.7);
      g.addColorStop(0, 'rgba(255,0,40,0)');
      g.addColorStop(1, 'rgba(255,0,40,' + (0.5 * this.damageVignette) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (this.inventoryOpenLocal) {
      this.ui.drawInventoryPreview(this);
    }
  }

  drawFlashlightMask(ctx) {
    if (!this.maskCanvas) {
      this.maskCanvas = document.createElement('canvas');
      this.maskCtx = this.maskCanvas.getContext('2d');
    }
    if (this.maskCanvas.width !== this.canvas.width || this.maskCanvas.height !== this.canvas.height) {
      this.maskCanvas.width = this.canvas.width;
      this.maskCanvas.height = this.canvas.height;
    }

    const mCtx = this.maskCtx;
    mCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

    // Tactical dark overlay color
    mCtx.fillStyle = 'rgba(7, 8, 12, 0.93)';
    mCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

    // Carve out flashlight cones
    mCtx.globalCompositeOperation = 'destination-out';

    for (const p of this.players) {
      if (p.hp <= 0) continue;

      const screenX = p.x - this.cam.x;
      const screenY = p.y - this.cam.y;
      const visionMult = p.mods.visionRange || 1;
      const range = 420 * visionMult;
      const ambientRadius = 80 * visionMult;
      const coneHalfAngle = (36 * Math.PI / 180); // 72 degrees total spread

      // 1. Ambient lighting around player
      let gradAmbient = mCtx.createRadialGradient(screenX, screenY, 0, screenX, screenY, ambientRadius);
      gradAmbient.addColorStop(0, 'rgba(0,0,0,1.0)');
      gradAmbient.addColorStop(0.5, 'rgba(0,0,0,0.85)');
      gradAmbient.addColorStop(1, 'rgba(0,0,0,0.0)');
      
      mCtx.fillStyle = gradAmbient;
      mCtx.beginPath();
      mCtx.arc(screenX, screenY, ambientRadius, 0, Math.PI * 2);
      mCtx.fill();

      // 2. Directional cone
      mCtx.beginPath();
      mCtx.moveTo(screenX, screenY);
      mCtx.arc(screenX, screenY, range, p.aimAngle - coneHalfAngle, p.aimAngle + coneHalfAngle);
      mCtx.closePath();

      let gradCone = mCtx.createRadialGradient(screenX, screenY, ambientRadius * 0.5, screenX, screenY, range);
      gradCone.addColorStop(0, 'rgba(0,0,0,1.0)');
      gradCone.addColorStop(0.25, 'rgba(0,0,0,0.85)');
      gradCone.addColorStop(0.7, 'rgba(0,0,0,0.3)');
      gradCone.addColorStop(1, 'rgba(0,0,0,0.0)');
      
      mCtx.fillStyle = gradCone;
      mCtx.fill();
    }

    mCtx.globalCompositeOperation = 'source-over';

    // Draw the mask on top of the main canvas
    ctx.drawImage(this.maskCanvas, 0, 0);

    // Draw subtle volumetric dust/beam reflection
    for (const p of this.players) {
      if (p.hp <= 0) continue;

      const screenX = p.x - this.cam.x;
      const screenY = p.y - this.cam.y;
      const visionMult = p.mods.visionRange || 1;
      const range = 420 * visionMult;
      const coneHalfAngle = (36 * Math.PI / 180);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.arc(screenX, screenY, range, p.aimAngle - coneHalfAngle, p.aimAngle + coneHalfAngle);
      ctx.closePath();

      let beamGrad = ctx.createRadialGradient(screenX, screenY, 20, screenX, screenY, range);
      beamGrad.addColorStop(0, 'rgba(230, 242, 255, 0.08)');
      beamGrad.addColorStop(0.4, 'rgba(230, 242, 255, 0.04)');
      beamGrad.addColorStop(1, 'rgba(230, 242, 255, 0.0)');
      
      ctx.fillStyle = beamGrad;
      ctx.fill();
      ctx.restore();
    }
  }

  renderMenuBg() {
    const ctx = this.ctx;
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (let i = 0; i < 60; i++) {
      const x = (i * 137.5 + this.time * 20) % this.canvas.width;
      const y = (i * 89.3 + this.time * 8) % this.canvas.height;
      ctx.globalAlpha = 0.3 + 0.3 * Math.sin(this.time + i);
      ctx.fillStyle = i % 2 ? '#2ff3ff' : '#b14dff';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  updateCamera(dt) {
    if (!this.world) return;
    const target = this.localPlayer || this.player;
    if (!target) return;
    const tx = target.x - this.cam.w / 2;
    const ty = target.y - this.cam.h / 2;
    this.cam.x = Utils.lerp(this.cam.x, tx, 0.12);
    this.cam.y = Utils.lerp(this.cam.y, ty, 0.12);
    this.cam.x = Utils.clamp(this.cam.x, 0, Math.max(0, this.world.w - this.cam.w));
    this.cam.y = Utils.clamp(this.cam.y, 0, Math.max(0, this.world.h - this.cam.h));
  }
}
