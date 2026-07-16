// ---------- boss.js : boss with phases & attacks ----------
const BOSS_TYPES = ['tank', 'spider', 'artillery', 'swarm', 'operative'];

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
    this.blinkTimer = 0;
    this.blinkFlash = 0;
    this.burnT = 0; this.burnDps = 0; this.burnBy = null;
    this.slowT = 0;
    // Reinforcements only spawn freely above 50% hp (the regular attack rotation).
    // Once phase2 kicks in, that slot in the rotation is replaced with a normal
    // attack instead, and the boss gets at most 2 more "emergency" call-ins total,
    // spaced far apart — so it doesn't just keep flooding the arena with adds for
    // the whole second half of the fight.
    this.postPhase2SpawnTimer = 0;
    this.postPhase2SpawnsUsed = 0;
    this.flashTimer = 0;

    if (this.bossType === 'operative') {
      // A human elite operator, not a vehicle/mech: low hp, very fast, never
      // calls in reinforcements — the only "attack" that isn't a fair-damage SMG
      // burst is a flashbang thrown on a slow, fixed cadence.
      this.radius = 34;
      this.maxHp = 900 + tier * 550;
      this.dmg = 16 + tier * 3; // touch damage only, the SMG uses its own (lower) per-bullet damage
      this.speed = 230; // fast even before phase2 — see the phase2 transition below
      this.color = '#3a3d30';
      this.name = 'ELITE-OPERATOR "GHOST"';
      this.coins = [40, 80];
      this.score = 900;
      this.flashTimer = Utils.rand(14, 18); // first flashbang comes sooner than the steady-state 35s cadence
    } else if (this.bossType === 'swarm') {
      this.radius = 50;
      this.maxHp = 1700 + tier * 1050;
      this.dmg = 18 + tier * 4;
      this.speed = 110;
      this.color = '#4ad9ff';
      this.name = 'BEFEHLSHABER "SCHWARM"';
      this.coins = [55, 105];
      this.score = 1150;
      this.blinkTimer = Utils.rand(4, 6);
    } else if (this.bossType === 'spider') {
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

    // phase transition (damaged/furious state) — the operative is already fast at
    // full speed by design, so it skips the usual phase2 speed boost entirely
    // (its rage state is just about being lower on health, not getting faster)
    if (!this.phase2 && this.hp < this.maxHp * 0.5) {
      this.phase2 = true;
      if (this.bossType === 'artillery') this.speed *= 1.2;
      else if (this.bossType !== 'operative') this.speed *= 1.6;
      game.shake(6);
      game.particles.burst(this.x, this.y, this.color, 40, 300);
      Audio2.bossSpawn();
      if (this.bossType === 'artillery') this.shielded = 2.5; // brief invuln while it "reloads" into fury mode
      this.postPhase2SpawnTimer = Utils.rand(16, 20); // long wait before the first emergency call-in
    }

    // the (at most 2) emergency post-50%-hp reinforcement call-ins, independent of
    // the normal attack rotation — the operative never spawns anything, ever
    if (this.phase2 && this.postPhase2SpawnsUsed < 2 && this.bossType !== 'operative') {
      this.postPhase2SpawnTimer -= dt;
      if (this.postPhase2SpawnTimer <= 0) {
        this.spawnReinforcements(game, 2);
        this.postPhase2SpawnsUsed++;
        this.postPhase2SpawnTimer = Utils.rand(20, 26);
      }
    }
    const rate = this.phase2 ? 0.6 : 1;
    this.legPhase += dt * (this.bossType === 'spider' ? 10 : 4);

    // swarm: periodically teleport-blinks near the player instead of walking there
    if (this.bossType === 'swarm') {
      this.blinkTimer -= dt;
      if (this.blinkFlash > 0) this.blinkFlash -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkTimer = this.phase2 ? Utils.rand(2, 3.2) : Utils.rand(3.5, 5);
        game.particles.burst(this.x, this.y, this.color, 20, 240);
        const a = Utils.rand(0, Math.PI * 2);
        this.x = Utils.clamp(this.x + Math.cos(a) * Utils.rand(150, 260), this.radius, game.world.w - this.radius);
        this.y = Utils.clamp(this.y + Math.sin(a) * Utils.rand(150, 260), this.radius, game.world.h - this.radius);
        const res = resolveCircleRects(this.x, this.y, this.radius, game.world.rects);
        this.x = res.x; this.y = res.y;
        this.blinkFlash = 0.25;
        game.particles.burst(this.x, this.y, this.color, 20, 240);
        Audio2.dash();
      }
    }

    // movement — artillery keeps distance and kites instead of closing in
    let mx, my, spd = this.speed;
    if (this.bossType === 'artillery') {
      const keepDist = 380;
      if (dist < keepDist - 40) { mx = -Math.cos(ang); my = -Math.sin(ang); }
      else if (dist > keepDist + 40) { mx = Math.cos(ang); my = Math.sin(ang); }
      else { mx = -Math.sin(ang); my = Math.cos(ang); } // strafe
    } else if (this.bossType === 'operative') {
      // fast, erratic flanking instead of a straight beeline — hard to pin down
      const strafeDir = Math.sin(game.time * 2.5 + this.spin) > 0 ? 1 : -1;
      const flankAngle = ang + (Math.PI / 3.5) * strafeDir;
      mx = Math.cos(flankAngle); my = Math.sin(flankAngle);
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

    // operative: throws a flashbang on a slow, fixed ~35s cadence, independent of
    // the SMG attack cycle — its only non-"fair-damage-bullet" trick
    if (this.bossType === 'operative') {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashTimer = 35;
        this.throwFlashbang(game, p);
      }
    }

    // attack cycle — operative fires its SMG on a much shorter, single-attack
    // cycle (it has nothing else to rotate through besides the flashbang, which
    // runs on its own separate timer above)
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      const cycleLen = this.bossType === 'spider' ? 3 : this.bossType === 'swarm' ? 3 : this.bossType === 'operative' ? 1 : 4;
      this.attackIndex = (this.attackIndex + 1) % cycleLen;
      this.attackTimer = this.bossType === 'operative' ? (1.3 * rate) : (2.4 * rate);
      this.doAttack(this.attackIndex, game, ang);
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  spawnReinforcements(game, count) {
    const addType = { tank: 'drone', spider: 'striker', artillery: 'shooter', swarm: 'drone' }[this.bossType] || 'drone';
    const players = game.players || [];
    const maxPlayerRadius = players.reduce((max, p) => Math.max(max, p.radius || 0), 0);
    const minDist = 180 + maxPlayerRadius;
    const minDistSq = minDist * minDist;
    for (let k = 0; k < count; k++) {
      let bestX = this.x + Utils.rand(-80, 80);
      let bestY = this.y + Utils.rand(-80, 80);
      let bestD2 = players.length ? Infinity : minDistSq;
      for (let i = 0; i < 12 && players.length; i++) {
        const cx = this.x + Utils.rand(-80, 80);
        const cy = this.y + Utils.rand(-80, 80);
        let nearest = Infinity;
        for (const p of players) {
          const dx = cx - p.x, dy = cy - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < nearest) nearest = d2;
        }
        if (nearest >= minDistSq) {
          bestX = cx; bestY = cy; bestD2 = nearest;
          break;
        }
        if (nearest > bestD2) {
          bestX = cx; bestY = cy; bestD2 = nearest;
        }
      }
      game.enemies.push(new Enemy(addType, bestX, bestY, game.hpMult, game.dmgMult));
    }
    Audio2.enemyDie();
    game.particles.burst(this.x, this.y, this.color, 14, 200);
  }

  doOperativeAttack(game, ang) {
    // A fan of SMG rounds — many bullets, but each one is deliberately weak
    // ("fair damage"): a boss spraying full-strength automatic fire would be
    // brutally unfair, so per-bullet damage is a fraction of its base dmg stat.
    const n = this.phase2 ? 7 : 5;
    const perBulletDmg = this.dmg * 0.35;
    for (let k = 0; k < n; k++) {
      const a = ang + Utils.rand(-0.14, 0.14);
      game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
        radius: 5, dmg: perBulletDmg, color: '#ffe08a', dead: false, life: 1.6 });
    }
    Audio2.shoot('rifle');
  }

  throwFlashbang(game, p) {
    const tx = p.x, ty = p.y;
    game.particles.spawn(this.x, this.y, '#e8e8e8', { count: 6, minSpeed: 60, maxSpeed: 160, life: 0.3 });
    Audio2.shoot('cannon');
    setTimeout(() => {
      game.particles.burst(tx, ty, '#ffffff', 30, 260);
      game.flashWhiteout = 1; // full-screen 1s whiteout, see Game.render()
      Audio2.explosion();
    }, 700);
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
    if (this.bossType === 'swarm') { this.doSwarmAttack(i, game, ang); return; }
    if (this.bossType === 'operative') { this.doOperativeAttack(game, ang); return; }
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
      game.shake(3);
    } else if (i === 2) {
      if (!this.phase2) {
        // call reinforcements (infantry soldiers) — only while still above 50% hp;
        // past that the boss gets rare emergency call-ins instead (see update())
        this.spawnReinforcements(game, 2);
      } else {
        // radial burst again in place of a 3rd summon wave
        const n = 24;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260,
            radius: 9, dmg: this.dmg * 0.6, color: '#ff8a3b', dead: false, life: 4 });
        }
        Audio2.explosion();
      }
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
      game.shake(2.5);
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
      if (!this.phase2) {
        // call spider-brood reinforcements — only while still above 50% hp
        this.spawnReinforcements(game, 2);
      } else {
        // web mines again in place of a brood call
        const n = 5;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + Utils.rand(-0.3, 0.3);
          const mx = this.x + Math.cos(a) * 90, my = this.y + Math.sin(a) * 90;
          game.particles.spawn(mx, my, '#b14dff', { count: 3, minSpeed: 20, maxSpeed: 50, life: 1.2, size: 3 });
          setTimeout(() => { if (!this.dead) game.explode(mx, my, 55, this.dmg * 0.55, this); }, 900);
        }
        Audio2.shoot('cannon');
      }
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
      if (!this.phase2) {
        // call in turret support drones — only while still above 50% hp
        this.spawnReinforcements(game, 2);
      } else {
        // aimed volley again in place of a support call
        for (let k = -2; k <= 2; k++) {
          const a = ang + k * 0.12;
          game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380,
            radius: 12, dmg: this.dmg * 0.8, color: '#ff3a22', dead: false, life: 3 });
        }
        Audio2.shoot('cannon');
      }
    }
  }

  doSwarmAttack(i, game, ang) {
    if (i === 0) {
      // ring of fast shock bolts
      const n = this.phase2 ? 16 : 10;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340,
          radius: 7, dmg: this.dmg * 0.55, color: '#4ad9ff', dead: false, life: 3 });
      }
      Audio2.shoot('plasma');
    } else if (i === 1) {
      if (!this.phase2) {
        // mass drone swarm — its signature move, only while still above 50% hp
        this.spawnReinforcements(game, 4);
      } else {
        // shock bolt ring again in place of a swarm call
        const n = 16;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340,
            radius: 7, dmg: this.dmg * 0.55, color: '#4ad9ff', dead: false, life: 3 });
        }
        Audio2.shoot('plasma');
      }
    } else {
      // aimed triple bolt volley
      for (let k = -1; k <= 1; k++) {
        const a = ang + k * 0.22;
        game.enemyProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420,
          radius: 8, dmg: this.dmg * 0.9, color: '#bfefff', dead: false, life: 2.4 });
      }
      Audio2.shoot('sniper');
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
    if (this.bossType === 'swarm') { this.drawSwarm(ctx, time, flash); ctx.restore(); return; }
    if (this.bossType === 'operative') { this.drawOperative(ctx, time, flash); ctx.restore(); return; }

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

  drawSwarm(ctx, time, flash) {
    const r = this.radius;
    // afterimage flash right after a blink
    if (this.blinkFlash > 0) {
      ctx.globalAlpha = this.blinkFlash / 0.25 * 0.5;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // orbiting drone shards
    for (let i = 0; i < 4; i++) {
      const a = time * 3 + (i / 4) * Math.PI * 2;
      const ox = Math.cos(a) * r * 1.3, oy = Math.sin(a) * r * 1.3;
      ctx.fillStyle = 'rgba(74, 217, 255, 0.7)';
      ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill();
    }
    // crystalline core body
    ctx.fillStyle = flash ? '#ffffff' : this.color;
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0e3a4a'; ctx.lineWidth = 3; ctx.stroke();

    const pulse = 0.5 + 0.5 * Math.sin(time * 12);
    ctx.fillStyle = `rgba(191, 239, 255, ${pulse})`;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.fill();
  }

  drawOperative(ctx, time, flash) {
    const r = this.radius;
    // shoulders/torso
    ctx.fillStyle = flash ? '#ffffff' : '#2a2d22';
    ctx.beginPath();
    ctx.ellipse(-r * 0.05, 0, r * 0.55, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14150e'; ctx.lineWidth = 2.5; ctx.stroke();

    // chest rig
    ctx.fillStyle = '#1c1d16';
    ctx.fillRect(-r * 0.25, -r * 0.5, r * 0.5, r);

    // helmet
    ctx.fillStyle = flash ? '#ffffff' : this.color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();

    // glowing red visor (boss "elite" tell)
    const pulse = 0.6 + 0.4 * Math.sin(time * 8);
    ctx.fillStyle = `rgba(255, 60, 60, ${pulse})`;
    ctx.fillRect(r * 0.2, -r * 0.15, r * 0.22, r * 0.3);

    // SMG
    ctx.fillStyle = '#111';
    ctx.fillRect(r * 0.25, r * 0.15, r * 1.1, r * 0.18);
    ctx.fillRect(r * 0.4, r * 0.33, r * 0.14, r * 0.3); // mag

    if (this.phase2) {
      ctx.strokeStyle = `rgba(255, 59, 82, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
