// ---------- boss.js : boss with phases & attacks ----------
const BOSS_TYPES = ['tank', 'spider', 'artillery'];

class Boss {
  constructor(x, y, waveNum, forcedType) {
    this.x = x; this.y = y;
    const tier = Math.floor(waveNum / 5);
    this.bossType = forcedType || BOSS_TYPES[(tier + Utils.randInt(0, 2)) % BOSS_TYPES.length];
    this.dead = false;
    this.phase2 = false;
    this.touchTimer = 0;
    this.hitFlash = 0;
    this.attackTimer = 2;
    this.attackIndex = 0;
    this.charging = 0;
    this.chargeDir = { x: 0, y: 0 };
    this.spin = 0;
    this.legPhase = 0;
    this.mortarTimer = 0;
    this.shielded = 0;
    this.burnT = 0; this.burnDps = 0; this.burnBy = null;
    this.slowT = 0;

    if (this.bossType === 'spider') {
      this.radius = 44;
      this.maxHp = 1500 + tier * 950;
      this.dmg = 22 + tier * 5;
      this.speed = 140;
      this.color = '#b14dff';
      this.name = 'ARACHNO-LÄUFER "WIDOW"';
      this.coins = [45, 90];
      this.score = 1100;
    } else if (this.bossType === 'artillery') {
      this.radius = 68;
      this.maxHp = 2800 + tier * 1700;
      this.dmg = 30 + tier * 7;
      this.speed = 40;
      this.color = '#ffaa00';
      this.name = 'SCHWERGESCHÜTZ "BASILISK"';
      this.coins = [60, 120];
      this.score = 1300;
    } else {
      this.radius = 60;
      this.maxHp = 2200 + tier * 1400;
      this.dmg = 26 + tier * 6;
      this.speed = 70;
      this.color = '#ff3b52';
      this.name = 'MAMMUT-PANZER "LEVIATHAN"';
      this.coins = [50, 100];
      this.score = 1000;
    }
    this.hp = this.maxHp;
  }

  applyBurn(dps, dur, by) {
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnT = Math.max(this.burnT, dur);
    this.burnBy = by || this.burnBy;
  }
  applySlow(dur) { this.slowT = Math.max(this.slowT, dur); }

  update(dt, game) {
    const p = game.nearestPlayer(this.x, this.y);
    const ang = Utils.angle(this.x, this.y, p.x, p.y);
    const dist = Utils.dist(this.x, this.y, p.x, p.y);
    this.spin += dt;

    // status effects
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.hp -= this.burnDps * dt;
      if (this.hp <= 0 && !this.dead) { this.dead = true; this.lastHitBy = this.burnBy; game.onBossKilled(this); return; }
    }
    let bossSlow = 1;
    if (this.slowT > 0) { this.slowT -= dt; bossSlow = 0.55; }

    // phase transition (damaged/furious state)
    if (!this.phase2 && this.hp < this.maxHp * 0.5) {
      this.phase2 = true;
      this.speed *= this.bossType === 'artillery' ? 1.2 : 1.6;
      game.shake(14);
      game.particles.burst(this.x, this.y, this.color, 40, 300);
      Audio2.bossSpawn();
      if (this.bossType === 'artillery') this.shielded = 2.5; // brief invuln while it "reloads" into fury mode
    }
    const rate = this.phase2 ? 0.6 : 1;
    this.legPhase += dt * (this.bossType === 'spider' ? 10 : 4);

    // movement — artillery keeps distance and kites instead of closing in
    let mx, my, spd = this.speed;
    if (this.bossType === 'artillery') {
      const keepDist = 380;
      if (dist < keepDist - 40) { mx = -Math.cos(ang); my = -Math.sin(ang); }
      else if (dist > keepDist + 40) { mx = Math.cos(ang); my = Math.sin(ang); }
      else { mx = -Math.sin(ang); my = Math.cos(ang); } // strafe
    } else {
      mx = Math.cos(ang); my = Math.sin(ang);
    }
    if (this.charging > 0) {
      this.charging -= dt;
      mx = this.chargeDir.x; my = this.chargeDir.y; spd = this.bossType === 'spider' ? 620 : 520;
    }
    this.x += mx * spd * bossSlow * dt; this.y += my * spd * bossSlow * dt;
    const res = resolveCircleRects(this.x, this.y, this.radius, game.world.rects);
    this.x = Utils.clamp(res.x, this.radius, game.world.w - this.radius);
    this.y = Utils.clamp(res.y, this.radius, game.world.h - this.radius);

    // touch dmg
    if (this.touchTimer > 0) this.touchTimer -= dt;
    if (dist < this.radius + p.radius && this.touchTimer <= 0) {
      p.takeDamage(this.dmg, game); this.touchTimer = 0.6;
    }

    if (this.shielded > 0) this.shielded -= dt;

    // artillery: periodic mortar rain on the player's position, independent of the main attack cycle
    if (this.bossType === 'artillery') {
      this.mortarTimer -= dt;
      if (this.mortarTimer <= 0) {
        this.mortarTimer = this.phase2 ? 2.6 : 3.6;
        this.mortarStrike(game, p);
      }
    }

    // attack cycle
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      const cycleLen = this.bossType === 'spider' ? 3 : 4;
      this.attackIndex = (this.attackIndex + 1) % cycleLen;
      this.attackTimer = (2.4 * rate);
      this.doAttack(this.attackIndex, game, ang);
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  mortarStrike(game, p) {
    const n = this.phase2 ? 4 : 3;
    for (let k = 0; k < n; k++) {
      const tx = p.x + Utils.rand(-90, 90);
      const ty = p.y + Utils.rand(-90, 90);
      game.particles.spawn(tx, ty, '#ff5c33', { count: 3, minSpeed: 20, maxSpeed: 60, life: 0.8, size: 3 });
      setTimeout(() => { if (!this.dead) game.explode(tx, ty, 70, this.dmg * 0.8, this); }, 750);
    }
  }

  doAttack(i, game, ang) {
    if (this.bossType === 'spider') { this.doSpiderAttack(i, game, ang); return; }
    if (this.bossType === 'artillery') { this.doArtilleryAttack(i, game, ang); return; }
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

  doSpiderAttack(i, game, ang) {
    if (i === 0) {
      // fast lunge dash at the player
      this.charging = 0.45; this.chargeDir = { x: Math.cos(ang), y: Math.sin(ang) };
      game.shake(5);
    } else if (i === 1) {
      // scatter web mines (small delayed-blast pods) around itself
      const n = this.phase2 ? 5 : 3;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + Utils.rand(-0.3, 0.3);
        const mx = this.x + Math.cos(a) * 90, my = this.y + Math.sin(a) * 90;
        game.particles.spawn(mx, my, '#b14dff', { count: 3, minSpeed: 20, maxSpeed: 50, life: 1.2, size: 3 });
        setTimeout(() => { if (!this.dead) game.explode(mx, my, 55, this.dmg * 0.55, this); }, 900);
      }
      Audio2.shoot('cannon');
    } else {
      // call spider-brood reinforcements
      for (let k = 0; k < (this.phase2 ? 3 : 2); k++) {
        game.enemies.push(new Enemy('striker', this.x + Utils.rand(-70, 70), this.y + Utils.rand(-70, 70), game.hpMult, game.dmgMult));
      }
      Audio2.enemyDie();
    }
  }

  doArtilleryAttack(i, game, ang) {
    if (i === 0) {
      // heavy radial shell burst
      const n = this.phase2 ? 20 : 12;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230,
          radius: 10, dmg: this.dmg * 0.6, color: '#ffaa00', dead: false, life: 4.5, isExplosive: true, aoe: 50 });
      }
      Audio2.explosion();
    } else if (i === 1) {
      // long-range aimed cannon volley
      for (let k = -2; k <= 2; k++) {
        const a = ang + k * 0.12;
        game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380,
          radius: 12, dmg: this.dmg * 0.8, color: '#ff3a22', dead: false, life: 3 });
      }
      Audio2.shoot('cannon');
    } else {
      // call in turret support drones
      for (let k = 0; k < (this.phase2 ? 4 : 2); k++) {
        game.enemies.push(new Enemy('shooter', this.x + Utils.rand(-100, 100), this.y + Utils.rand(-100, 100), game.hpMult, game.dmgMult));
      }
      Audio2.enemyDie();
    }
  }

  takeDamage(dmg, game) {
    if (this.shielded > 0) {
      game.particles.spawn(this.x, this.y, '#ffaa00', { count: 3, minSpeed: 40, maxSpeed: 100, size: 3 });
      return; // briefly invulnerable (artillery entering phase 2)
    }
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

    if (this.bossType === 'spider') { this.drawSpider(ctx, time, flash); ctx.restore(); return; }
    if (this.bossType === 'artillery') { this.drawArtillery(ctx, time, flash); ctx.restore(); return; }

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

  drawSpider(ctx, time, flash) {
    const r = this.radius;
    // legs — animated splayed limbs
    ctx.strokeStyle = flash ? '#ffffff' : '#3a1a52';
    ctx.lineWidth = 5;
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const base = (i % 3 - 1) * 0.7;
      const wag = Math.sin(this.legPhase + i) * 0.25;
      const kneeX = side * r * 0.9, kneeY = base * r * 0.9 + wag * r * 0.3;
      const footX = side * r * 1.5, footY = base * r * 1.3 + wag * r * 0.5;
      ctx.beginPath();
      ctx.moveTo(side * r * 0.3, base * r * 0.4);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();
    }
    // bulbous body
    ctx.fillStyle = flash ? '#ffffff' : this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.75, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a0f3d'; ctx.lineWidth = 3; ctx.stroke();
    // glowing eyes
    const pulse = 0.6 + 0.4 * Math.sin(time * 10);
    ctx.fillStyle = `rgba(255, 60, 220, ${pulse})`;
    ctx.beginPath();
    ctx.arc(r * 0.4, -r * 0.2, 6, 0, Math.PI * 2);
    ctx.arc(r * 0.4, r * 0.2, 6, 0, Math.PI * 2);
    ctx.fill();
    if (this.phase2) {
      ctx.strokeStyle = `rgba(177, 77, 255, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2); ctx.stroke();
    }
  }

  drawArtillery(ctx, time, flash) {
    const r = this.radius;
    // wide tracked base
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-r * 0.9, -r * 0.85, r * 1.8, r * 0.3);
    ctx.fillRect(-r * 0.9, r * 0.55, r * 1.8, r * 0.3);
    // hexagonal hull
    ctx.fillStyle = this.shielded > 0 ? 'rgba(255,170,0,0.5)' : (flash ? '#ffffff' : '#6b4a12');
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.5);
    ctx.lineTo(r * 0.4, -r * 0.65);
    ctx.lineTo(r * 0.75, 0);
    ctx.lineTo(r * 0.4, r * 0.65);
    ctx.lineTo(-r * 0.7, r * 0.5);
    ctx.lineTo(-r * 0.9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a2708'; ctx.lineWidth = 3.5; ctx.stroke();
    // long mortar barrel
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, -r * 0.14, r * 1.5, r * 0.28);
    ctx.fillRect(r * 1.35, -r * 0.24, r * 0.2, r * 0.48);
    // warning beacon
    if (this.phase2 || this.shielded > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 9);
      ctx.fillStyle = `rgba(255, 200, 0, ${pulse})`;
      ctx.beginPath(); ctx.arc(-r * 0.3, 0, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
}
