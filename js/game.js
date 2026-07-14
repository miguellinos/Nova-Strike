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
  newGame(mode, gameMode) {
    this.mode = mode || 'solo';
    this.gameMode = gameMode || 'standard';
    this.world = new World();
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
    this.particles = new Particles();
    this.waves = new WaveManager(this);
    this.playTime = 0;
    this.cam.x = this.player.x - this.cam.w / 2;
    this.cam.y = this.player.y - this.cam.h / 2;
    this.state = 'playing';
    this.midWaveShop = false;
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
    // auto-collect remaining coins for the whole squad
    for (const c of this.coins) { this.player.coins += c.value; }
    this.coins = [];
    this.medkits = [];
    this.shields = [];
    this.boss = null;
    this.shopUpgrades = rollShopUpgrades(this.gameMode);
    this.state = 'upgrade'; // Choose free upgrade first
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
        Input.mouse.worldX = this.cam.x + Input.mouse.x;
        Input.mouse.worldY = this.cam.y + Input.mouse.y;
        Net.sendInput({
          keys: { w: Input.key('w'), a: Input.key('a'), s: Input.key('s'), d: Input.key('d'), shift: Input.key('shift'), r: Input.key('r'),
                   '1': Input.key('1'), '2': Input.key('2'), '3': Input.key('3'), '4': Input.key('4'), '5': Input.key('5') },
          justPressed: Object.keys(Input.pressed).filter((k) => Input.pressed[k]),
          mouseWorldX: Input.mouse.worldX, mouseWorldY: Input.mouse.worldY, mouseDown: Input.mouse.down,
        });
      }
      this.ui.updateHUD(this);
      Input.clearFrame();
      return;
    }

    if (this.state !== 'playing') {
      // still keep the guest in sync while we're in the shop/upgrade/gameover screens,
      // otherwise they freeze on the last 'playing' snapshot forever.
      if (this.mode === 'host') Net.sendSnapshot(this.buildSnapshot());
      Input.clearFrame();
      return;
    }
    if (Input.wasPressed('escape')) { this.pause(); Input.clearFrame(); return; }

    this.playTime += dt;
    // convert mouse to world
    Input.mouse.worldX = this.cam.x + Input.mouse.x;
    Input.mouse.worldY = this.cam.y + Input.mouse.y;

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
    this.particles.update(dt);

    // camera smooth follow (midpoint of the squad in co-op)
    const midX = this.players.reduce((s, p) => s + p.x, 0) / this.players.length;
    const midY = this.players.reduce((s, p) => s + p.y, 0) / this.players.length;
    const tx = midX - this.cam.w / 2;
    const ty = midY - this.cam.h / 2;
    this.cam.x = Utils.lerp(this.cam.x, tx, 0.12);
    this.cam.y = Utils.lerp(this.cam.y, ty, 0.12);
    this.cam.x = Utils.clamp(this.cam.x, 0, Math.max(0, this.world.w - this.cam.w));
    this.cam.y = Utils.clamp(this.cam.y, 0, Math.max(0, this.world.h - this.cam.h));

    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    if (this.damageVignette > 0) this.damageVignette = Math.max(0, this.damageVignette - dt * 2);

    // wave clear?
    if (this.waves.isCleared()) this.endWave();

    this.ui.updateHUD(this);
    Input.clearFrame();
    if (this.player2 && this.player2.isRemote) this.player2.input.clearFrame();

    if (this.mode === 'host') Net.sendSnapshot(this.buildSnapshot());
  }

  buildSnapshot() {
    return {
      state: this.state,
      gameMode: this.gameMode,
      wave: this.waves ? this.waves.wave : 1,
      enemiesLeft: this.waves ? this.waves.totalRemaining() : 0,
      cam: { x: this.cam.x, y: this.cam.y },
      players: this.players.map((p) => ({
        x: p.x, y: p.y, aimAngle: p.aimAngle, hp: p.hp, maxHp: p.maxHp,
        coins: p.coins, score: p.score, kills: p.kills,
        currentWeapon: p.currentWeapon, ammo: p.weapons[p.currentWeapon].ammo, magSize: p.magSize(),
        reloading: p.reloading, reloadTimer: p.reloadTimer, reloadTotal: p.reloadTotal,
        dashCd: p.dashCd, dashCdTotal: p.dashCooldown(), hitFlash: p.hitFlash, invuln: p.invuln, walkPhase: p.walkPhase,
        visionRange: p.mods.visionRange,
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
    this.state = s.state;
    this.gameMode = s.gameMode || 'standard';
    if (this.waves) this.waves.wave = s.wave;
    this._enemiesLeft = s.enemiesLeft;
    this.cam.x = s.cam.x; this.cam.y = s.cam.y;

    const assign = (p, d) => Object.assign(p, d);
    if (s.players[0]) {
      assign(this.player, s.players[0]);
      if (!this.player.mods) this.player.mods = {};
      this.player.mods.visionRange = s.players[0].visionRange || 1;
    }
    if (s.players[1] && this.player2) {
      assign(this.player2, s.players[1]);
      if (!this.player2.mods) this.player2.mods = {};
      this.player2.mods.visionRange = s.players[1].visionRange || 1;
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

    if (s.state === 'upgrade') { this.ui.showHUD(false); this.ui.showUpgradeChoices(this); Menus.show('upgrade-menu'); }
    else if (s.state === 'shop') { this.ui.showHUD(false); this.ui.showTacticalShop(this); Menus.show('shop-menu'); }
    else if (s.state === 'gameover') { this.ui.showHUD(false); this.ui.showGameOver({ wave: s.wave, kills: this.localPlayer.kills, score: this.localPlayer.score, coins: this.localPlayer.coins, time: '--:--' }); Menus.show('gameover-menu'); }
    else if (s.state === 'playing') { this.ui.showHUD(true); Menus.hideAll(); }
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
    pr.hitSet.add(target);
    this.particles.spawn(pr.x, pr.y, pr.color, { count: 5, angle: pr.angle, spread: 1.2, minSpeed: 40, maxSpeed: 130, life: 0.2, size: 3 });
    if (pr.hitSet.size > pr.pierce) pr.dead = true;
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
}
