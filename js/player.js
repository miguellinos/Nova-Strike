// ---------- player.js : player, movement, dash, shooting ----------
class Player {
  constructor(x, y, isRemote = false) {
    this.x = x; this.y = y;
    this.isRemote = isRemote;
    this.input = isRemote ? new RemoteInput() : Input;
    this.radius = 16;
    this.baseSpeed = 260;
    this.aimAngle = 0;
    this.maxHp = 100; this.hp = 100;
    this.coins = 0;
    this.score = 0;
    this.kills = 0;
    this.walkPhase = 0;
    this.invuln = 0;         // i-frames (dash / after hit)
    this.hitFlash = 0;

    // upgrade modifiers
    this.mods = {
      damage: 1, fireRate: 1, move: 1, reload: 1, mag: 1,
      pierce: 0, crit: 0, dashCd: 1, lifesteal: 0, coinRange: 120, coinMult: 1,
    };

    // weapons: player owns all, but only plasma at first? Spec says start with plasma,
    // and weapons are "added". We give access to all via number keys for playability.
    this.weapons = {};
    for (const k of WEAPON_ORDER) {
      const d = WEAPON_DEFS[k];
      this.weapons[k] = { ammo: Math.round(d.mag), unlocked: k === 'plasma' };
    }
    this.currentWeapon = 'plasma';
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.reloadTotal = 0;

    // dash
    this.dashCdTotal = 2.2;
    this.dashCd = 0;
    this.dashTime = 0;
    this.dashDir = { x: 0, y: 0 };
    this.dashTrail = [];
  }

  weaponDef() { return WEAPON_DEFS[this.currentWeapon]; }
  magSize() { return Math.round(this.weaponDef().mag * this.mods.mag); }
  reloadTime() { return this.weaponDef().reload * this.mods.reload; }
  dashCooldown() { return this.dashCdTotal * this.mods.dashCd; }

  unlock(key) { if (this.weapons[key]) this.weapons[key].unlocked = true; }
  switchWeapon(key) {
    if (!this.weapons[key] || !this.weapons[key].unlocked) return;
    if (this.currentWeapon === key) return;
    this.currentWeapon = key;
    this.reloading = false; this.reloadTimer = 0; this.fireCooldown = 0;
  }

  update(dt, game) {
    const world = game.world;
    // aim toward mouse (world coords)
    this.aimAngle = Utils.angle(this.x, this.y, this.input.mouse.worldX, this.input.mouse.worldY);

    // movement input
    let mx = 0, my = 0;
    if (this.input.key('w')) my -= 1;
    if (this.input.key('s')) my += 1;
    if (this.input.key('a')) mx -= 1;
    if (this.input.key('d')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }

    // dash
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.input.wasPressed('shift') && this.dashCd <= 0 && this.dashTime <= 0 && len > 0) {
      this.dashTime = 0.18;
      this.dashDir = { x: mx, y: my };
      this.dashCd = this.dashCooldown();
      this.invuln = Math.max(this.invuln, 0.28);
      Audio2.dash();
    }

    let speed = this.baseSpeed * this.mods.move;
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      speed = 900;
      mx = this.dashDir.x; my = this.dashDir.y;
      this.dashTrail.push({ x: this.x, y: this.y, life: 0.3 });
    }
    // move + collide
    this.x += mx * speed * dt;
    this.y += my * speed * dt;
    const res = resolveCircleRects(this.x, this.y, this.radius, world.rects);
    this.x = Utils.clamp(res.x, this.radius, world.w - this.radius);
    this.y = Utils.clamp(res.y, this.radius, world.h - this.radius);

    if (len > 0) this.walkPhase += dt * 12; else this.walkPhase = 0;
    for (let i = this.dashTrail.length - 1; i >= 0; i--) {
      this.dashTrail[i].life -= dt;
      if (this.dashTrail[i].life <= 0) this.dashTrail.splice(i, 1);
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // weapon switch by number keys
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      if (this.input.wasPressed(String(i + 1))) this.switchWeapon(WEAPON_ORDER[i]);
    }

    // reload
    if (this.input.wasPressed('r')) this.startReload();
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.weapons[this.currentWeapon].ammo = this.magSize();
      }
    }

    // shooting
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.input.mouse.down && !this.reloading && this.fireCooldown <= 0) {
      const w = this.weapons[this.currentWeapon];
      if (w.ammo > 0) this.shoot(game);
      else this.startReload();
    }
  }

  startReload() {
    const w = this.weapons[this.currentWeapon];
    if (this.reloading || w.ammo >= this.magSize()) return;
    this.reloading = true;
    this.reloadTotal = this.reloadTime();
    this.reloadTimer = this.reloadTotal;
    Audio2.reload();
  }

  shoot(game) {
    const def = this.weaponDef();
    const w = this.weapons[this.currentWeapon];
    this.fireCooldown = 1 / (def.fireRate * this.mods.fireRate);
    w.ammo--;
    Audio2.shoot(def.sound);

    const bx = this.x + Math.cos(this.aimAngle) * (this.radius + 12);
    const by = this.y + Math.sin(this.aimAngle) * (this.radius + 12);
    for (let i = 0; i < def.pellets; i++) {
      const spread = (Math.random() - 0.5) * def.spread * 2;
      const ang = this.aimAngle + spread;
      const crit = Utils.chance(this.mods.crit);
      let dmg = def.damage * this.mods.damage * (crit ? 2 : 1);
      const pierce = def.pierce + this.mods.pierce;
      game.projectiles.push(new Projectile(bx, by, ang, def, dmg, pierce, true, crit, this));
    }
    // muzzle flash
    game.particles.spawn(bx, by, def.color, { count: 5, angle: this.aimAngle, spread: 0.4, minSpeed: 60, maxSpeed: 160, life: 0.15, size: 3 });
    game.shake(def.key === 'cannon' ? 8 : def.key === 'shotgun' ? 5 : 2);
    if (this.weapons[this.currentWeapon].ammo <= 0) this.startReload();
  }

  takeDamage(dmg, game) {
    if (this.invuln > 0) return;
    this.hp -= dmg;
    this.hitFlash = 0.35;
    this.invuln = 0.4;
    Audio2.hurt();
    game.shake(6);
    game.damageVignette = 1;
    game.particles.spawn(this.x, this.y, '#ff3b52', { count: 8, minSpeed: 60, maxSpeed: 180 });
    if (this.hp <= 0) { this.hp = 0; game.onPlayerDeath(); }
  }

  heal(a) { this.hp = Utils.clamp(this.hp + a, 0, this.maxHp); }

  draw(ctx, time) {
    // dash trail
    for (const t of this.dashTrail) {
      ctx.globalAlpha = t.life * 1.2;
      ctx.fillStyle = 'rgba(74, 246, 38, 0.4)';
      ctx.beginPath(); ctx.arc(t.x, t.y, this.radius * 0.85, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const bob = Math.sin(this.walkPhase) * 1.5;
    const flashing = this.hitFlash > 0 && Math.floor(this.hitFlash * 20) % 2 === 0;

    // 1. Draw stepping boots/feet
    const legOffset = Math.sin(this.walkPhase) * 6;
    // calculate position of left and right boot based on walking phase and aim angle
    const leftBootX = this.x + Math.cos(this.aimAngle - Math.PI / 2) * 8 + Math.cos(this.aimAngle) * legOffset;
    const leftBootY = this.y + Math.sin(this.aimAngle - Math.PI / 2) * 8 + Math.sin(this.aimAngle) * legOffset;
    const rightBootX = this.x + Math.cos(this.aimAngle + Math.PI / 2) * 8 + Math.cos(this.aimAngle) * (-legOffset);
    const rightBootY = this.y + Math.sin(this.aimAngle + Math.PI / 2) * 8 + Math.sin(this.aimAngle) * (-legOffset);
    
    ctx.fillStyle = '#1a1b18';
    ctx.strokeStyle = '#2d2e2b';
    ctx.lineWidth = 1;
    ctx.save();
    ctx.translate(leftBootX, leftBootY);
    ctx.rotate(this.aimAngle);
    ctx.fillRect(-5, -3, 8, 5);
    ctx.restore();
    
    ctx.save();
    ctx.translate(rightBootX, rightBootY);
    ctx.rotate(this.aimAngle);
    ctx.fillRect(-5, -3, 8, 5);
    ctx.restore();

    // 2. Draw tactical special agent body
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    ctx.rotate(this.aimAngle);

    // Backpack/Harness
    ctx.fillStyle = '#2f3b25';
    ctx.fillRect(-11, -8, 5, 16);
    ctx.fillStyle = '#1c2415';
    ctx.fillRect(-11, -5, 3, 10);

    // Camo shoulders / sleeves
    ctx.fillStyle = '#3f4f33'; // Olive drab camo
    ctx.beginPath();
    ctx.ellipse(-2, 0, 7.5, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e2417';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Tactical chest plate carrier (bulletproof vest)
    ctx.fillStyle = '#282a2b'; // matte black armor
    ctx.fillRect(-3, -9, 7, 18);
    ctx.fillStyle = '#3a3e40';
    ctx.fillRect(-1, -7, 4, 14);

    // Tactical helmet
    ctx.fillStyle = '#1a1b1c';
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#323537';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glowing night-vision goggles / tactical visor
    ctx.fillStyle = flashing ? '#ff3b52' : '#4af626';
    ctx.shadowBlur = flashing ? 15 : 10;
    ctx.shadowColor = flashing ? '#ff3b52' : '#4af626';
    ctx.fillRect(4.5, -4, 2, 8); // visor lens
    
    // Draw NVG strap highlights
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#111';
    ctx.fillRect(-1, -7.5, 2, 1.5);
    ctx.fillRect(-1, 6, 2, 1.5);

    // 3. Draw detailed weapon (M4A1 style assault rifle / pistol depending on weapon)
    ctx.fillStyle = '#151617'; // matte dark steel
    const wDef = this.weaponDef();
    
    if (wDef.key === 'plasma') {
      // Tactical USP pistol: shorter barrel
      ctx.fillRect(5, 2, 9, 3.5);
      ctx.fillStyle = '#222';
      ctx.fillRect(4, 5.5, 2, 2.5); // grip
    } else if (wDef.key === 'sniper') {
      // Giant Barrett .50 Cal sniper: long barrel, big scope, bipod
      ctx.fillRect(2, 2, 16, 4.5); // body
      ctx.fillStyle = '#333';
      ctx.fillRect(7, -0.5, 5, 2.5); // scope
      ctx.fillRect(9, 6.5, 2.5, 4.5); // mag
      ctx.fillStyle = '#111';
      ctx.fillRect(18, 3, 18, 2); // long barrel
      ctx.fillRect(36, 1.5, 4, 5); // muzzle brake
    } else if (wDef.key === 'cannon') {
      // RPG-7 rocket launcher launcher tube
      ctx.fillStyle = '#4c3f30'; // wood heat shield
      ctx.fillRect(-2, 3.5, 12, 5);
      ctx.fillStyle = '#151617'; // steel tubes
      ctx.fillRect(-8, 4.5, 6, 3);
      ctx.fillRect(10, 4.5, 12, 3);
      // ready rocket inside tube front
      ctx.fillStyle = '#4f5e3d';
      ctx.beginPath();
      ctx.moveTo(22, 2.5); ctx.lineTo(29, 6); ctx.lineTo(22, 9.5); ctx.closePath();
      ctx.fill();
    } else if (wDef.key === 'shotgun') {
      // Remington pump shotgun
      ctx.fillRect(4, 2, 14, 4); // receiver
      ctx.fillStyle = '#4f3b28'; // wooden forend
      ctx.fillRect(9, 5, 6, 2.5);
      ctx.fillStyle = '#222';
      ctx.fillRect(18, 3, 7, 2); // barrel
    } else {
      // M4A1 Sturmgewehr (rifle)
      ctx.fillRect(3, 2, 14, 4); // receiver
      ctx.fillStyle = '#222';
      ctx.fillRect(8, 6, 2.5, 5); // curved magazine
      ctx.fillRect(7, -0.5, 4, 2); // scope
      ctx.fillRect(17, 3, 9, 2); // barrel
      ctx.fillStyle = '#333';
      ctx.fillRect(12, 5, 5, 2); // handguard
    }

    // 4. Draw tactical aiming laser guide line
    ctx.strokeStyle = flashing ? 'rgba(255, 59, 82, 0.4)' : 'rgba(74, 246, 38, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(wDef.key === 'cannon' ? 22 : 18, wDef.key === 'cannon' ? 6 : 4);
    ctx.lineTo(wDef.range, wDef.key === 'cannon' ? 6 : 4);
    ctx.stroke();

    ctx.restore();
  }
}
