// ---------- player.js : player, movement, dash, shooting ----------
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
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
    this.aimAngle = Utils.angle(this.x, this.y, Input.mouse.worldX, Input.mouse.worldY);

    // movement input
    let mx = 0, my = 0;
    if (Input.key('w')) my -= 1;
    if (Input.key('s')) my += 1;
    if (Input.key('a')) mx -= 1;
    if (Input.key('d')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }

    // dash
    if (this.dashCd > 0) this.dashCd -= dt;
    if (Input.wasPressed('shift') && this.dashCd <= 0 && this.dashTime <= 0 && len > 0) {
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
      if (Input.wasPressed(String(i + 1))) this.switchWeapon(WEAPON_ORDER[i]);
    }

    // reload
    if (Input.wasPressed('r')) this.startReload();
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.weapons[this.currentWeapon].ammo = this.magSize();
      }
    }

    // shooting
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (Input.mouse.down && !this.reloading && this.fireCooldown <= 0) {
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
      game.projectiles.push(new Projectile(bx, by, ang, def, dmg, pierce, true, crit));
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
      ctx.fillStyle = '#2ff3ff';
      ctx.beginPath(); ctx.arc(t.x, t.y, this.radius * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const bob = Math.sin(this.walkPhase) * 2;
    // body glow
    ctx.shadowBlur = 20; ctx.shadowColor = '#2ff3ff';
    const flashing = this.hitFlash > 0 && Math.floor(this.hitFlash * 20) % 2 === 0;
    ctx.fillStyle = flashing ? '#ff8090' : (this.invuln > 0 ? 'rgba(120,240,255,0.6)' : '#2ff3ff');
    ctx.beginPath();
    ctx.arc(this.x, this.y + bob, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // bright outline
    ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(this.x, this.y + bob, this.radius, 0, Math.PI * 2); ctx.stroke();
    // inner core
    ctx.fillStyle = '#0a2a4a';
    ctx.beginPath(); ctx.arc(this.x, this.y + bob, this.radius * 0.5, 0, Math.PI * 2); ctx.fill();

    // gun barrel toward mouse
    const gx = this.x + Math.cos(this.aimAngle) * this.radius;
    const gy = this.y + bob + Math.sin(this.aimAngle) * this.radius;
    const ex = this.x + Math.cos(this.aimAngle) * (this.radius + 16);
    const ey = this.y + bob + Math.sin(this.aimAngle) * (this.radius + 16);
    ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = this.weaponDef().color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
  }
}
