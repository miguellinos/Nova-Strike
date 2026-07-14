// ---------- enemies.js : enemy types + AI ----------
const ENEMY_DEFS = {
  drone:   { name: 'Drone',        hp: 22,  speed: 200, dmg: 6,  radius: 12, color: '#ff5b7a', coins: [1, 2],  score: 10,  ranged: false, touchCd: 0.6 },
  striker: { name: 'Striker',      hp: 55,  speed: 130, dmg: 12, radius: 16, color: '#ff8a3b', coins: [2, 4],  score: 20,  ranged: false, touchCd: 0.7 },
  tank:    { name: 'Tank Bot',     hp: 220, speed: 55,  dmg: 22, radius: 28, color: '#c94dff', coins: [5, 10], score: 45,  ranged: false, touchCd: 0.9 },
  shooter: { name: 'Shooter Drone',hp: 34,  speed: 95,  dmg: 9,  radius: 14, color: '#4dd0ff', coins: [3, 5],  score: 30,  ranged: true,  touchCd: 0.7, shootCd: 1.6, keepDist: 320, projSpeed: 340, projColor: '#ff5b7a' },
  novabeast:{name: 'Nova Beast',   hp: 900, speed: 90,  dmg: 30, radius: 40, color: '#b14dff', coins: [10, 20],score: 200, ranged: false, touchCd: 0.8, elite: true },
};

class Enemy {
  constructor(type, x, y, hpMult, dmgMult) {
    const d = ENEMY_DEFS[type];
    this.type = type; this.def = d;
    this.x = x; this.y = y;
    this.radius = d.radius;
    this.maxHp = d.hp * hpMult;
    this.hp = this.maxHp;
    this.speed = d.speed;
    this.dmg = d.dmg * dmgMult;
    this.color = d.color;
    this.dead = false;
    this.touchTimer = 0;
    this.shootTimer = Utils.rand(0.5, d.shootCd || 1);
    this.hitFlash = 0;
    this.phase = Utils.rand(0, 6.28);
    // nova beast charge
    this.chargeCd = Utils.rand(2, 4);
    this.charging = 0;
    this.chargeDir = { x: 0, y: 0 };
  }

  update(dt, game) {
    const p = game.player;
    const angleToP = Utils.angle(this.x, this.y, p.x, p.y);
    const distToP = Utils.dist(this.x, this.y, p.x, p.y);
    let mx = Math.cos(angleToP), my = Math.sin(angleToP);
    let spd = this.speed;

    if (this.def.ranged) {
      // keep distance & strafe
      if (distToP < this.def.keepDist) { mx = -mx; my = -my; }
      else if (distToP > this.def.keepDist + 80) { /* approach */ }
      else { const t = mx; mx = -my; my = t; spd *= 0.6; } // strafe (perpendicular)
      this.shootTimer -= dt;
      if (this.shootTimer <= 0 && distToP < 700) {
        this.shootTimer = this.def.shootCd;
        game.enemyProjectiles.push({
          x: this.x, y: this.y,
          vx: Math.cos(angleToP) * this.def.projSpeed,
          vy: Math.sin(angleToP) * this.def.projSpeed,
          radius: 7, dmg: this.dmg, color: this.def.projColor, dead: false, life: 3,
        });
        Audio2.shoot('rifle');
      }
    }

    if (this.type === 'novabeast') {
      this.chargeCd -= dt;
      if (this.charging > 0) {
        this.charging -= dt;
        mx = this.chargeDir.x; my = this.chargeDir.y; spd = 480;
      } else if (this.chargeCd <= 0 && distToP < 600) {
        this.charging = 0.6;
        this.chargeDir = { x: Math.cos(angleToP), y: Math.sin(angleToP) };
        this.chargeCd = Utils.rand(3, 5);
      }
    }

    this.x += mx * spd * dt;
    this.y += my * spd * dt;
    const res = resolveCircleRects(this.x, this.y, this.radius, game.world.rects);
    this.x = Utils.clamp(res.x, this.radius, game.world.w - this.radius);
    this.y = Utils.clamp(res.y, this.radius, game.world.h - this.radius);

    // touch damage
    if (this.touchTimer > 0) this.touchTimer -= dt;
    if (distToP < this.radius + p.radius && this.touchTimer <= 0) {
      p.takeDamage(this.dmg, game);
      this.touchTimer = this.def.touchCd;
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  takeDamage(dmg, game) {
    this.hp -= dmg;
    this.hitFlash = 0.1;
    game.particles.spawn(this.x, this.y, this.color, { count: 4, minSpeed: 40, maxSpeed: 120, life: 0.25, size: 3 });
    Audio2.hit();
    if (this.hp <= 0 && !this.dead) { this.dead = true; game.onEnemyKilled(this); }
  }

  draw(ctx, time) {
    const flash = this.hitFlash > 0;
    ctx.shadowBlur = this.def.elite ? 24 : 10; ctx.shadowColor = this.color;
    ctx.fillStyle = flash ? '#ffffff' : this.color;

    if (this.type === 'drone') {
      // triangle
      this.drawPoly(ctx, 3, this.radius, time);
    } else if (this.type === 'striker') {
      this.drawPoly(ctx, 4, this.radius, time);
    } else if (this.type === 'tank') {
      ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
      ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 3;
      ctx.strokeRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    } else if (this.type === 'shooter') {
      this.drawPoly(ctx, 6, this.radius, time);
    } else if (this.type === 'novabeast') {
      this.drawPoly(ctx, 8, this.radius + Math.sin(time * 4) * 3, time);
    }
    ctx.shadowBlur = 0;

    // outline for polys
    if (this.type !== 'tank') {
      ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 2;
      ctx.stroke();
    }
    // hp bar
    if (this.hp < this.maxHp) {
      const w = this.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x - w / 2, this.y - this.radius - 10, w, 4);
      ctx.fillStyle = '#ff3b52';
      ctx.fillRect(this.x - w / 2, this.y - this.radius - 10, w * (this.hp / this.maxHp), 4);
    }
  }
  drawPoly(ctx, sides, r, time) {
    ctx.beginPath();
    const rot = time * (this.def.elite ? 0.6 : 1.2) + this.phase;
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const px = this.x + Math.cos(a) * r, py = this.y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}
