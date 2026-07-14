// ---------- enemies.js : military units + AI ----------
const ENEMY_DEFS = {
  drone:   { name: 'Infanterist',        hp: 22,  speed: 200, dmg: 6,  radius: 13, color: '#556b2f', coins: [1, 2],  score: 10,  ranged: false, touchCd: 0.6 },
  striker: { name: 'Elite-Soldat',      hp: 55,  speed: 130, dmg: 12, radius: 15, color: '#a63a2b', coins: [2, 4],  score: 20,  ranged: false, touchCd: 0.7 },
  tank:    { name: 'Kampfpanzer',       hp: 220, speed: 55,  dmg: 22, radius: 28, color: '#3f4f34', coins: [5, 10], score: 45,  ranged: false, touchCd: 0.9 },
  shooter: { name: 'Militär-Humvee',     hp: 34,  speed: 95,  dmg: 9,  radius: 18, color: '#c2b280', coins: [3, 5],  score: 30,  ranged: true,  touchCd: 0.7, shootCd: 1.6, keepDist: 320, projSpeed: 340, projColor: '#ffaa00' },
  novabeast:{name: 'Schwerer Panzerträger',hp: 900, speed: 90,  dmg: 30, radius: 36, color: '#4f5d65', coins: [10, 20],score: 200, ranged: false, touchCd: 0.8, elite: true },
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
    // charge cd for elite carrier
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
      // keep distance & strafe (Humvee tactic)
      if (distToP < this.def.keepDist) { mx = -mx; my = -my; }
      else if (distToP > this.def.keepDist + 80) { /* approach */ }
      else { const t = mx; mx = -my; my = t; spd *= 0.6; } // strafe
      
      this.shootTimer -= dt;
      if (this.shootTimer <= 0 && distToP < 700) {
        this.shootTimer = this.def.shootCd;
        game.enemyProjectiles.push({
          x: this.x, y: this.y,
          vx: Math.cos(angleToP) * this.def.projSpeed,
          vy: Math.sin(angleToP) * this.def.projSpeed,
          radius: 6, dmg: this.dmg, color: this.def.projColor, dead: false, life: 3.2,
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
    
    // get orientation angle towards player
    const p = window.game ? window.game.player : null;
    const angle = p ? Math.atan2(p.y - this.y, p.x - this.x) : this.phase;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    if (this.type === 'drone') {
      // 1. Infanterist (Normal Soldier)
      // Shoulders
      ctx.fillStyle = '#4c593c'; // olive drab clothing
      ctx.beginPath();
      ctx.ellipse(-1, 0, this.radius * 0.65, this.radius * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e2417';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Helmet
      ctx.fillStyle = flash ? '#ffffff' : '#39422c';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Gun/Rifle
      ctx.fillStyle = '#111';
      ctx.fillRect(this.radius * 0.2, this.radius * 0.35, this.radius * 0.8, 3);
    } 
    else if (this.type === 'striker') {
      // 2. Elite-Soldat (Elite Commando)
      // Shoulders
      ctx.fillStyle = '#24262b'; // charcoal/black clothing
      ctx.beginPath();
      ctx.ellipse(-1, 0, this.radius * 0.65, this.radius * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Red Beret
      ctx.fillStyle = flash ? '#ffffff' : '#9c2626';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Red laser visor glow
      ctx.fillStyle = '#ff2b2b';
      ctx.fillRect(this.radius * 0.35, -this.radius * 0.25, 2, this.radius * 0.5);

      // Gun barrel
      ctx.fillStyle = '#111';
      ctx.fillRect(this.radius * 0.2, this.radius * 0.35, this.radius * 0.9, 3.5);

      // Red laser sight guide
      ctx.strokeStyle = 'rgba(255, 43, 43, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.radius * 1.1, this.radius * 0.35);
      ctx.lineTo(this.radius * 12, this.radius * 0.35);
      ctx.stroke();
    } 
    else if (this.type === 'tank') {
      // 3. Kampfpanzer (Combat Tank)
      // Tracks left & right
      ctx.fillStyle = '#151515';
      ctx.fillRect(-this.radius * 0.95, -this.radius * 0.95, this.radius * 1.9, this.radius * 0.3);
      ctx.fillRect(-this.radius * 0.95, this.radius * 0.65, this.radius * 1.9, this.radius * 0.3);
      
      // Tracks outlines and links lines
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-this.radius * 0.95, -this.radius * 0.95, this.radius * 1.9, this.radius * 0.3);
      ctx.strokeRect(-this.radius * 0.95, this.radius * 0.65, this.radius * 1.9, this.radius * 0.3);
      
      // Main Tank Chassis Body
      ctx.fillStyle = flash ? '#ffffff' : '#3f4f34';
      ctx.fillRect(-this.radius * 0.8, -this.radius * 0.65, this.radius * 1.6, this.radius * 1.3);
      ctx.strokeStyle = '#222d1c';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-this.radius * 0.8, -this.radius * 0.65, this.radius * 1.6, this.radius * 1.3);

      // Camouflage lines
      ctx.fillStyle = '#2f3b25';
      ctx.fillRect(-this.radius * 0.4, -this.radius * 0.5, this.radius * 0.8, this.radius * 0.24);
      ctx.fillRect(-this.radius * 0.6, this.radius * 0.25, this.radius * 0.7, this.radius * 0.24);

      // Turret base
      ctx.fillStyle = flash ? '#ffffff' : '#475a3a';
      ctx.beginPath();
      ctx.arc(-this.radius * 0.05, 0, this.radius * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hatch
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(-this.radius * 0.15, -this.radius * 0.15, this.radius * 0.13, 0, Math.PI * 2);
      ctx.fill();

      // Cannon Barrel
      ctx.fillStyle = '#111';
      ctx.fillRect(this.radius * 0.3, -this.radius * 0.1, this.radius * 0.95, this.radius * 0.2);
    } 
    else if (this.type === 'shooter') {
      // 4. Militär-Humvee (Scout vehicle)
      // 4 Wheels
      ctx.fillStyle = '#1c1c1c';
      ctx.fillRect(-this.radius * 0.75, -this.radius * 0.82, this.radius * 0.45, this.radius * 0.22);
      ctx.fillRect(this.radius * 0.3, -this.radius * 0.82, this.radius * 0.45, this.radius * 0.22);
      ctx.fillRect(-this.radius * 0.75, this.radius * 0.6, this.radius * 0.45, this.radius * 0.22);
      ctx.fillRect(this.radius * 0.3, this.radius * 0.6, this.radius * 0.45, this.radius * 0.22);

      // Humvee Main Body
      ctx.fillStyle = flash ? '#ffffff' : '#c2b280'; // sand desert camo base
      ctx.fillRect(-this.radius * 0.9, -this.radius * 0.6, this.radius * 1.8, this.radius * 1.2);
      ctx.strokeStyle = '#857850';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-this.radius * 0.9, -this.radius * 0.6, this.radius * 1.8, this.radius * 1.2);

      // Windows/Windshield (metallic blue glass)
      ctx.fillStyle = '#243b5c';
      ctx.fillRect(this.radius * 0.2, -this.radius * 0.45, this.radius * 0.25, this.radius * 0.9);
      ctx.fillRect(-this.radius * 0.4, -this.radius * 0.52, this.radius * 0.35, this.radius * 0.08);
      ctx.fillRect(-this.radius * 0.4, this.radius * 0.44, this.radius * 0.35, this.radius * 0.08);

      // Roof Gun Turret
      ctx.fillStyle = flash ? '#ffffff' : '#998b60';
      ctx.beginPath();
      ctx.arc(-this.radius * 0.15, 0, this.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Mounted MG barrel
      ctx.fillStyle = '#111';
      ctx.fillRect(-this.radius * 0.15, -this.radius * 0.07, this.radius * 1.05, this.radius * 0.14);
    } 
    else if (this.type === 'novabeast') {
      // 5. Schwerer Panzerträger (Elite APC / Mech carrier)
      // 6 Heavy Wheels
      ctx.fillStyle = '#151515';
      const wW = this.radius * 0.38, wH = this.radius * 0.18;
      ctx.fillRect(-this.radius * 0.8, -this.radius * 0.95, wW, wH);
      ctx.fillRect(-this.radius * 0.1, -this.radius * 0.95, wW, wH);
      ctx.fillRect(this.radius * 0.4, -this.radius * 0.95, wW, wH);
      ctx.fillRect(-this.radius * 0.8, this.radius * 0.77, wW, wH);
      ctx.fillRect(-this.radius * 0.1, this.radius * 0.77, wW, wH);
      ctx.fillRect(this.radius * 0.4, this.radius * 0.77, wW, wH);

      // Armored sloped hull
      ctx.fillStyle = flash ? '#ffffff' : '#4f5d65'; // grey camouflage base
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.95, -this.radius * 0.75);
      ctx.lineTo(this.radius * 0.65, -this.radius * 0.75);
      ctx.lineTo(this.radius * 0.95, -this.radius * 0.45);
      ctx.lineTo(this.radius * 0.95, this.radius * 0.45);
      ctx.lineTo(this.radius * 0.65, this.radius * 0.75);
      ctx.lineTo(-this.radius * 0.95, this.radius * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2d353a';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Camo spots
      ctx.fillStyle = '#374247';
      ctx.beginPath();
      ctx.ellipse(-this.radius * 0.4, -this.radius * 0.2, this.radius * 0.35, this.radius * 0.4, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(this.radius * 0.2, this.radius * 0.3, this.radius * 0.3, this.radius * 0.25, -0.6, 0, Math.PI * 2);
      ctx.fill();

      // Missile tubes launchers
      ctx.fillStyle = flash ? '#ffffff' : '#282f33';
      ctx.fillRect(-this.radius * 0.6, -this.radius * 0.5, this.radius * 0.55, this.radius * 0.3);
      ctx.fillRect(-this.radius * 0.6, this.radius * 0.2, this.radius * 0.55, this.radius * 0.3);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-this.radius * 0.6, -this.radius * 0.5, this.radius * 0.55, this.radius * 0.3);
      ctx.strokeRect(-this.radius * 0.6, this.radius * 0.2, this.radius * 0.55, this.radius * 0.3);

      // Rocket tips glowing red
      ctx.fillStyle = '#ff3c22';
      ctx.fillRect(-this.radius * 0.05, -this.radius * 0.43, 3, 5);
      ctx.fillRect(-this.radius * 0.05, -this.radius * 0.33, 3, 5);
      ctx.fillRect(-this.radius * 0.05, this.radius * 0.27, 3, 5);
      ctx.fillRect(-this.radius * 0.05, this.radius * 0.37, 3, 5);
    }

    ctx.restore();

    // HP Bar drawn directly above the model
    if (this.hp < this.maxHp) {
      const w = this.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.x - w / 2, this.y - this.radius - 12, w, 4);
      ctx.fillStyle = '#ff3b52';
      ctx.fillRect(this.x - w / 2, this.y - this.radius - 12, w * (this.hp / this.maxHp), 4);
    }
  }
}
