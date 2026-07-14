// ---------- boss.js : boss with phases & attacks ----------
class Boss {
  constructor(x, y, waveNum) {
    this.x = x; this.y = y;
    this.radius = 60;
    const tier = Math.floor(waveNum / 5);
    this.maxHp = 2200 + tier * 1400;
    this.hp = this.maxHp;
    this.dmg = 26 + tier * 6;
    this.speed = 70;
    this.color = '#ff3b52';
    this.name = 'NOVA BEAST PRIME';
    this.dead = false;
    this.phase2 = false;
    this.touchTimer = 0;
    this.hitFlash = 0;
    // attack cycle
    this.attackTimer = 2;
    this.attackIndex = 0;
    this.charging = 0;
    this.chargeDir = { x: 0, y: 0 };
    this.spin = 0;
    this.coins = [50, 100];
    this.score = 1000;
  }

  update(dt, game) {
    const p = game.player;
    const ang = Utils.angle(this.x, this.y, p.x, p.y);
    const dist = Utils.dist(this.x, this.y, p.x, p.y);
    this.spin += dt;

    // phase transition
    if (!this.phase2 && this.hp < this.maxHp * 0.5) {
      this.phase2 = true;
      this.speed *= 1.6;
      game.shake(14);
      game.particles.burst(this.x, this.y, '#ff3b52', 40, 300);
      Audio2.bossSpawn();
    }
    const rate = this.phase2 ? 0.6 : 1;

    // movement
    let mx = Math.cos(ang), my = Math.sin(ang), spd = this.speed;
    if (this.charging > 0) {
      this.charging -= dt;
      mx = this.chargeDir.x; my = this.chargeDir.y; spd = 520;
    }
    this.x += mx * spd * dt; this.y += my * spd * dt;
    const res = resolveCircleRects(this.x, this.y, this.radius, game.world.rects);
    this.x = Utils.clamp(res.x, this.radius, game.world.w - this.radius);
    this.y = Utils.clamp(res.y, this.radius, game.world.h - this.radius);

    // touch dmg
    if (this.touchTimer > 0) this.touchTimer -= dt;
    if (dist < this.radius + p.radius && this.touchTimer <= 0) {
      p.takeDamage(this.dmg, game); this.touchTimer = 0.6;
    }

    // attack cycle
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackIndex = (this.attackIndex + 1) % 4;
      this.attackTimer = (2.4 * rate);
      this.doAttack(this.attackIndex, game, ang);
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  doAttack(i, game, ang) {
    if (i === 0) {
      // radial burst
      const n = this.phase2 ? 24 : 16;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260,
          radius: 9, dmg: this.dmg * 0.6, color: '#ff8a3b', dead: false, life: 4 });
      }
      Audio2.explosion();
    } else if (i === 1) {
      // charge at player
      this.charging = 0.7; this.chargeDir = { x: Math.cos(ang), y: Math.sin(ang) };
      game.shake(6);
    } else if (i === 2) {
      // summon minions
      for (let k = 0; k < (this.phase2 ? 4 : 2); k++) {
        const sp = game.world.randomSpawnPoint();
        game.enemies.push(new Enemy('drone', this.x + Utils.rand(-80, 80), this.y + Utils.rand(-80, 80), game.hpMult, game.dmgMult));
      }
      Audio2.enemyDie();
    } else {
      // energy field (aimed spread)
      for (let k = -3; k <= 3; k++) {
        const a = ang + k * 0.18;
        game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320,
          radius: 11, dmg: this.dmg * 0.7, color: '#b14dff', dead: false, life: 4 });
      }
      Audio2.shoot('cannon');
    }
  }

  takeDamage(dmg, game) {
    this.hp -= dmg;
    this.hitFlash = 0.08;
    game.particles.spawn(this.x, this.y, this.color, { count: 4, minSpeed: 60, maxSpeed: 150, size: 4 });
    if (this.hp <= 0 && !this.dead) { this.dead = true; game.onBossKilled(this); }
  }

  draw(ctx, time) {
    const r = this.radius + Math.sin(time * 3) * 4;
    ctx.shadowBlur = 40; ctx.shadowColor = this.phase2 ? '#ff3b52' : '#b14dff';
    ctx.fillStyle = this.hitFlash > 0 ? '#fff' : this.color;
    ctx.beginPath();
    const sides = 10;
    for (let i = 0; i < sides; i++) {
      const a = this.spin * 0.5 + (i / sides) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.7;
      const px = this.x + Math.cos(a) * rr, py = this.y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
    // core
    ctx.fillStyle = this.phase2 ? '#ffe08a' : '#2ff3ff';
    ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
}
