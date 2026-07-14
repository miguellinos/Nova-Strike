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
    this.name = 'MAMMUT-PANZER "LEVIATHAN"';
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

    // phase transition (damaged/furious state)
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
      // radial artillery burst
      const n = this.phase2 ? 24 : 16;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260,
          radius: 9, dmg: this.dmg * 0.6, color: '#ff8a3b', dead: false, life: 4 });
      }
      Audio2.explosion();
    } else if (i === 1) {
      // charge / ram speed
      this.charging = 0.7; this.chargeDir = { x: Math.cos(ang), y: Math.sin(ang) };
      game.shake(6);
    } else if (i === 2) {
      // call reinforcements (infantry soldiers)
      for (let k = 0; k < (this.phase2 ? 4 : 2); k++) {
        game.enemies.push(new Enemy('drone', this.x + Utils.rand(-80, 80), this.y + Utils.rand(-80, 80), game.hpMult, game.dmgMult));
      }
      Audio2.enemyDie();
    } else {
      // heavy tactical shell spread
      for (let k = -3; k <= 3; k++) {
        const a = ang + k * 0.18;
        game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320,
          radius: 11, dmg: this.dmg * 0.7, color: '#ff3a22', dead: false, life: 4 });
      }
      Audio2.shoot('cannon');
    }
  }

  takeDamage(dmg, game) {
    this.hp -= dmg;
    this.hitFlash = 0.08;
    game.particles.spawn(this.x, this.y, '#39472e', { count: 4, minSpeed: 60, maxSpeed: 150, size: 4 });
    if (this.hp <= 0 && !this.dead) { this.dead = true; game.onBossKilled(this); }
  }

  draw(ctx, time) {
    const flash = this.hitFlash > 0;
    
    // get angle towards player
    const p = window.game ? window.game.player : null;
    const angle = p ? Math.atan2(p.y - this.y, p.x - this.x) : this.spin * 0.2;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // 1. Draw double tank tracks (huge, left and right)
    ctx.fillStyle = '#181818';
    // left tracks
    ctx.fillRect(-this.radius * 0.95, -this.radius * 0.95, this.radius * 1.9, this.radius * 0.28);
    ctx.fillRect(-this.radius * 0.95, -this.radius * 0.62, this.radius * 1.9, this.radius * 0.28);
    // right tracks
    ctx.fillRect(-this.radius * 0.95, this.radius * 0.34, this.radius * 1.9, this.radius * 0.28);
    ctx.fillRect(-this.radius * 0.95, this.radius * 0.67, this.radius * 1.9, this.radius * 0.28);

    // Tracks outline details
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(-this.radius * 0.95, -this.radius * 0.95, this.radius * 1.9, this.radius * 0.28);
    ctx.strokeRect(-this.radius * 0.95, -this.radius * 0.62, this.radius * 1.9, this.radius * 0.28);
    ctx.strokeRect(-this.radius * 0.95, this.radius * 0.34, this.radius * 1.9, this.radius * 0.28);
    ctx.strokeRect(-this.radius * 0.95, this.radius * 0.67, this.radius * 1.9, this.radius * 0.28);

    // 2. Giant Chassis Body (camo green sloped plating)
    ctx.fillStyle = flash ? '#ffffff' : '#39472e';
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.85, -this.radius * 0.58);
    ctx.lineTo(this.radius * 0.65, -this.radius * 0.58);
    ctx.lineTo(this.radius * 0.85, -this.radius * 0.35);
    ctx.lineTo(this.radius * 0.85, this.radius * 0.35);
    ctx.lineTo(this.radius * 0.65, this.radius * 0.58);
    ctx.lineTo(-this.radius * 0.85, this.radius * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1f2619';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Camo shapes on chassis
    ctx.fillStyle = '#26301f';
    ctx.beginPath();
    ctx.ellipse(-this.radius * 0.3, -this.radius * 0.2, this.radius * 0.4, this.radius * 0.25, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(this.radius * 0.2, this.radius * 0.2, this.radius * 0.35, this.radius * 0.25, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Red warning lights / sirens (pulsing in phase 2)
    if (this.phase2) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 8);
      ctx.fillStyle = 'rgba(255, 0, 0, ' + pulse + ')';
      ctx.beginPath();
      ctx.arc(-this.radius * 0.6, -this.radius * 0.3, 6, 0, Math.PI * 2);
      ctx.arc(-this.radius * 0.6, this.radius * 0.3, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Huge Central Turret (rotatable armored circle)
    ctx.fillStyle = flash ? '#ffffff' : '#435437';
    ctx.beginPath();
    ctx.arc(-this.radius * 0.05, 0, this.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hatch doors
    ctx.fillStyle = '#1c2217';
    ctx.beginPath();
    ctx.arc(-this.radius * 0.18, -this.radius * 0.15, this.radius * 0.12, 0, Math.PI * 2);
    ctx.arc(-this.radius * 0.18, this.radius * 0.15, this.radius * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // 4. Dual Cannon Barrels
    ctx.fillStyle = '#1a1a1a';
    // left barrel
    ctx.fillRect(this.radius * 0.3, -this.radius * 0.18, this.radius * 0.95, this.radius * 0.12);
    // right barrel
    ctx.fillRect(this.radius * 0.3, this.radius * 0.06, this.radius * 0.95, this.radius * 0.12);
    
    // Muzzle tips
    ctx.fillStyle = '#111';
    ctx.fillRect(this.radius * 1.25, -this.radius * 0.20, 6, this.radius * 0.16);
    ctx.fillRect(this.radius * 1.25, this.radius * 0.04, 6, this.radius * 0.16);

    ctx.restore();
  }
}
