// ---------- game.js : core loop & state machine ----------
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = new UI();
    this.state = 'menu'; // menu | playing | paused | shop | gameover
    this.cam = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    this.time = 0; this.dt = 0;
    this.shakeAmt = 0;
    this.damageVignette = 0;
    this.hpMult = 1; this.dmgMult = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.cam.w = this.canvas.width; this.cam.h = this.canvas.height;
  }

  newGame() {
    this.world = new World();
    this.player = new Player(this.world.w / 2, this.world.h / 2);
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.enemies = [];
    this.boss = null;
    this.coins = [];
    this.particles = new Particles();
    this.waves = new WaveManager(this);
    this.playTime = 0;
    this.cam.x = this.player.x - this.cam.w / 2;
    this.cam.y = this.player.y - this.cam.h / 2;
    this.state = 'playing';
    this.ui.showHUD(true);
    this.waves.startWave(1);
  }

  shake(a) { this.shakeAmt = Math.min(this.shakeAmt + a, 22); }

  // ----- events -----
  onEnemyKilled(e) {
    this.player.kills++;
    this.player.score += e.def.score;
    Audio2.enemyDie();
    this.particles.burst(e.x, e.y, e.color, 12, 200);
    this.dropCoins(e.x, e.y, e.def.coins);
    if (Utils.chance(this.player.mods.lifesteal)) this.player.heal(5);
  }

  onBossKilled(b) {
    this.player.kills++;
    this.player.score += b.score;
    Audio2.explosion();
    this.shake(20);
    this.particles.burst(b.x, b.y, '#ff3b52', 60, 340);
    this.particles.burst(b.x, b.y, '#ffcc33', 30, 260);
    this.dropCoins(b.x, b.y, b.coins);
  }

  dropCoins(x, y, range) {
    let n = Utils.randInt(range[0], range[1]);
    n = Math.round(n * this.player.mods.coinMult);
    for (let i = 0; i < n; i++) {
      this.coins.push(new Coin(x + Utils.rand(-20, 20), y + Utils.rand(-20, 20), 1));
    }
  }

  onPlayerDeath() {
    this.state = 'gameover';
    this.ui.showHUD(false);
    const mins = Math.floor(this.playTime / 60), secs = Math.floor(this.playTime % 60);
    this.ui.showGameOver({
      wave: this.waves.wave, kills: this.player.kills, score: this.player.score,
      coins: this.player.coins, time: mins + ':' + String(secs).padStart(2, '0'),
    });
    Menus.show('gameover-menu');
  }

  // ----- wave lifecycle -----
  endWave() {
    // auto-collect remaining coins
    for (const c of this.coins) { this.player.coins += c.value; }
    this.coins = [];
    this.boss = null;
    this.shopUpgrades = rollShopUpgrades();
    this.state = 'shop';
    this.ui.showHUD(false);
    this.ui.showShop(this);
    Menus.show('shop-menu');
  }

  closeShop() {
    Menus.hideAll();
    this.state = 'playing';
    this.ui.showHUD(true);
    this.waves.startWave(this.waves.wave + 1);
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

    if (this.state !== 'playing') { Input.clearFrame(); return; }
    if (Input.wasPressed('escape')) { this.pause(); Input.clearFrame(); return; }

    this.playTime += dt;
    // convert mouse to world
    Input.mouse.worldX = this.cam.x + Input.mouse.x;
    Input.mouse.worldY = this.cam.y + Input.mouse.y;

    this.world.update(dt);
    this.player.update(dt, this);
    this.waves.update(dt);

    for (const e of this.enemies) e.update(dt, this);
    if (this.boss && !this.boss.dead) this.boss.update(dt, this);

    this.updateProjectiles(dt);
    this.updateEnemyProjectiles(dt);

    for (const c of this.coins) c.update(dt, this);
    this.coins = this.coins.filter((c) => !c.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.particles.update(dt);

    // camera smooth follow
    const tx = this.player.x - this.cam.w / 2;
    const ty = this.player.y - this.cam.h / 2;
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
      this.explode(pr.x, pr.y, pr.aoe, pr.damage);
      pr.dead = true;
      return;
    }
    target.takeDamage(pr.damage, this);
    pr.hitSet.add(target);
    this.particles.spawn(pr.x, pr.y, pr.color, { count: 5, angle: pr.angle, spread: 1.2, minSpeed: 40, maxSpeed: 130, life: 0.2, size: 3 });
    if (pr.hitSet.size > pr.pierce) pr.dead = true;
  }

  explode(x, y, radius, dmg) {
    this.particles.burst(x, y, '#ffb14d', 24, 260);
    this.particles.burst(x, y, '#b14dff', 16, 200);
    Audio2.explosion();
    this.shake(10);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Utils.dist(x, y, e.x, e.y);
      if (d < radius + e.radius) e.takeDamage(dmg * (1 - d / (radius + e.radius) * 0.5), this);
    }
    if (this.boss && !this.boss.dead && Utils.dist(x, y, this.boss.x, this.boss.y) < radius + this.boss.radius) {
      this.boss.takeDamage(dmg, this);
    }
  }

  updateEnemyProjectiles(dt) {
    for (const ep of this.enemyProjectiles) {
      ep.x += ep.vx * dt; ep.y += ep.vy * dt;
      ep.life -= dt;
      if (ep.life <= 0 || pointInRects(ep.x, ep.y, this.world.rects, ep.radius)) { ep.dead = true; continue; }
      if (Utils.dist(ep.x, ep.y, this.player.x, this.player.y) < this.player.radius + ep.radius) {
        this.player.takeDamage(ep.dmg, this);
        ep.dead = true;
      }
    }
    this.enemyProjectiles = this.enemyProjectiles.filter((e) => !e.dead);
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

    this.world.draw(ctx, this.cam, this.time);
    for (const c of this.coins) c.draw(ctx, this.time);
    for (const ep of this.enemyProjectiles) {
      ctx.shadowBlur = 10; ctx.shadowColor = ep.color; ctx.fillStyle = ep.color;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, ep.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    for (const e of this.enemies) e.draw(ctx, this.time);
    if (this.boss && !this.boss.dead) this.boss.draw(ctx, this.time);
    for (const pr of this.projectiles) pr.draw(ctx);
    this.particles.draw(ctx);
    this.player.draw(ctx, this.time);

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
