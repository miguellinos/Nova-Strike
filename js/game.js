// ---------- game.js : core loop & state machine ----------
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = new UI();
    this.state = 'menu'; // menu | playing | paused | shop | gameover
    this.mode = 'solo';  // solo | host | guest (LAN co-op)
    this.gameMode = 'standard'; // 'standard' | 'horror'
    this.zoom = 1.35;
    this.cam = { x: 0, y: 0, w: canvas.width / this.zoom, h: canvas.height / this.zoom };
    this.time = 0; this.dt = 0;
    this.shakeAmt = 0;
    this.damageVignette = 0;
    this.flashWhiteout = 0; // full-screen white flash from the operative boss's flashbang
    this.interiorT = 0;
    this.hpMult = 1; this.dmgMult = 1;
    this.player2 = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.cam.w = this.canvas.width / this.zoom;
    this.cam.h = this.canvas.height / this.zoom;
  }

  // all active players (1 in solo, 2 in co-op). Cached instead of allocating a new
  // array on every access — this getter is read dozens of times per frame (update,
  // render, buildSnapshot, nearestPlayer, projectile collision, ...), and player/
  // player2 only ever change once, in newGame(). The cache is rebuilt there.
  get players() { return this._playersCache || (this._playersCache = this.player2 ? [this.player, this.player2] : [this.player]); }
  // the player whose stats/HUD belong to THIS browser tab
  get localPlayer() { return this.mode === 'guest' ? this.player2 : this.player; }

  nearestPlayer(x, y) {
    // enemies should target whoever can still fight back — a downed, spectating
    // teammate shouldn't act as an aggro magnet (or a free target once revived
    // near the fight). Only fall back to a dead player if everyone is down.
    // Called once per enemy/coin/medkit/shield every frame, so this avoids the
    // .filter() allocation that used to run on every single call.
    const players = this.players;
    let anyAlive = false;
    for (const p of players) if (p.hp > 0) { anyAlive = true; break; }
    let best = players[0], bestD = Infinity;
    for (const p of players) {
      if (anyAlive && p.hp <= 0) continue;
      const d = Utils.dist(x, y, p.x, p.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  // mode: 'solo' (default) | 'host' | 'guest' — coop games always run 2 player slots
  // cheat: optional { wave, weapons } from the "M" cheat menu — solo only.
  // extractPos: {x,y} for the extraction landing zone — the host rolls this and
  // sends it to the guest (see main.js's 'start' handler) so both see the same
  // spot; solo/host without one falls back to picking their own.
  newGame(mode, gameMode, mapIndex, cheat, extractPos) {
    this.mode = mode || 'solo';
    this.gameMode = gameMode || 'standard';
    // Random map for wave 1 (host/solo pick; guests get the synced index) — every
    // layout, including the newer themed ones, should be able to come up.
    this.world = new World(mapIndex);
    this.workbench = new Workbench(this.world.workbenchPos.x, this.world.workbenchPos.y);
    this.nearWorkbench = false;
    this.workbenchOpenLocal = false;
    this.shopTable = new ShopTable(-150, 320);
    this.nearShop = false;
    this.atm = new Atm(-230, 320);
    this.nearAtm = false;
    this.atmOpenLocal = false;
    this.trainingRange = new TrainingRange(-150, 680);
    this.nearTrainingRange = false;
    this.trainingOpenLocal = false;
    this.inventoryOpenLocal = false;
    this.pauseOpenLocal = false;

    // "Extraktion" mode: a goal zone somewhere out on the map. Locked until the
    // squad clears the first wave, then channels open (all alive players must
    // stand inside together in co-op) over extractChannelTime seconds to win.
    if (this.gameMode === 'extraction') {
      const pos = extractPos || this.world.randomSpawnPoint();
      this.extractionPoint = new ExtractionPoint(pos.x, pos.y);
      this.extractAvailableWave = 2;
      this.extractChannelTime = 6;
    } else {
      this.extractionPoint = null;
    }
    this.extractProgress = 0;
    this.nearExtraction = false;
    this._snapshotTimer = 0;
    this.interiorT = 0;
    const spawn = { x: this.world.w / 2, y: this.world.h / 2 - 180 };
    this.player = new Player(spawn.x - 20, spawn.y);
    this.player2 = this.mode !== 'solo' ? new Player(spawn.x + 20, spawn.y, this.mode === 'host') : null;
    this._playersCache = null; // invalidate the cached players array (see the getter above)
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.enemies = [];
    this.boss = null;
    this.coins = [];
    this.medkits = [];
    this.shields = [];
    this.grenadePickups = [];
    this.lightningArcs = [];
    this.particles = new Particles();
    this.waves = new WaveManager(this);
    this.playTime = 0;
    const target = this.localPlayer || this.player;
    this.cam.x = target.x - this.cam.w / 2;
    this.cam.y = target.y - this.cam.h / 2;
    this.state = 'playing';
    this.midWaveShop = false;
    this.intermissionTimer = 0; // >0 between waves, while the squad loots the ground
    // per-client shop state (co-op: each player shops independently)
    this.shopOpenLocal = false;
    this.shopUpgradeIds = [];
    this.hostShopDone = false;
    this.guestShopDone = false;
    this._syncState = 'playing';
    this.ui.showHUD(true);

    // cheat menu ("M" from the main menu, solo only): unlock chosen weapons +
    // jump straight to a given wave (with its normal hp/dmg scaling applied).
    if (cheat && this.mode === 'solo') {
      if (cheat.weapons) for (const key of cheat.weapons) this.player.unlock(key);
      if (cheat.medkits !== undefined) this.player.medkitsCount = cheat.medkits;
      if (cheat.shields !== undefined) this.player.shieldsCount = cheat.shields;
      if (cheat.grenades !== undefined) this.player.grenadeCount = cheat.grenades;
      this.waves.startWave(Math.max(1, cheat.wave || 1), cheat.forceBoss);
      return;
    }
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
    if (killer.mods && Utils.chance(killer.mods.lifesteal) && killer.heal) killer.heal(5);
    // chance to drop a medkit — likelier when the killer is hurt
    const hurt = 1 - killer.hp / killer.maxHp;
    if (Utils.chance(0.05 + hurt * 0.11)) this.dropMedkit(e.x, e.y, 25);
    // chance to drop a shield battery
    const shieldHurt = 1 - (killer.shieldHp || 0) / (killer.maxShieldHp || 100);
    if (Utils.chance(0.05 + shieldHurt * 0.11)) this.dropShield(e.x, e.y);
    // chance to drop a grenade — flat rate, doesn't scale with a "need" like the
    // other two since there's no natural low-resource pressure to key it off of.
    // Tanks (the toughest "normal" enemies) always drop 2, as a reward that
    // matches the effort of killing them.
    if (e.type === 'tank' || e.type === 'rockettank') {
      for (let i = 0; i < 2; i++) this.dropGrenadePickup(e.x, e.y);
    } else if (Utils.chance(0.06)) {
      this.dropGrenadePickup(e.x, e.y);
    }
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
    // bosses always drop medkits, shields, and a couple of grenades
    for (let i = 0; i < 2; i++) this.dropMedkit(b.x, b.y, 40);
    for (let i = 0; i < 2; i++) this.dropShield(b.x, b.y);
    for (let i = 0; i < 2; i++) this.dropGrenadePickup(b.x, b.y);
  }

  // ----- extraction mode -----
  updateExtraction(dt) {
    if (!this.extractionPoint) return;
    const ep = this.extractionPoint;
    this.nearExtraction = Utils.dist(this.player.x, this.player.y, ep.x, ep.y) < ep.interactRange;

    const ready = this.waves.wave >= this.extractAvailableWave;
    const alive = this.players.filter((p) => p.hp > 0);
    const allInRange = ready && alive.length > 0 &&
      alive.every((p) => Utils.dist(p.x, p.y, ep.x, ep.y) < ep.interactRange);

    if (allInRange) {
      this.extractProgress = Math.min(this.extractChannelTime, this.extractProgress + dt);
      if (this.extractProgress >= this.extractChannelTime) this.completeExtraction();
    } else {
      // decays rather than resetting outright — stepping out for a second to
      // dodge a shot shouldn't undo the whole channel
      this.extractProgress = Math.max(0, this.extractProgress - dt * 1.5);
    }
  }

  completeExtraction() {
    this.state = 'extracted';
    this.ui.showHUD(false);
    const mins = Math.floor(this.playTime / 60), secs = Math.floor(this.playTime % 60);
    const p = this.localPlayer;
    this.ui.showExtractSuccess({
      wave: this.waves.wave, kills: p.kills, score: p.score,
      coins: p.coins, time: mins + ':' + String(secs).padStart(2, '0'),
    });
    Menus.show('extract-menu');
  }

  dropCoins(x, y, range, killer) {
    let n = Utils.randInt(range[0], range[1]);
    // killer can be a boss (friendly-fire kill of its own spawned reinforcements via
    // its own explosion) — bosses have no .mods, only players do.
    n = Math.round(n * (killer && killer.mods ? killer.mods.coinMult : 1));
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

  dropGrenadePickup(x, y) {
    this.grenadePickups.push(new GrenadePickup(x + Utils.rand(-16, 16), y + Utils.rand(-16, 16)));
  }
  onPlayerDeath() {
    // co-op: only end the run once both players are down — a downed teammate
    // gets revived automatically if the squad clears the current wave (see
    // endWave()); until then they just spectate the survivor.
    if (this.players.some((p) => p.hp > 0)) {
      this.ui.showBanner('MITSPIELER GEFALLEN — Wiederbelebung bei Wellen-Ende');
      return;
    }
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
    this.boss = null;

    // revive any downed squadmate right away, so they can help loot the intermission too
    for (const p of this.players) {
      if (p.hp <= 0) {
        p.hp = Math.round(p.maxHp * 0.5);
        p.invuln = 2;
        p.shieldHp = 0;
        this.particles.spawn(p.x, p.y, '#4af626', { count: 24, minSpeed: 40, maxSpeed: 170, life: 0.6, size: 4 });
        Audio2.heal();
      }
    }

    this.ui.showBanner('WELLE ERLEDIGT');

    // Roll new upgrades for the Trainingsrange terminal pool
    this.shopUpgrades = rollShopUpgrades(this.gameMode);
    this.shopUpgradeIds = this.shopUpgrades.map((u) => u.id);

    // Give the squad a breather to walk over and collect coins/medkits/shields
    // still on the ground before the map resets for the next wave (startNextWave()
    // below auto-collects whatever's left once this runs out, since the map switch
    // makes anything still on the ground unreachable).
    this.intermissionTimer = 8;
    setTimeout(() => this.startNextWave(), this.intermissionTimer * 1000);
  }

  // fires once the endWave() grace period above runs out
  startNextWave() {
    if (!(this.state === 'playing' || this.state === 'upgrade' || this.state === 'shop')) return;
    this.intermissionTimer = 0;

    // auto-collect whatever the squad didn't reach in time
    for (const c of this.coins) { this.player.coins += c.value; }
    this.coins = [];
    this.medkits = [];
    this.shields = [];
    this.grenadePickups = [];

    // Pick a fresh random map between waves (any of the layouts, not just the first two)
    let mapIndex = Utils.randInt(0, MAP_LAYOUTS.length - 1);
    if (MAP_LAYOUTS.length > 1) {
      while (mapIndex === this.world.layoutIndex) mapIndex = Utils.randInt(0, MAP_LAYOUTS.length - 1);
    }
    if (this.world.layoutIndex !== mapIndex) {
      this.world = new World(mapIndex);
      this.workbench = new Workbench(this.world.workbenchPos.x, this.world.workbenchPos.y);
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

    this.state = 'playing';
    this.ui.showHUD(true);
    this.waves.startWave(this.waves.wave + 1);
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
    else if (kind === 'grenade') p.grenadeCount++;
  }

  leaveShop() {
    // Shop/Werkbank/Trainingsplatz sind rein optionale Besuche pro Spieler —
    // Wellen starten unabhängig davon automatisch per Timer (siehe endWave()).
    // Kein Warten auf den anderen Spieler nötig.
    Menus.hideAll();
    this.shopOpenLocal = false;
    this.midWaveShop = false;
    this.ui.showHUD(true);
    if (this.mode === 'solo') this.state = 'playing';
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
    else if (kind === 'grenade') success = me.throwGrenade(this);

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
      else if (msg.kind === 'grenade') this.player2.throwGrenade(this);
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
    if (this.mode === 'solo') {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      Menus.show('pause-menu');
    } else {
      // co-op: you can't freeze time for your partner over the network, so pause is
      // a personal overlay — the world keeps running and only you stand still while
      // it's open (like the shop/workbench). No state change, so the host keeps
      // simulating and broadcasting snapshots.
      if (this.pauseOpenLocal) return;
      this.pauseOpenLocal = true;
      Menus.show('pause-menu');
    }
  }
  resume() {
    if (this.mode === 'solo') {
      if (this.state !== 'paused') return;
      this.state = 'playing';
    } else {
      this.pauseOpenLocal = false;
    }
    Menus.hideAll();
  }

  // ----- main update -----
  update(dt) {
    this.dt = dt;
    this.time += dt;
    Audio2.updateMusic(dt);

    // Update dynamic building interior transition factor
    const localPlayer = this.localPlayer;
    if (localPlayer && this.world) {
      const inside = this.world.getBuildingAt(localPlayer.x, localPlayer.y) !== null;
      if (inside) {
        this.interiorT = Math.min(1, this.interiorT + dt * 2.2);
      } else {
        this.interiorT = Math.max(0, this.interiorT - dt * 2.2);
      }
    } else {
      this.interiorT = 0;
    }

    // guest tabs never simulate — they just forward local input and render
    // whatever the host last broadcast (see applySnapshot()).
    if (this.mode === 'guest') {
      if (this.state === 'playing' && this.player2) {
        // Smoothing factor is derived from dt instead of being a flat per-frame 0.25:
        // a fixed factor chases the target at whatever the current framerate happens
        // to be, so entities lag further behind the worse the frames get — exactly
        // when it hurts most. This converges at the same real-time rate regardless.
        const k = 1 - Math.pow(0.001, dt); // ~99.9% of the way to the target in 1s
        const lerpTo = (o) => {
          if (o && o.targetX !== undefined) {
            o.x = Utils.lerp(o.x, o.targetX, k);
            o.y = Utils.lerp(o.y, o.targetY, k);
          }
        };
        lerpTo(this.player);
        lerpTo(this.player2);
        for (const e of this.enemies) lerpTo(e);
        lerpTo(this.boss);

        // Bullets fly straight at a constant speed, so the guest can advance them
        // itself every frame; without this they only move when a snapshot lands and
        // visibly jump tens of pixels at a time.
        for (const pr of this.projectiles) {
          if (pr.vx !== undefined) { pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
        }
        for (const ep of this.enemyProjectiles) {
          if (ep.vx !== undefined) { ep.x += ep.vx * dt; ep.y += ep.vy * dt; }
        }

        // Tick local particles, screen shakes, and damage vignettes at 60 FPS
        this.particles.update(dt);
        if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
        if (this.damageVignette > 0) this.damageVignette = Math.max(0, this.damageVignette - dt * 2);
        if (this.flashWhiteout > 0) this.flashWhiteout = Math.max(0, this.flashWhiteout - dt);

        // Decay melee swings and scan timers locally
        if (this.player) {
          if (this.player.meleeSwing > 0) this.player.meleeSwing -= dt;
          if (this.player.scanTimer > 0) this.player.scanTimer -= dt;
        }
        if (this.player2) {
          if (this.player2.meleeSwing > 0) this.player2.meleeSwing -= dt;
          if (this.player2.scanTimer > 0) this.player2.scanTimer -= dt;
        }

        this.updateCamera(dt);
        Input.mouse.worldX = this.cam.x + Input.mouse.x / this.zoom;
        Input.mouse.worldY = this.cam.y + Input.mouse.y / this.zoom;

        // Client-side prediction for aim: applySnapshot() only updates aimAngle once
        // a round trip after the mouse actually moved (input -> host -> next
        // simulated frame -> snapshot -> back to us), so the weapon visibly lagged
        // behind the cursor and only "caught up" once a fresh snapshot landed. The
        // host still fires using ITS OWN aimAngle computed from our input packet, so
        // this is purely a render fix — recompute our own aim instantly every frame
        // from where we already know we are.
        this.player2.aimAngle = Utils.angle(this.player2.x, this.player2.y, Input.mouse.worldX, Input.mouse.worldY);

        this.nearWorkbench = this.workbench && Utils.dist(this.player2.x, this.player2.y, this.workbench.x, this.workbench.y) < this.workbench.interactRange;
        this.nearShop = this.shopTable && Utils.dist(this.player2.x, this.player2.y, this.shopTable.x, this.shopTable.y) < this.shopTable.interactRange;
        this.nearTrainingRange = this.trainingRange && Utils.dist(this.player2.x, this.player2.y, this.trainingRange.x, this.trainingRange.y) < this.trainingRange.interactRange;
        this.nearAtm = this.atm && (this.mode !== 'solo') && Utils.dist(this.player2.x, this.player2.y, this.atm.x, this.atm.y) < this.atm.interactRange;
        if (!this.shopOpenLocal && !this.workbenchOpenLocal && !this.trainingOpenLocal && !this.atmOpenLocal && Input.wasPressed('f')) {
          if (this.nearWorkbench) this.openWorkbench();
          else if (this.nearShop) this.openShopFromWorld();
          else if (this.nearTrainingRange) this.openTrainingRange();
          else if (this.nearAtm) this.openAtm();
          Input.pressed['f'] = false;
        }
        if (Input.wasPressed('i')) {
          if (this.inventoryOpenLocal) this.closeInventory(); else this.openInventory();
          Input.pressed['i'] = false;
        }
        if (Input.wasPressed('escape')) {
          if (this.pauseOpenLocal) this.resume(); else this.pause();
          Input.pressed['escape'] = false;
        }
        if (this.shopOpenLocal || this.workbenchOpenLocal || this.inventoryOpenLocal || this.trainingOpenLocal || this.pauseOpenLocal || this.atmOpenLocal) {
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
      if (this.trainingOpenLocal && (Input.wasPressed('f') || Input.wasPressed('escape'))) {
        this.closeTrainingRange();
        Input.pressed['f'] = false;
        Input.pressed['escape'] = false;
      }
      // still keep the guest in sync while we're in the shop/upgrade/gameover screens,
      // otherwise they freeze on the last 'playing' snapshot forever.
      if (this.mode === 'host') this.sendSnapshotThrottled(dt);
      Input.clearFrame();
      return;
    }
    if (Input.wasPressed('escape')) {
      if (this.pauseOpenLocal) this.resume();
      else this.pause();
      // solo pause freezes the sim (return early); co-op pause is a personal overlay
      // that must NOT stop the host simulating for the partner, so fall through.
      if (this.mode === 'solo') { Input.clearFrame(); return; }
      Input.pressed['escape'] = false;
    }

    this.playTime += dt;
    // convert mouse to world
    Input.mouse.worldX = this.cam.x + Input.mouse.x / this.zoom;
    Input.mouse.worldY = this.cam.y + Input.mouse.y / this.zoom;

    // workbench + shop + training range interact ("press F")
    this.nearWorkbench = this.workbench && Utils.dist(this.player.x, this.player.y, this.workbench.x, this.workbench.y) < this.workbench.interactRange;
    this.nearShop = this.shopTable && Utils.dist(this.player.x, this.player.y, this.shopTable.x, this.shopTable.y) < this.shopTable.interactRange;
    this.nearTrainingRange = this.trainingRange && Utils.dist(this.player.x, this.player.y, this.trainingRange.x, this.trainingRange.y) < this.trainingRange.interactRange;
    this.nearAtm = this.atm && (this.mode !== 'solo') && Utils.dist(this.player.x, this.player.y, this.atm.x, this.atm.y) < this.atm.interactRange;
    if (!this.workbenchOpenLocal && !this.shopOpenLocal && !this.trainingOpenLocal && !this.atmOpenLocal && Input.wasPressed('f')) {
      if (this.nearWorkbench) this.openWorkbench();
      else if (this.nearShop) this.openShopFromWorld();
      else if (this.nearTrainingRange) this.openTrainingRange();
      else if (this.nearAtm) this.openAtm();
      Input.pressed['f'] = false;
    }

    this.updateExtraction(dt);

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
    for (const gp of this.grenadePickups) gp.update(dt, this);
    this.grenadePickups = this.grenadePickups.filter((gp) => !gp.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.lightningArcs) {
      for (const arc of this.lightningArcs) arc.life -= dt;
      this.lightningArcs = this.lightningArcs.filter((a) => a.life > 0);
    }
    this.particles.update(dt);

    this.updateCamera(dt);

    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    if (this.damageVignette > 0) this.damageVignette = Math.max(0, this.damageVignette - dt * 2);
    if (this.flashWhiteout > 0) this.flashWhiteout = Math.max(0, this.flashWhiteout - dt);
    if (this.intermissionTimer > 0) this.intermissionTimer = Math.max(0, this.intermissionTimer - dt);

    // wave clear?
    if (this.waves.isCleared()) this.endWave();

    this.ui.updateHUD(this);
    Input.clearFrame();
    if (this.player2 && this.player2.isRemote) this.player2.input.clearFrame();

    if (this.mode === 'host') this.sendSnapshotThrottled(dt);
  }

  sendSnapshotThrottled(dt) {
    this._snapshotTimer -= dt;
    if (this._snapshotTimer > 0) return;
    // Rate matters a lot: a snapshot is a full JSON dump of every player, enemy,
    // projectile and coin, so sending one per frame (60/s) buries both the host
    // (stringify) and the guest (parse + GC) in work. The guest interpolates
    // between snapshots, so 30/s renders just as smoothly for half the cost.
    this._snapshotTimer = 1 / 30;
    Net.sendSnapshot(this.buildSnapshot());
  }

  buildSnapshot() {
    // Positions are rounded to whole pixels before they go on the wire: raw floats
    // serialize as ~18 characters each ("1234.5678901234567"), which dwarfs every
    // other field and makes the payload several times larger for sub-pixel accuracy
    // nobody can see.
    const r = Math.round;
    return {
      state: this.state,
      gameMode: this.gameMode,
      wave: this.waves ? this.waves.wave : 1,
      enemiesLeft: this.waves ? this.waves.totalRemaining() : 0,
      intermissionTimer: this.intermissionTimer || 0,
      extractProgress: this.extractProgress || 0,
      layoutIndex: this.world ? this.world.layoutIndex : 0,
      shopUpgradeIds: this.shopUpgradeIds || [],
      cam: { x: this.cam.x, y: this.cam.y },
      players: this.players.map((p) => ({
        x: r(p.x), y: r(p.y), aimAngle: p.aimAngle, hp: r(p.hp), maxHp: p.maxHp,
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
        grenadeCount: p.grenadeCount || 0,
        charId: p.charId,
        scanTimer: p.scanTimer || 0,
        scanTargetX: p.scanTarget ? p.scanTarget.x : null,
        scanTargetY: p.scanTarget ? p.scanTarget.y : null,
      })),
      // id lets the guest match this to the enemy it already has (see applySnapshot);
      // radius/color are omitted because they're derivable from `type` via ENEMY_DEFS.
      enemies: this.enemies.map((e) => ({ id: e.id, x: r(e.x), y: r(e.y), hp: r(e.hp), maxHp: r(e.maxHp), type: e.type, hitFlash: e.hitFlash })),
      boss: this.boss && !this.boss.dead ? {
        x: this.boss.x, y: this.boss.y, radius: this.boss.radius, hp: this.boss.hp, maxHp: this.boss.maxHp,
        name: this.boss.name, phase2: this.boss.phase2, spin: this.boss.spin, hitFlash: this.boss.hitFlash,
        bossType: this.boss.bossType, legPhase: this.boss.legPhase, shielded: this.boss.shielded,
        blinkFlash: this.boss.blinkFlash,
      } : null,
      // Bullets travel in a straight line at constant speed, so shipping their real
      // velocity lets the guest advance them itself every frame instead of teleporting
      // them forward once per snapshot (they cover 25-50px between snapshots, which
      // reads as heavy stutter).
      projectiles: this.projectiles.map((pr) => ({ x: r(pr.x), y: r(pr.y), vx: r(pr.vx), vy: r(pr.vy), radius: pr.radius, color: pr.color, angle: pr.angle, aoe: pr.aoe })),
      enemyProjectiles: this.enemyProjectiles.map((ep) => ({ x: r(ep.x), y: r(ep.y), vx: r(ep.vx), vy: r(ep.vy), radius: ep.radius, color: ep.color, isHoming: ep.isHoming })),
      coins: this.coins.map((c) => ({ x: r(c.x), y: r(c.y) })),
      medkits: this.medkits.map((m) => ({ x: r(m.x), y: r(m.y), life: m.life })),
      grenadePickups: this.grenadePickups.map((gp) => ({ x: r(gp.x), y: r(gp.y), life: gp.life })),
      shakeAmt: this.shakeAmt,
      flashWhiteout: this.flashWhiteout,
    };
  }

  applySnapshot(s) {
    if (!this.world) return; // not ready yet
    const prevSync = this._syncState;
    this._syncState = s.state;
    this.state = s.state;
    this.gameMode = s.gameMode || 'standard';
    if (this.waves) this.waves.wave = s.wave;
    this._enemiesLeft = s.enemiesLeft || 0;
    this.intermissionTimer = s.intermissionTimer || 0;
    this.extractProgress = s.extractProgress || 0;
    if (this.extractionPoint) {
      this.nearExtraction = Utils.dist(this.player2.x, this.player2.y, this.extractionPoint.x, this.extractionPoint.y) < this.extractionPoint.interactRange;
    }
    if (s.layoutIndex !== undefined && this.world && this.world.layoutIndex !== s.layoutIndex) {
      this.world = new World(s.layoutIndex);
      this.workbench = new Workbench(this.world.workbenchPos.x, this.world.workbenchPos.y);
    }
    // reconstruct the (identical) upgrade options the host rolled, so our menu matches
    if (s.shopUpgradeIds) {
      this.shopUpgradeIds = s.shopUpgradeIds;
      this.shopUpgrades = s.shopUpgradeIds.map((id) => UPGRADES.find((u) => u.id === id)).filter(Boolean);
    }

    const assign = (p, d) => Object.assign(p, d);
    if (s.players[0]) {
      const d = s.players[0];
      if (this.mode === 'guest') {
        this.player.targetX = d.x;
        this.player.targetY = d.y;
        if (this.player.x === undefined) { this.player.x = d.x; this.player.y = d.y; }
        this.player.aimAngle = d.aimAngle;
        this.player.hp = d.hp;
        this.player.maxHp = d.maxHp;
        this.player.coins = d.coins;
        this.player.score = d.score;
        this.player.kills = d.kills;
        this.player.currentWeapon = d.currentWeapon;
        if (!this.player.weapons[d.currentWeapon]) {
          this.player.weapons[d.currentWeapon] = { ammo: d.ammo };
        } else {
          this.player.weapons[d.currentWeapon].ammo = d.ammo;
        }
        this.player.reloading = d.reloading;
        this.player.reloadTimer = d.reloadTimer;
        this.player.reloadTotal = d.reloadTotal;
        this.player.dashCd = d.dashCd;
        this.player.hitFlash = d.hitFlash;
        this.player.invuln = d.invuln;
        this.player.walkPhase = d.walkPhase;
        this.player.shieldHp = d.shieldHp;
        this.player.charId = d.charId;
        this.player.meleeSwing = d.meleeSwing || 0;
        this.player.meleeArc = d.meleeArc || 0;
        this.player.meleeRange = d.meleeRange || 0;
        this.player.scanTimer = d.scanTimer || 0;
        this.player.scanTargetX = d.scanTargetX;
        this.player.scanTargetY = d.scanTargetY;
        if (!this.player.mods) this.player.mods = {};
        this.player.mods.visionRange = d.visionRange || 1;
      } else {
        assign(this.player, d);
      }
    }
    if (s.players[1] && this.player2) {
      const d = s.players[1];
      const localMenuOpen = this.shopOpenLocal || this.workbenchOpenLocal || this.inventoryOpenLocal || this.trainingOpenLocal || this.atmOpenLocal;
      if (this.mode === 'guest') {
        this.player2.targetX = d.x;
        this.player2.targetY = d.y;
        if (this.player2.x === undefined) { this.player2.x = d.x; this.player2.y = d.y; }
        const oldHp = this.player2.hp;
        const oldShield = this.player2.shieldHp;
        this.player2.aimAngle = d.aimAngle;
        this.player2.hp = d.hp;
        this.player2.maxHp = d.maxHp;
        this.player2.hitFlash = d.hitFlash;
        this.player2.invuln = d.invuln;
        this.player2.walkPhase = d.walkPhase;
        this.player2.shieldHp = d.shieldHp;
        this.player2.novaColaTimer = d.novaColaTimer || 0;
        this.player2.medkitsCount = d.medkitsCount || 0;
        this.player2.shieldsCount = d.shieldsCount || 0;
        this.player2.breadCount = d.breadCount || 0;
        this.player2.novacolaCount = d.novacolaCount || 0;
        this.player2.grenadeCount = d.grenadeCount || 0;
        this.player2.charId = d.charId;
        this.player2.meleeSwing = d.meleeSwing || 0;
        this.player2.meleeArc = d.meleeArc || 0;
        this.player2.meleeRange = d.meleeRange || 0;
        this.player2.scanTimer = d.scanTimer || 0;
        this.player2.scanTargetX = d.scanTargetX;
        this.player2.scanTargetY = d.scanTargetY;

        if (oldHp !== undefined && (d.hp < oldHp || (oldShield !== undefined && d.shieldHp < oldShield))) {
          this.damageVignette = 1;
        }
        if (!this.player2.mods) this.player2.mods = {};
        this.player2.mods.visionRange = d.visionRange || 1;

        if (!localMenuOpen || this.localPlayer !== this.player2) {
          this.player2.coins = d.coins;
          this.player2.score = d.score;
          this.player2.kills = d.kills;
          this.player2.currentWeapon = d.currentWeapon;
          if (!this.player2.weapons[d.currentWeapon]) {
            this.player2.weapons[d.currentWeapon] = { ammo: d.ammo };
          } else {
            this.player2.weapons[d.currentWeapon].ammo = d.ammo;
          }
          this.player2.reloading = d.reloading;
          this.player2.reloadTimer = d.reloadTimer;
          this.player2.reloadTotal = d.reloadTotal;
          this.player2.dashCd = d.dashCd;
        }
      } else {
        if (localMenuOpen && this.localPlayer === this.player2) {
          this.player2.x = d.x; this.player2.y = d.y; this.player2.aimAngle = d.aimAngle;
          this.player2.hp = d.hp; this.player2.maxHp = d.maxHp; this.player2.hitFlash = d.hitFlash;
          this.player2.invuln = d.invuln; this.player2.walkPhase = d.walkPhase; this.player2.shieldHp = d.shieldHp;
          this.player2.novaColaTimer = d.novaColaTimer || 0;
          this.player2.medkitsCount = d.medkitsCount || 0;
          this.player2.shieldsCount = d.shieldsCount || 0;
          this.player2.breadCount = d.breadCount || 0;
          this.player2.novacolaCount = d.novacolaCount || 0;
          this.player2.grenadeCount = d.grenadeCount || 0;
        } else {
          assign(this.player2, d);
          if (!this.player2.mods) this.player2.mods = {};
          this.player2.mods.visionRange = d.visionRange || 1;
        }
      }
    }

    if (this.mode === 'guest') {
      // Match by stable id, never by array index: the host filters out dead enemies,
      // so indices shift and index-matching would make survivors interpolate towards
      // some other enemy's position (a slide across the map that looks like lag).
      const incomingEnemies = s.enemies || [];
      const byId = this._enemyById || (this._enemyById = new Map());
      const next = [];
      for (const d of incomingEnemies) {
        let e = byId.get(d.id);
        if (!e) {
          const def = ENEMY_DEFS[d.type] || {};
          e = Object.assign(Object.create(Enemy.prototype), d, {
            def, radius: def.radius, color: def.color, dead: false,
            x: d.x, y: d.y, phase: Utils.rand(0, 6.28), wanderAngle: null, state: 'alerted',
          });
          byId.set(d.id, e);
        } else {
          e.hp = d.hp;
          e.maxHp = d.maxHp;
          e.hitFlash = d.hitFlash;
        }
        e.targetX = d.x;
        e.targetY = d.y;
        next.push(e);
      }
      // drop entries the host no longer reports, so the id map can't grow forever
      if (byId.size > next.length) {
        const live = new Set(next.map((e) => e.id));
        for (const id of byId.keys()) if (!live.has(id)) byId.delete(id);
      }
      this.enemies = next;
    } else {
      this.enemies = s.enemies.map((d) => Object.assign(Object.create(Enemy.prototype), d, { draw: Enemy.prototype.draw, dead: false }));
    }

    if (s.boss) {
      if (this.mode === 'guest') {
        if (this.boss) {
          this.boss.targetX = s.boss.x;
          this.boss.targetY = s.boss.y;
          this.boss.radius = s.boss.radius;
          this.boss.hp = s.boss.hp;
          this.boss.maxHp = s.boss.maxHp;
          this.boss.name = s.boss.name;
          this.boss.phase2 = s.boss.phase2;
          this.boss.spin = s.boss.spin;
          this.boss.hitFlash = s.boss.hitFlash;
          this.boss.bossType = s.boss.bossType;
          this.boss.legPhase = s.boss.legPhase;
          this.boss.shielded = s.boss.shielded;
        } else {
          this.boss = Object.assign(Object.create(Boss.prototype), s.boss, { dead: false });
          this.boss.targetX = s.boss.x;
          this.boss.targetY = s.boss.y;
          this.boss.x = s.boss.x;
          this.boss.y = s.boss.y;
        }
      } else {
        this.boss = Object.assign(Object.create(Boss.prototype), s.boss, { dead: false });
      }
    } else {
      this.boss = null;
    }

    // vx/vy now come from the host, so bullets keep their true speed (they used to be
    // hardcoded to 500, which was wrong for every weapon) and the guest can advance
    // them between snapshots — see the dead-reckoning step in update().
    this.projectiles = s.projectiles.map((d) => Object.assign(Object.create(Projectile.prototype), d, { trail: [] }));
    this.enemyProjectiles = s.enemyProjectiles;
    this.coins = s.coins.map((d) => new Coin(d.x, d.y));
    this.medkits = s.medkits.map((d) => { const m = new Medkit(d.x, d.y); m.life = d.life; return m; });
    this.grenadePickups = (s.grenadePickups || []).map((d) => { const gp = new GrenadePickup(d.x, d.y); gp.life = d.life; return gp; });
    this.shakeAmt = s.shakeAmt;
    this.flashWhiteout = s.flashWhiteout || 0;

    // ----- menu / phase handling (guest) -----
    if (s.state === 'gameover') {
      this.ui.showHUD(false);
      this.ui.showGameOver({ wave: s.wave, kills: this.localPlayer.kills, score: this.localPlayer.score, coins: this.localPlayer.coins, time: '--:--' });
      Menus.show('gameover-menu');
    } else if (s.state === 'extracted') {
      this.ui.showHUD(false);
      this.ui.showExtractSuccess({ wave: s.wave, kills: this.localPlayer.kills, score: this.localPlayer.score, coins: this.localPlayer.coins, time: '--:--' });
      Menus.show('extract-menu');
    } else if (s.state === 'shop') {
      // enter my own intermission exactly once (when the wave first ends)
      if (prevSync !== 'shop') this.beginLocalIntermission();
      // otherwise leave my local shop navigation alone
    } else if (s.state === 'playing') {
      // host started the next wave — leave the intermission, but never yank a
      // locally-open per-player overlay (shop/workbench/training/inventory)
      // closed out from under the guest just because a snapshot arrived —
      // that left the local "*OpenLocal" flags stuck true forever, which in
      // turn permanently blocked movement/shooting input for the guest.
      const localOverlayOpen = (this.shopOpenLocal && this.midWaveShop) ||
        this.workbenchOpenLocal || this.trainingOpenLocal || this.inventoryOpenLocal || this.pauseOpenLocal || this.atmOpenLocal;
      if (!localOverlayOpen) {
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
      // vs boss (squared-distance check — avoids a sqrt for every projectile/frame)
      if (this.boss && !this.boss.dead) {
        const bdx = pr.x - this.boss.x, bdy = pr.y - this.boss.y;
        const br = this.boss.radius + pr.radius;
        if (bdx * bdx + bdy * bdy < br * br) this.hitTarget(pr, this.boss);
      }
      if (pr.dead) continue;
      for (const e of this.enemies) {
        if (e.dead || pr.hitSet.has(e)) continue;
        const edx = pr.x - e.x, edy = pr.y - e.y;
        const er = e.radius + pr.radius;
        if (edx * edx + edy * edy < er * er) {
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
    // Was shake(10) — the artillery boss's mortarStrike lands 3-4 of these within
    // the same ~50ms window, which used to slam the shake cap every volley.
    this.shake(4);
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
      if (ep.isHoming) {
        const target = this.nearestPlayer(ep.x, ep.y);
        if (target && target.hp > 0) {
          const targetAngle = Math.atan2(target.y - ep.y, target.x - ep.x);
          const currentAngle = Math.atan2(ep.vy, ep.vx);
          
          let angleDiff = targetAngle - currentAngle;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          
          const maxTurn = 2.4 * dt; // turn speed
          const turn = Utils.clamp(angleDiff, -maxTurn, maxTurn);
          const newAngle = currentAngle + turn;
          
          const speed = Math.hypot(ep.vx, ep.vy);
          ep.vx = Math.cos(newAngle) * speed;
          ep.vy = Math.sin(newAngle) * speed;
        }

        // Spawn trailer smoke particles
        if (Math.random() < dt * 25) {
          this.particles.spawn(ep.x, ep.y, '#ff4400', { count: 1, minSpeed: 10, maxSpeed: 30, life: 0.25, size: 2 });
          this.particles.spawn(ep.x, ep.y, '#555555', { count: 1, minSpeed: 5, maxSpeed: 15, life: 0.4, size: 2.5 });
        }
      }

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
    // Was shake(8) — bosses that spam many simultaneous explosive projectiles
    // (e.g. the artillery "GOLIATH" burst, 12-20 shells at once, or mortarStrike's
    // 3-4 near-simultaneous landings) stacked several of these in the same frame,
    // slamming into the shake cap and holding the whole screen there.
    this.shake(3);
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
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cam.x + sx, -this.cam.y + sy);

    // 1. Draw elements that are hidden in the dark
    this.world.draw(ctx, this.cam, this.time);
    if (this.workbench) this.workbench.draw(ctx, this.time, this.nearWorkbench);
    if (this.shopTable) this.shopTable.draw(ctx, this.time, this.nearShop);
    if (this.atm && (this.mode !== 'solo')) this.atm.draw(ctx, this.time, this.nearAtm);
    if (this.extractionPoint) {
      const ready = this.waves.wave >= this.extractAvailableWave;
      const progress = this.extractChannelTime ? this.extractProgress / this.extractChannelTime : 0;
      this.extractionPoint.draw(ctx, this.time, ready, progress, this.nearExtraction && progress > 0);
    }
    if (this.trainingRange) this.trainingRange.draw(ctx, this.time, this.nearTrainingRange);
    for (const c of this.coins) c.draw(ctx, this.time);
    for (const m of this.medkits) m.draw(ctx, this.time);
    for (const s of this.shields) s.draw(ctx, this.time);
    for (const gp of this.grenadePickups) gp.draw(ctx, this.time);
    for (const e of this.enemies) e.draw(ctx, this.time);
    if (this.boss && !this.boss.dead) this.boss.draw(ctx, this.time);
    for (const p of this.players) if (p.hp > 0) p.draw(ctx, this.time);

    // 2. Apply Flashlight Mask (overlay in screen coordinates)
    if (this.gameMode === 'horror' || this.gameMode === 'standard' || this.gameMode === 'extraction') {
      ctx.save();
      ctx.setTransform(this.zoom, 0, 0, this.zoom, 0, 0);
      this.drawFlashlightMask(ctx);
      ctx.restore();
    }

    // 2.5 Draw active tactical scan lines on top of darkness mask
    for (const p of this.players) {
      const hasScan = p.hp > 0 && p.scanTimer > 0 && 
        ((p.scanTarget && !p.scanTarget.dead && p.scanTarget.hp > 0) || (this.mode === 'guest' && p.scanTargetX !== null && p.scanTargetX !== undefined));
      if (hasScan) {
        const alpha = Utils.clamp(p.scanTimer / 1.5, 0, 1);
        const tx = p.scanTarget ? p.scanTarget.x : p.scanTargetX;
        const ty = p.scanTarget ? p.scanTarget.y : p.scanTargetY;
        const radius = p.scanTarget ? (p.scanTarget.radius || 20) : 20;

        ctx.save();
        ctx.strokeStyle = `rgba(255, 30, 30, ${alpha * 0.8})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 30, 30, ${alpha * 0.95})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(tx, ty, radius + 12, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 30, 30, ${alpha * 0.95})`;
        const r = radius + 12;
        ctx.fillRect(tx - r - 4, ty - 2, 8, 4);
        ctx.fillRect(tx + r - 4, ty - 2, 8, 4);
        ctx.fillRect(tx - 2, ty - r - 4, 4, 8);
        ctx.fillRect(tx - 2, ty + r - 4, 4, 8);
        ctx.restore();
      }
    }

    // 3. Draw glowing elements on top of the dark overlay (projectiles, sparks, explosions)
    for (const ep of this.enemyProjectiles) {
      ctx.save();
      ctx.translate(ep.x, ep.y);
      const angle = Math.atan2(ep.vy, ep.vx);
      ctx.rotate(angle);
      
      if (ep.isHoming) {
        ctx.shadowBlur = 12; ctx.shadowColor = '#ff2b00';
        // Tail wings
        ctx.fillStyle = '#4c525a';
        ctx.fillRect(-10, -5, 4, 10);
        // Rocket body
        ctx.fillStyle = '#a6b0c2';
        ctx.fillRect(-7, -3, 11, 6);
        // Red tip cone
        ctx.fillStyle = '#ff2b00';
        ctx.beginPath();
        ctx.moveTo(4, -3);
        ctx.lineTo(10, 0);
        ctx.lineTo(4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.shadowBlur = 10; ctx.shadowColor = ep.color; ctx.fillStyle = ep.color;
        ctx.beginPath(); ctx.arc(0, 0, ep.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      ctx.restore();
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

    // co-op: arrow pointing at your teammate whenever they're off-screen, so you
    // always know which way to go to regroup
    if (this.mode !== 'solo' && this.state === 'playing') this.drawTeammateIndicator(ctx);

    // damage vignette
    if (this.damageVignette > 0) {
      const g = ctx.createRadialGradient(this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.3,
        this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.7);
      g.addColorStop(0, 'rgba(255,0,40,0)');
      g.addColorStop(1, 'rgba(255,0,40,' + (0.5 * this.damageVignette) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // flashbang whiteout (operative boss) — full-screen, decays from 1 to 0 over ~1s
    if (this.flashWhiteout > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + this.flashWhiteout + ')';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (this.inventoryOpenLocal) {
      this.ui.drawInventoryPreview(this);
    }
  }

  drawTeammateIndicator(ctx) {
    const me = this.localPlayer;
    const mate = this.players.find((p) => p !== me);
    if (!me || !mate) return;

    // still inside the camera view (with a margin so the arrow appears a beat
    // before they'd actually be cut off) — nothing to point at
    const margin = 60;
    const onScreen = mate.x > this.cam.x + margin && mate.x < this.cam.x + this.cam.w - margin &&
      mate.y > this.cam.y + margin && mate.y < this.cam.y + this.cam.h - margin;
    if (onScreen) return;

    const dx = mate.x - me.x, dy = mate.y - me.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const angle = Math.atan2(dy, dx);

    // clamp the arrow to just inside the screen edge, along the direction to the teammate
    const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    const pad = 50;
    const halfW = cx - pad, halfH = cy - pad;
    const scale = Math.min(Math.abs(halfW / (dx || 0.0001)), Math.abs(halfH / (dy || 0.0001)));
    const ex = cx + dx * scale, ey = cy + dy * scale;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(angle);
    const color = mate.hp <= 0 ? '#ff8a5b' : '#4af626'; // amber if they're downed, green otherwise
    ctx.fillStyle = color;
    ctx.shadowBlur = 10; ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-9, -10);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(5,10,5,0.8)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    // distance label just behind the arrow tip
    ctx.save();
    const lx = ex - Math.cos(angle) * 24, ly = ey - Math.sin(angle) * 24;
    ctx.fillStyle = '#eaffea';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(dist / 20) + 'm', lx, ly);
    ctx.restore();
  }

  drawFlashlightMask(ctx) {
    if (!this.maskCanvas) {
      this.maskCanvas = document.createElement('canvas');
      this.maskCtx = this.maskCanvas.getContext('2d');
    }
    if (!this.lightCanvas) {
      this.lightCanvas = document.createElement('canvas');
      this.lightCtx = this.lightCanvas.getContext('2d');
    }

    const targetW = Math.ceil(this.canvas.width / this.zoom);
    const targetH = Math.ceil(this.canvas.height / this.zoom);
    if (this.maskCanvas.width !== targetW || this.maskCanvas.height !== targetH) {
      this.maskCanvas.width = targetW;
      this.maskCanvas.height = targetH;
    }
    if (this.lightCanvas.width !== targetW || this.lightCanvas.height !== targetH) {
      this.lightCanvas.width = targetW;
      this.lightCanvas.height = targetH;
    }

    const mCtx = this.maskCtx;
    mCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

    const darkT = this.gameMode === 'horror' ? 1 : this.interiorT;

    // 1. Fill mask with default ambient darkness
    mCtx.fillStyle = 'rgba(7, 8, 12, ' + (0.58 * darkT) + ')';
    mCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

    // 2. Draw building dark covers (fog of war / roofs) ON the mask canvas
    const localPlayer = this.localPlayer;
    if (localPlayer) {
      const activeBuilding = this.world.getBuildingAt(localPlayer.x, localPlayer.y);
      for (const h of this.world.hangars) {
        const coverOpacity = h === activeBuilding ? 0.99 * (1 - darkT) : 0.99;
        
        if (coverOpacity > 0.01) {
          // Draw metallic dark cover over building interior
          mCtx.fillStyle = 'rgba(6, 7, 10, ' + coverOpacity + ')';
          mCtx.fillRect(h.x - this.cam.x + 20, h.y - this.cam.y + 20, h.w - 40, h.h - 40);

          // Draw metallic panels panel-grid overlay
          mCtx.strokeStyle = 'rgba(20, 24, 30, ' + coverOpacity + ')';
          mCtx.lineWidth = 3;
          mCtx.strokeRect(h.x - this.cam.x + 20, h.y - this.cam.y + 20, h.w - 40, h.h - 40);
          mCtx.beginPath();
          mCtx.moveTo(h.x - this.cam.x + 20, h.y - this.cam.y + 20);
          mCtx.lineTo(h.x - this.cam.x + h.w - 20, h.y - this.cam.y + h.h - 20);
          mCtx.moveTo(h.x - this.cam.x + h.w - 20, h.y - this.cam.y + 20);
          mCtx.lineTo(h.x - this.cam.x + 20, h.y - this.cam.y + h.h - 20);
          mCtx.stroke();
        }
      }
    }

    const castShadowOnCtx = (targetCtx, screenX, screenY, ax, ay, bx, by) => {
      const dxA = ax - screenX;
      const dyA = ay - screenY;
      const distA = Math.sqrt(dxA * dxA + dyA * dyA);
      if (distA === 0) return;

      const dxB = bx - screenX;
      const dyB = by - screenY;
      const distB = Math.sqrt(dxB * dxB + dyB * dyB);
      if (distB === 0) return;

      const projAx = ax + (dxA / distA) * 2000;
      const projAy = ay + (dyA / distA) * 2000;
      const projBx = bx + (dxB / distB) * 2000;
      const projBy = by + (dyB / distB) * 2000;

      targetCtx.beginPath();
      targetCtx.moveTo(ax, ay);
      targetCtx.lineTo(bx, by);
      targetCtx.lineTo(projBx, projBy);
      targetCtx.lineTo(projAx, projAy);
      targetCtx.closePath();
      targetCtx.fill();
    };

    // 3. Project shadows for walls to restore darkness behind them on main mask canvas
    if (darkT > 0.01) {
      mCtx.globalCompositeOperation = 'source-over';
      const shadowOpacity = 0.50 + 0.30 * darkT;
      mCtx.fillStyle = 'rgba(7, 8, 12, ' + shadowOpacity + ')';
      
      for (const p of this.players) {
        if (p.hp <= 0) continue;

        const screenX = p.x - this.cam.x;
        const screenY = p.y - this.cam.y;
        const visionMult = p.mods.visionRange || 1;
        const range = 540 * visionMult;
        const maxShadowDist = range + 150;

        for (const rect of this.world.rects) {
          if (rect.kind === 'enemy-barrier') continue;

          // Culling: check if rect is close to player
          const cx = rect.x + rect.w / 2;
          const cy = rect.y + rect.h / 2;
          if (Utils.dist(p.x, p.y, cx, cy) > maxShadowDist) continue;

          const rx = rect.x - this.cam.x;
          const ry = rect.y - this.cam.y;
          const rw = rect.w;
          const rh = rect.h;

          // Edge 1: top
          castShadowOnCtx(mCtx, screenX, screenY, rx, ry, rx + rw, ry);
          // Edge 2: right
          castShadowOnCtx(mCtx, screenX, screenY, rx + rw, ry, rx + rw, ry + rh);
          // Edge 3: bottom
          castShadowOnCtx(mCtx, screenX, screenY, rx + rw, ry + rh, rx, ry + rh);
          // Edge 4: left
          castShadowOnCtx(mCtx, screenX, screenY, rx, ry + rh, rx, ry);
        }
      }
    }

    // 4. For each player, generate their individual illumination mask and carve it out of the main mask canvas
    const lCtx = this.lightCtx;

    for (const p of this.players) {
      if (p.hp <= 0) continue;

      const screenX = p.x - this.cam.x;
      const screenY = p.y - this.cam.y;
      const visionMult = p.mods.visionRange || 1;
      const range = 540 * visionMult;
      const ambientRadius = 110 * visionMult;
      const coneHalfAngle = (42 * Math.PI / 180);
      const maxShadowDist = range + 150;

      // Clear temporary light canvas
      lCtx.clearRect(0, 0, targetW, targetH);

      // A. Draw this player's flashlight light on the light canvas
      lCtx.globalCompositeOperation = 'source-over';

      // 1. Ambient lighting around player
      let gradAmbient = lCtx.createRadialGradient(screenX, screenY, 0, screenX, screenY, ambientRadius);
      gradAmbient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      gradAmbient.addColorStop(0.6, 'rgba(255, 255, 255, 0.9)');
      gradAmbient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      
      lCtx.fillStyle = gradAmbient;
      lCtx.beginPath();
      lCtx.arc(screenX, screenY, ambientRadius, 0, Math.PI * 2);
      lCtx.fill();

      // 2. Directional cone
      lCtx.beginPath();
      lCtx.moveTo(screenX, screenY);
      lCtx.arc(screenX, screenY, range, p.aimAngle - coneHalfAngle, p.aimAngle + coneHalfAngle);
      lCtx.closePath();

      let gradCone = lCtx.createRadialGradient(screenX, screenY, ambientRadius * 0.5, screenX, screenY, range);
      gradCone.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      gradCone.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)'); // strong beam center
      gradCone.addColorStop(0.85, 'rgba(255, 255, 255, 0.6)');
      gradCone.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      
      lCtx.fillStyle = gradCone;
      lCtx.fill();

      // B. Carve out this player's own shadows from their light canvas
      lCtx.globalCompositeOperation = 'destination-out';
      lCtx.fillStyle = 'rgba(0, 0, 0, 1.0)';

      for (const rect of this.world.rects) {
        if (rect.kind === 'enemy-barrier') continue;

        // Culling: check if rect is close to player
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        if (Utils.dist(p.x, p.y, cx, cy) > maxShadowDist) continue;

        const rx = rect.x - this.cam.x;
        const ry = rect.y - this.cam.y;
        const rw = rect.w;
        const rh = rect.h;

        // Edge 1: top
        castShadowOnCtx(lCtx, screenX, screenY, rx, ry, rx + rw, ry);
        // Edge 2: right
        castShadowOnCtx(lCtx, screenX, screenY, rx + rw, ry, rx + rw, ry + rh);
        // Edge 3: bottom
        castShadowOnCtx(lCtx, screenX, screenY, rx + rw, ry + rh, rx, ry + rh);
        // Edge 4: left
        castShadowOnCtx(lCtx, screenX, screenY, rx, ry + rh, rx, ry);
      }

      // C. Carve this player's lit area out of the main mask canvas
      mCtx.globalCompositeOperation = 'destination-out';
      mCtx.drawImage(this.lightCanvas, 0, 0);
    }

    // 5. Draw the final mask on top of the main canvas
    mCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.maskCanvas, 0, 0);

    // 6. Draw subtle volumetric dust/beam reflection
    for (const p of this.players) {
      if (p.hp <= 0) continue;

      const screenX = p.x - this.cam.x;
      const screenY = p.y - this.cam.y;
      const visionMult = p.mods.visionRange || 1;
      const range = 540 * visionMult;
      const coneHalfAngle = (42 * Math.PI / 180);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.arc(screenX, screenY, range, p.aimAngle - coneHalfAngle, p.aimAngle + coneHalfAngle);
      ctx.closePath();

      let beamGrad = ctx.createRadialGradient(screenX, screenY, 20, screenX, screenY, range);
      beamGrad.addColorStop(0, 'rgba(235, 245, 255, 0.12)');
      beamGrad.addColorStop(0.5, 'rgba(235, 245, 255, 0.06)');
      beamGrad.addColorStop(1, 'rgba(235, 245, 255, 0.0)');
      
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
    let target = this.localPlayer || this.player;
    // spectate the surviving teammate while downed, instead of freezing on the death spot
    if (target && target.hp <= 0) {
      const alive = this.players.find((p) => p !== target && p.hp > 0);
      if (alive) target = alive;
    }
    if (!target) return;
    const tx = target.x - this.cam.w / 2;
    const ty = target.y - this.cam.h / 2;
    this.cam.x = Utils.lerp(this.cam.x, tx, 0.12);
    this.cam.y = Utils.lerp(this.cam.y, ty, 0.12);
    this.cam.x = Utils.clamp(this.cam.x, -300, Math.max(0, this.world.w - this.cam.w));
    this.cam.y = Utils.clamp(this.cam.y, 0, Math.max(0, this.world.h - this.cam.h));
  }

  openAtm() {
    this.atmOpenLocal = true;
    const me = this.localPlayer;
    document.getElementById('atm-my-coins').textContent = me.coins;
    document.getElementById('atm-amount').value = Math.min(10, me.coins);
    document.getElementById('atm-amount').max = me.coins;
    Menus.show('atm-menu');
  }

  closeAtm() {
    this.atmOpenLocal = false;
    Menus.hideAll();
  }

  sendCoinsFromAtm(amount) {
    const me = this.localPlayer;
    if (me.coins < amount) {
      alert("Nicht genügend Münzen!");
      return;
    }
    
    // Deduct coins locally
    me.coins -= amount;
    
    // If guest, send network action to host
    if (this.mode === 'guest') {
      Net.sendAtmAction({ action: 'send-coins', amount });
    } else if (this.mode === 'host') {
      // Host increases player 2's coins
      if (this.player2) {
        this.player2.coins += amount;
      }
    }
    
    this.closeAtm();
    
    // Spawn some success particles at the ATM
    this.particles.burst(this.atm.x, this.atm.y, '#ffbb00', 8, 80);
    Audio2.shoot('plasma');
  }

  onGuestAtmAction(msg) {
    if (msg.action === 'send-coins') {
      const amount = msg.amount;
      // Host receives coins from guest (player 2)
      if (this.player2 && this.player2.coins >= amount) {
        this.player2.coins -= amount;
        this.player.coins += amount;
        
        // Spawn success particles
        this.particles.burst(this.atm.x, this.atm.y, '#ffbb00', 8, 80);
        Audio2.shoot('plasma');
      }
    }
  }
}
