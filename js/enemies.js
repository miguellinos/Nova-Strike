// ---------- enemies.js : military units + AI ----------
const ENEMY_DEFS = {
  drone:   { name: 'Infanterist',        hp: 35,  speed: 200, dmg: 8,  radius: 13, color: '#556b2f', coins: [1, 2],  score: 10,  ranged: false, touchCd: 0.5, vision: 420 },
  striker: { name: 'Elite-Soldat',      hp: 70,  speed: 150, dmg: 14, radius: 15, color: '#a63a2b', coins: [2, 4],  score: 20,  ranged: false, touchCd: 0.7, vision: 520 },
  tank:    { name: 'Kampfpanzer',       hp: 350, speed: 65,  dmg: 28, radius: 28, color: '#3f4f34', coins: [5, 10], score: 45,  ranged: true,  touchCd: 0.9, vision: 580, shootCd: 2.8, projSpeed: 250, projColor: '#ff5500' },
  shooter: { name: 'Militär-Humvee',     hp: 60,  speed: 110, dmg: 10, radius: 18, color: '#c2b280', coins: [3, 5],  score: 30,  ranged: true,  touchCd: 0.7, shootCd: 1.5, keepDist: 300, projSpeed: 380, projColor: '#ffcc00', vision: 640 },
  novabeast:{name: 'aw Panzerträger',hp: 1200, speed: 90,  dmg: 40, radius: 36, color: '#4f5d65', coins: [10, 20],score: 200, ranged: false, touchCd: 0.8, elite: true, vision: 680 },
  marksman:{ name: 'Scharfschütze',      hp: 45,  speed: 85,  dmg: 24, radius: 14, color: '#5a5342', coins: [3, 6],  score: 35,  ranged: true,  touchCd: 0.7, shootCd: 2.4, keepDist: 520, projSpeed: 700, projColor: '#ffe680', vision: 720 },
  bomber:  { name: 'Sprengstoff-Läufer', hp: 22,  speed: 235, dmg: 55, radius: 14, color: '#8a3a1e', coins: [2, 4],  score: 25,  ranged: false, touchCd: 1, vision: 460, blastRadius: 90 },
  medic:   { name: 'Feldsanitäter',      hp: 40,  speed: 155, dmg: 0,  radius: 13, color: '#e8e4d8', coins: [3, 6],  score: 30,  ranged: false, touchCd: 1, vision: 500, healAmount: 12, healCd: 2.2, healRange: 200 },
  grenadier:{name: 'Granatwerfer',       hp: 65,  speed: 115, dmg: 30, radius: 16, color: '#5c5a3a', coins: [3, 6],  score: 32,  ranged: true,  touchCd: 0.8, shootCd: 3, keepDist: 260, vision: 560, blastRadius: 75 },
  shieldtrooper:{name: 'Schildträger',   hp: 90,  speed: 95,  dmg: 16, radius: 17, color: '#3a4a5a', coins: [4, 8],  score: 38,  ranged: false, touchCd: 0.8, vision: 480, shieldHp: 90 },
};

// steer a movement direction around nearby walls instead of walking straight
// into them and getting stuck — tries small deflections left/right, picks the
// first clear one closest to the original heading.
function steerAroundObstacles(x, y, dirX, dirY, rects, lookahead) {
  const angles = [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6];
  const baseAngle = Math.atan2(dirY, dirX);
  for (const off of angles) {
    const a = baseAngle + off;
    const dx = Math.cos(a), dy = Math.sin(a);
    if (!pointInRects(x + dx * lookahead, y + dy * lookahead, rects, 14)) {
      return { x: dx, y: dy, blocked: off !== 0 };
    }
  }
  return { x: 0, y: 0, blocked: true }; // fully boxed in — stand still rather than vibrate on a wall
}

function checkLineOfSight(x1, y1, x2, y2, rects) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  if (distance < 30) return true; // extremely close distance is always seen
  const stepSize = 25;
  const numSteps = Math.ceil(distance / stepSize);
  for (let i = 1; i < numSteps; i++) {
    const t = i / numSteps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    if (pointInRects(px, py, rects)) return false;
  }
  return true;
}

// Every enemy carries a stable id so the co-op guest can match a snapshot entry to
// the enemy it already has. Matching by array index breaks the moment an enemy in
// the middle dies: the host filters it out, every later enemy shifts down one slot,
// and the guest then interpolates each survivor towards a *different* enemy's
// position — which looks exactly like lag/warping.
let _enemyIdCounter = 1;

class Enemy {
  constructor(type, x, y, hpMult, dmgMult) {
    const d = ENEMY_DEFS[type];
    this.id = _enemyIdCounter++;
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

    // Vision & State properties
    this.state = 'idle';
    this.visionRange = d.vision || 450;
    this.wanderTimer = Utils.rand(0.5, 3.0);
    this.wanderAngle = Utils.chance(0.5) ? Utils.rand(0, 6.28) : null;
    this.squadAlertCd = 0.5;
    this.squadAlertTimer = Utils.rand(0, 0.5);

    // status effects
    this.burnT = 0; this.burnDps = 0; this.burnBy = null;
    this.slowT = 0;

    // medic
    this.healTimer = Utils.rand(0.5, d.healCd || 2);
    // shieldtrooper: absorbs damage first, shown as a separate bar above the HP bar
    this.shieldHp = d.shieldHp || 0;
    this.maxShieldHp = d.shieldHp || 0;
  }

  update(dt, game) {
    const p = game.nearestPlayer(this.x, this.y);

    // status effects: burning DoT + slow
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.hp -= this.burnDps * dt;
      if (Math.random() < dt * 8) game.particles.spawn(this.x, this.y, '#ff8a1e', { count: 1, minSpeed: 20, maxSpeed: 70, life: 0.35, size: 3 });
      if (this.hp <= 0 && !this.dead) { this.dead = true; this.lastHitBy = this.burnBy; game.onEnemyKilled(this); return; }
    }
    let slowFactor = 1;
    if (this.slowT > 0) { this.slowT -= dt; slowFactor = 0.45; }
    this._slowFactor = slowFactor;
    const angleToP = Utils.angle(this.x, this.y, p.x, p.y);
    const distToP = Utils.dist(this.x, this.y, p.x, p.y);

    // 1. Vision check
    if (this.state === 'idle') {
      if (distToP < this.visionRange && p.hp > 0) {
        if (checkLineOfSight(this.x, this.y, p.x, p.y, game.world.rects)) {
          this.alert(game);
        }
      }
    }

    // 2. Alert squad
    if (this.state === 'alerted') {
      this.squadAlertTimer -= dt;
      if (this.squadAlertTimer <= 0) {
        this.squadAlertTimer = this.squadAlertCd;
        for (const e of game.enemies) {
          if (e !== this && e.state === 'idle') {
            if (Utils.dist(this.x, this.y, e.x, e.y) < 250) {
              e.alert(game);
            }
          }
        }
      }
    }

    // 3. AI Movement Logic
    let mx = 0, my = 0;
    let spd = this.speed;

    if (this.state === 'idle') {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = Utils.rand(1.5, 4.0);
        this.wanderAngle = Utils.chance(0.55) ? Utils.rand(0, 6.28) : null;
      }
      if (this.wanderAngle !== null) {
        mx = Math.cos(this.wanderAngle);
        my = Math.sin(this.wanderAngle);
        spd = this.speed * 0.35;
      } else {
        mx = 0; my = 0; spd = 0;
      }
    } else {
      mx = Math.cos(angleToP);
      my = Math.sin(angleToP);

      // Custom behaviors based on unit type
      if (this.type === 'drone') {
        if (distToP < 160) {
          spd = this.speed * 1.35; // charge speed boost
        }
      } 
      else if (this.type === 'striker') {
        const strafeDir = Math.sin(game.time * 2 + this.phase) > 0 ? 1 : -1;
        const flankAngle = angleToP + (Math.PI / 3) * strafeDir * (Utils.clamp(distToP / 400, 0.2, 1));
        mx = Math.cos(flankAngle);
        my = Math.sin(flankAngle);
      }
      else if (this.type === 'tank') {
        if (this.hp < this.maxHp * 0.25) {
          mx = -mx; my = -my; spd = this.speed * 1.4; // badly damaged: disengage
        } else if (distToP < 240) {
          mx = -mx * 0.3; my = -my * 0.3; // reverse/reposition
        } else {
          spd = this.speed * 0.75;
        }

        this.shootTimer -= dt;
      
        if (this.shootTimer <= 0 && distToP < 600 && p.hp > 0) {
          this.shootTimer = this.def.shootCd;
          game.enemyProjectiles.push({
            x: this.x, y: this.y,
            vx: Math.cos(angleToP) * this.def.projSpeed,
            vy: Math.sin(angleToP) * this.def.projSpeed,
            radius: 8,
            dmg: this.dmg,
            color: this.def.projColor,
            dead: false,
            life: 3.5,
            isExplosive: true,
            aoe: 85
          });
          Audio2.shoot('cannon');
          const bx = this.x + Math.cos(angleToP) * this.radius;
          const by = this.y + Math.sin(angleToP) * this.radius;
          game.particles.spawn(bx, by, '#ff8b26', { count: 8, angle: angleToP, spread: 0.5, minSpeed: 60, maxSpeed: 180, life: 0.2 });
        }
      }
      else if (this.type === 'shooter') {
        if (this.hp < this.maxHp * 0.3) {
          // low HP: panic-retreat instead of standing and dying
          mx = -mx; my = -my; spd = this.speed * 1.25;
        } else if (distToP < this.def.keepDist) {
          mx = -mx; my = -my;
        } else if (distToP > this.def.keepDist + 80) {
          // approach
        } else {
          const t = mx; mx = -my; my = t;
          spd *= 0.75; // strafe
        }

        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && distToP < 700 && p.hp > 0) {
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
      else if (this.type === 'novabeast') {
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
      else if (this.type === 'marksman') {
        // stays at long range, only closes in if the player gets too close
        if (distToP < this.def.keepDist * 0.6) {
          mx = -mx; my = -my; spd = this.speed * 1.1;
        } else if (distToP > this.def.keepDist) {
          // approach to get within range
        } else {
          mx = 0; my = 0; spd = 0; // hold position and line up the shot
        }

        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && distToP < this.def.keepDist + 150 && p.hp > 0) {
          if (checkLineOfSight(this.x, this.y, p.x, p.y, game.world.rects)) {
            this.shootTimer = this.def.shootCd;
            game.enemyProjectiles.push({
              x: this.x, y: this.y,
              vx: Math.cos(angleToP) * this.def.projSpeed,
              vy: Math.sin(angleToP) * this.def.projSpeed,
              radius: 5, dmg: this.dmg, color: this.def.projColor, dead: false, life: 2.2,
            });
            Audio2.shoot('sniper');
            game.particles.spawn(this.x, this.y, '#ffe680', { count: 4, angle: angleToP, spread: 0.15, minSpeed: 100, maxSpeed: 200, life: 0.15 });
          } else {
            this.shootTimer = 0.3; // no clean shot — retry soon instead of waiting the full cooldown
          }
        }
      }
      else if (this.type === 'bomber') {
        // sprints straight at the player and self-detonates on contact
        spd = this.speed;
        if (distToP < this.radius + p.radius + 20) {
          this.hp = 0;
          this.dead = true;
          // explodeEnemyProj (not explode!) is the variant that damages players —
          // explode() only hurts other enemies/bosses, which isn't what a suicide unit wants.
          game.explodeEnemyProj(this.x, this.y, this.def.blastRadius, this.dmg);
          game.onEnemyKilled(this);
          return;
        }
      }
      else if (this.type === 'medic') {
        // support unit: never attacks, hangs back and patches up nearby squadmates —
        // a priority target since it makes everything around it harder to kill
        mx = -mx; my = -my; spd = this.speed * (distToP < 220 ? 1.2 : 0.6);

        this.healTimer -= dt;
        if (this.healTimer <= 0) {
          this.healTimer = this.def.healCd;
          let healed = false;
          for (const e of game.enemies) {
            if (e === this || e.dead || e.hp >= e.maxHp) continue;
            if (Utils.dist(this.x, this.y, e.x, e.y) < this.def.healRange) {
              e.hp = Math.min(e.maxHp, e.hp + this.def.healAmount);
              game.particles.spawn(e.x, e.y, '#8fffb0', { count: 4, minSpeed: 20, maxSpeed: 60, life: 0.4, size: 3 });
              healed = true;
            }
          }
          if (healed) game.particles.spawn(this.x, this.y, '#8fffb0', { count: 3, minSpeed: 30, maxSpeed: 80, life: 0.3, size: 2.5 });
        }
      }
      else if (this.type === 'grenadier') {
        if (distToP < this.def.keepDist) { mx = -mx; my = -my; }
        else if (distToP > this.def.keepDist + 100) { /* approach */ }
        else { mx = 0; my = 0; spd = 0; }

        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && distToP < 620 && p.hp > 0) {
          this.shootTimer = this.def.shootCd;
          const tx = p.x, ty = p.y; // lobbed to the player's current spot, not tracked
          const flightTime = 850;
          game.particles.spawn(this.x, this.y, '#8a8a4a', { count: 5, angle: angleToP, spread: 0.3, minSpeed: 60, maxSpeed: 140, life: 0.2 });
          Audio2.shoot('cannon');
          setTimeout(() => {
            game.particles.spawn(tx, ty, '#ffaa00', { count: 6, minSpeed: 30, maxSpeed: 90, life: 0.3, size: 3 });
            game.explodeEnemyProj(tx, ty, this.def.blastRadius, this.dmg);
          }, flightTime);
        }
      }
      else if (this.type === 'shieldtrooper') {
        // slow, steady advance — the shield pool (see takeDamage) is what makes it
        // a priority target, not its movement or a special attack
        spd = this.speed * (this.shieldHp > 0 ? 0.85 : 1.1);
      }
    }

    // squad separation: nudge apart from very close allies so they don't stack
    // into a single blob — makes group pushes read as a loose formation instead.
    if (this.state === 'alerted' && this.charging <= 0) {
      let sepX = 0, sepY = 0;
      for (const e of game.enemies) {
        if (e === this || e.dead) continue;
        const minD = this.radius + e.radius + 10;
        const dx0 = this.x - e.x, dy0 = this.y - e.y;
        const d2 = dx0 * dx0 + dy0 * dy0;
        if (d2 > 0 && d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const push = (minD - d) / minD;
          sepX += dx0 / d * push;
          sepY += dy0 / d * push;
        }
      }
      if (sepX !== 0 || sepY !== 0) {
        mx += sepX * 0.6; my += sepY * 0.6;
        const len = Math.hypot(mx, my);
        if (len > 0) { mx /= len; my /= len; }
      }
    }

    // steer around walls instead of getting stuck on them — skip while charging
    // (novabeast/tank barrel through cover on purpose) or standing still/idle-drifting
    if (this.state === 'alerted' && this.charging <= 0 && spd > 0) {
      const look = this.radius + 34;
      const steered = steerAroundObstacles(this.x, this.y, mx, my, game.world.rects, look);
      mx = steered.x; my = steered.y;
      if (steered.blocked) spd *= 0.8; // slightly slower while sidestepping
    }

    this.x += mx * spd * slowFactor * dt;
    this.y += my * spd * slowFactor * dt;
    const res = resolveCircleRects(this.x, this.y, this.radius, game.world.rects);
    this.x = Utils.clamp(res.x, this.radius, game.world.w - this.radius);
    this.y = Utils.clamp(res.y, this.radius, game.world.h - this.radius);

    // 5. Touch Damage
    if (this.touchTimer > 0) this.touchTimer -= dt;
    if (this.state === 'alerted' && distToP < this.radius + p.radius && this.touchTimer <= 0 && p.hp > 0) {
      p.takeDamage(this.dmg, game);
      this.touchTimer = this.def.touchCd;
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  takeDamage(dmg, game) {
    this.hitFlash = 0.1;
    this.alert(game);
    if (this.shieldHp > 0) {
      // shieldtrooper: soak damage into the shield pool first, blue sparks instead
      // of the usual hit color while it holds
      const absorbed = Math.min(this.shieldHp, dmg);
      this.shieldHp -= absorbed;
      dmg -= absorbed;
      game.particles.spawn(this.x, this.y, '#4ad9ff', { count: 5, minSpeed: 50, maxSpeed: 140, life: 0.25, size: 3 });
      Audio2.hit();
      if (dmg <= 0) return;
    }
    this.hp -= dmg;
    game.particles.spawn(this.x, this.y, this.color, { count: 4, minSpeed: 40, maxSpeed: 120, life: 0.25, size: 3 });
    Audio2.hit();
    if (this.hp <= 0 && !this.dead) { this.dead = true; game.onEnemyKilled(this); }
  }

  applyBurn(dps, dur, by) {
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnT = Math.max(this.burnT, dur);
    this.burnBy = by || this.burnBy;
  }
  applySlow(dur) { this.slowT = Math.max(this.slowT, dur); }

  alert(game) {
    if (this.state === 'alerted') return;
    this.state = 'alerted';
    game.particles.spawn(this.x, this.y - this.radius, '#ffaa00', { count: 3, minSpeed: 20, maxSpeed: 60, life: 0.3, size: 2.5 });
  }

  draw(ctx, time) {
    const flash = this.hitFlash > 0;
    
    // get orientation angle
    let angle = this.phase;
    const p = window.game ? window.game.player : null;
    if (this.state === 'alerted' && p) {
      angle = Math.atan2(p.y - this.y, p.x - this.x);
    } else if (this.wanderAngle !== null) {
      angle = this.wanderAngle;
    }

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
    else if (this.type === 'marksman') {
      // Prone-styled sniper: long thin silhouette + rifle + laser dot
      ctx.fillStyle = '#3d3a2e';
      ctx.beginPath();
      ctx.ellipse(-1, 0, this.radius * 0.6, this.radius * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e1c14';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.fillStyle = flash ? '#ffffff' : '#5a5342';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // long rifle barrel + scope
      ctx.fillStyle = '#111';
      ctx.fillRect(this.radius * 0.2, this.radius * 0.3, this.radius * 1.6, 3);
      ctx.fillStyle = '#222';
      ctx.fillRect(this.radius * 0.4, -this.radius * 0.15, this.radius * 0.4, 2.5);

      // faint laser dot telegraph
      ctx.fillStyle = 'rgba(255, 230, 128, 0.6)';
      ctx.beginPath();
      ctx.arc(this.radius * 1.8, this.radius * 0.3, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    else if (this.type === 'bomber') {
      // Twitchy sprinting suicide unit, red pulsing core telegraphing the detonation
      const pulse = 0.5 + 0.5 * Math.sin(time * 14);
      ctx.fillStyle = '#241410';
      ctx.beginPath();
      ctx.ellipse(-1, 0, this.radius * 0.6, this.radius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = flash ? '#ffffff' : '#8a3a1e';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a1c0e';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 90, 30, ${pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // strapped charges on the back
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-this.radius * 0.9, -this.radius * 0.3, this.radius * 0.4, this.radius * 0.6);
    }
    else if (this.type === 'medic') {
      // Support trooper: pale coat, red-cross satchel, no visible weapon
      ctx.fillStyle = '#3a3f2e';
      ctx.beginPath();
      ctx.ellipse(-1, 0, this.radius * 0.65, this.radius * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e2417';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = flash ? '#ffffff' : '#e8e4d8';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // medkit satchel with red cross
      ctx.fillStyle = '#d8d4c4';
      ctx.fillRect(-this.radius * 0.9, -this.radius * 0.4, this.radius * 0.6, this.radius * 0.8);
      ctx.fillStyle = '#e04040';
      ctx.fillRect(-this.radius * 0.68, -this.radius * 0.12, this.radius * 0.16, this.radius * 0.44);
      ctx.fillRect(-this.radius * 0.8, this.radius * 0.02, this.radius * 0.4, this.radius * 0.16);
    }
    else if (this.type === 'grenadier') {
      // Bulky launcher-carrying trooper
      ctx.fillStyle = '#2c2b1c';
      ctx.beginPath();
      ctx.ellipse(-1, 0, this.radius * 0.7, this.radius * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#161608';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = flash ? '#ffffff' : '#5c5a3a';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // stubby launcher barrel
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(this.radius * 0.15, -this.radius * 0.35, this.radius * 0.7, this.radius * 0.5);
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.arc(this.radius * 0.5, -this.radius * 0.1, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    else if (this.type === 'shieldtrooper') {
      // Heavy trooper with a raised riot shield facing the player
      ctx.fillStyle = '#20262e';
      ctx.beginPath();
      ctx.ellipse(-1, 0, this.radius * 0.7, this.radius * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f1216';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = flash ? '#ffffff' : '#3a4a5a';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // riot shield in front, glowing while its energy pool holds
      const shieldUp = this.shieldHp > 0;
      ctx.fillStyle = shieldUp ? 'rgba(74, 217, 255, 0.35)' : 'rgba(60, 70, 80, 0.5)';
      ctx.strokeStyle = shieldUp ? '#4ad9ff' : '#2a3540';
      ctx.lineWidth = 2.5;
      ctx.fillRect(this.radius * 0.5, -this.radius * 0.85, this.radius * 0.35, this.radius * 1.7);
      ctx.strokeRect(this.radius * 0.5, -this.radius * 0.85, this.radius * 0.35, this.radius * 1.7);
    }

    ctx.restore();

    // HP bar drawn directly above the model
    if (this.hp < this.maxHp) {
      const w = this.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.x - w / 2, this.y - this.radius - 12, w, 4);
      ctx.fillStyle = '#ff3b52';
      ctx.fillRect(this.x - w / 2, this.y - this.radius - 12, w * (this.hp / this.maxHp), 4);
    }
    // shield bar (shieldtrooper) sits just above the HP bar while it still holds
    if (this.maxShieldHp > 0 && this.shieldHp > 0) {
      const w = this.radius * 2;
      const y = this.y - this.radius - (this.hp < this.maxHp ? 18 : 12);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.x - w / 2, y, w, 4);
      ctx.fillStyle = '#4ad9ff';
      ctx.fillRect(this.x - w / 2, y, w * (this.shieldHp / this.maxShieldHp), 4);
    }
  }
}
