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
    this.charId = Settings.data.character; // selected skin (camo/visor colors)

    // Active Inventory & Shields
    this.medkitsCount = 1;
    this.shieldsCount = 1;
    this.shieldHp = 0;
    this.maxShieldHp = 100;
    this.grenadeCount = 0;

    // upgrade modifiers
    this.mods = {
      damage: 1, fireRate: 1, move: 1, reload: 1, mag: 1,
      pierce: 0, crit: 0, dashCd: 1, lifesteal: 0, coinRange: 120, coinMult: 1,
      visionRange: 1,
    };
    this.applyCharacterPerk();

    // weapons: player owns all, but only plasma at first? Spec says start with plasma,
    // and weapons are "added". We give access to all via number keys for playability.
    this.weapons = {};
    this.weaponLevels = {};
    for (const k of WEAPON_ORDER) {
      const d = WEAPON_DEFS[k];
      this.weapons[k] = { ammo: Math.round(d.mag), unlocked: k === 'plasma' };
      this.weaponLevels[k] = 0;
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

    // melee (right-click) — always available regardless of equipped gun
    this.meleeCdTotal = 0.45;
    this.meleeCd = 0;
    this.meleeSwing = 0;        // >0 while the slash animation plays
    this.meleeDamage = 46;
    this.meleeRange = 62;
    this.meleeArc = Math.PI * 0.6; // ~108° swing cone
    this.novaColaTimer = 0;
    this.breadCount = 0;
    this.novacolaCount = 0;
    this.scanTimer = 0;
    this.scanTarget = null;
  }

  // small, subtle per-character passive (see js/characters.js perkDesc for the
  // player-facing text) — deliberately minor so picking a skin stays a flavor
  // choice rather than a build decision.
  applyCharacterPerk() {
    switch (this.charId) {
      case 'woodland': this.mods.move *= 1.06; break;
      case 'desert': this.mods.coinRange += 40; break;
      case 'arctic': this.mods.dashCd *= 0.85; break;
      case 'urban': this.mods.crit += 0.08; break;
      case 'crimson': this.mods.lifesteal += 0.05; break;
    }
  }

  // effective def for the equipped weapon, including per-weapon workbench upgrades
  weaponDef() {
    const base = WEAPON_DEFS[this.currentWeapon];
    const lvl = (this.weaponLevels && this.weaponLevels[this.currentWeapon]) || 0;
    if (lvl <= 0) return base;
    return {
      ...base,
      damage: base.damage * (1 + lvl * 0.12),
      fireRate: base.fireRate * (1 + lvl * 0.08),
      mag: Math.round(base.mag * (1 + lvl * 0.2)),
    };
  }
  upgradeWeapon(key) {
    const lvl = this.weaponLevels[key] || 0;
    if (lvl >= WEAPON_UPGRADE_MAX) return false;
    this.weaponLevels[key] = lvl + 1;
    return true;
  }
  magSize() {
    if (this.magCapacity !== undefined) return this.magCapacity;
    return Math.round(this.weaponDef().mag * this.mods.mag);
  }
  reloadTime() { return this.weaponDef().reload * this.mods.reload; }
  dashCooldown() { return this.dashCdTotal * this.mods.dashCd; }

  unlock(key) { if (this.weapons[key]) this.weapons[key].unlocked = true; }
  switchWeapon(key) {
    if (!this.weapons[key] || !this.weapons[key].unlocked) return;
    if (this.currentWeapon === key) return;
    this.currentWeapon = key;
    this.reloading = false; this.reloadTimer = 0; this.fireCooldown = 0;
  }
  cycleWeapon(dir) {
    const owned = WEAPON_ORDER.filter((k) => this.weapons[k].unlocked);
    if (owned.length < 2) return;
    const i = owned.indexOf(this.currentWeapon);
    const next = owned[(i + dir + owned.length) % owned.length];
    this.switchWeapon(next);
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
    if (this.novaColaTimer > 0) {
      speed *= 1.45; // 45% speed boost!
    }
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      speed = 900;
      mx = this.dashDir.x; my = this.dashDir.y;
      this.dashTrail.push({ x: this.x, y: this.y, life: 0.3 });
    }
    // move + collide
    this.x += mx * speed * dt;
    this.y += my * speed * dt;
    const res = resolveCircleRects(this.x, this.y, this.radius, world.playerCollidableRects);
    this.x = Utils.clamp(res.x, -300 + this.radius, world.w - this.radius);
    this.y = Utils.clamp(res.y, this.radius, world.h - this.radius);

    if (len > 0) this.walkPhase += dt * 12; else this.walkPhase = 0;
    for (let i = this.dashTrail.length - 1; i >= 0; i--) {
      this.dashTrail[i].life -= dt;
      if (this.dashTrail[i].life <= 0) this.dashTrail.splice(i, 1);
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.novaColaTimer > 0) {
      this.novaColaTimer -= dt;
      if (game && game.particles && Math.random() < 0.15) {
        game.particles.spawn(this.x + Utils.rand(-10, 10), this.y + Utils.rand(-10, 10), '#00ffcc', {
          count: 1, minSpeed: 10, maxSpeed: 40, life: 0.4, size: 2
        });
      }
    }

    // These overlay flags belong to THIS browser tab's own player. On the host the
    // simulation drives both players, so gating player2 (the remote guest) by the
    // host's flags would freeze the guest's shooting whenever the host opens a shop/
    // workbench/pause menu. The guest already sends a neutral input packet while its
    // own menu is open, so only ever gate the local player here.
    const menusOpen = (this === game.localPlayer) &&
      (game.shopOpenLocal || game.workbenchOpenLocal || game.inventoryOpenLocal ||
       game.trainingOpenLocal || game.pauseOpenLocal);

    // weapon switch by number keys or mouse wheel
    if (!menusOpen) {
      for (let i = 0; i < WEAPON_ORDER.length; i++) {
        if (this.input.wasPressed(String(i + 1))) this.switchWeapon(WEAPON_ORDER[i]);
      }
      if (this.input.wasPressed('wheeldown')) this.cycleWeapon(1);
      if (this.input.wasPressed('wheelup')) this.cycleWeapon(-1);
    }

    // reload
    if (!menusOpen && this.input.wasPressed('r')) this.startReload();
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.weapons[this.currentWeapon].ammo = this.magSize();
      }
    }

    // shooting — no separate "safe base camp" gate needed: the enemy-barrier wall
    // that seals off the workbench/shop alcove (x < 0) already blocks every
    // projectile (Projectile.update() checks the full, unfiltered world.rects), so
    // there was never anything to exploit by firing from inside it. The old x >= 20
    // check just meant shooting silently stayed broken after closing the workbench/
    // shop until you manually walked back out past the gate.
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    const canShoot = !menusOpen;
    if (canShoot && this.input.mouse.down && !this.reloading && this.fireCooldown <= 0) {
      const w = this.weapons[this.currentWeapon];
      if (w.ammo > 0) this.shoot(game);
      else this.startReload();
    }

    // melee attack (right-click)
    if (this.meleeCd > 0) this.meleeCd -= dt;
    if (this.meleeSwing > 0) this.meleeSwing -= dt;
    const canMelee = !menusOpen;
    if (canMelee && this.input.mouse.rightPressed && this.meleeCd <= 0) this.meleeAttack(game);

    // active item activations
    if (!menusOpen && this.input.wasPressed('q')) this.useMedkit(game);
    if (!menusOpen && this.input.wasPressed('e')) this.useShield(game);
    if (!menusOpen && this.input.wasPressed('g')) this.throwGrenade(game);

    // tactical scan V
    if (!menusOpen && this.input.wasPressed('v')) {
      let closest = null;
      let minDist = Infinity;
      for (const e of game.enemies) {
        if (e.dead || e.hp <= 0) continue;
        const d = Utils.dist(this.x, this.y, e.x, e.y);
        if (d < minDist) {
          minDist = d;
          closest = e;
        }
      }
      if (game.boss && !game.boss.dead) {
        const d = Utils.dist(this.x, this.y, game.boss.x, game.boss.y);
        if (d < minDist) {
          minDist = d;
          closest = game.boss;
        }
      }

      if (closest) {
        this.scanTarget = closest;
        this.scanTimer = 1.5;
        Audio2.reload(); // play scanner activation feedback
      }
    }

    if (this.scanTimer > 0) {
      this.scanTimer -= dt;
      if (this.scanTimer <= 0) {
        this.scanTarget = null;
      }
    }
  }

  meleeAttack(game) {
    this.meleeCd = this.meleeCdTotal;
    this.meleeSwing = 0.22;
    Audio2.shoot('shotgun');
    game.shake(4);

    const cx = this.x + Math.cos(this.aimAngle) * (this.radius + 10);
    const cy = this.y + Math.sin(this.aimAngle) * (this.radius + 10);
    game.particles.spawn(cx, cy, '#eaffff', { count: 8, angle: this.aimAngle, spread: this.meleeArc / 2, minSpeed: 120, maxSpeed: 260, life: 0.18, size: 3 });

    // hit every enemy inside the arc in front of the player
    const targets = [];
    for (const e of game.enemies) if (!e.dead) targets.push(e);
    if (game.boss && !game.boss.dead) targets.push(game.boss);
    let hitAny = false;
    for (const t of targets) {
      const d = Utils.dist(this.x, this.y, t.x, t.y);
      if (d > this.meleeRange + t.radius) continue;
      const ang = Utils.angle(this.x, this.y, t.x, t.y);
      let diff = Math.abs(ang - this.aimAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > this.meleeArc / 2) continue;
      t.lastHitBy = this;
      t.takeDamage(this.meleeDamage * this.mods.damage, game);
      // knockback
      if (!t.dead && t.def && !t.def.elite) {
        t.x += Math.cos(ang) * 34;
        t.y += Math.sin(ang) * 34;
      }
      hitAny = true;
    }
    if (hitAny) { Audio2.hit(); game.shake(6); }
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
    
    // shield damage absorption
    if (this.shieldHp > 0) {
      if (this.shieldHp >= dmg) {
        this.shieldHp -= dmg;
        dmg = 0;
      } else {
        dmg -= this.shieldHp;
        this.shieldHp = 0;
      }
      game.particles.spawn(this.x, this.y, '#1c6cff', { count: 6, minSpeed: 40, maxSpeed: 140 });
    }

    if (dmg > 0) {
      this.hp -= dmg;
      game.particles.spawn(this.x, this.y, '#ff3b52', { count: 8, minSpeed: 60, maxSpeed: 180 });
      Audio2.hurt();
    } else {
      Audio2.hit();
    }

    this.hitFlash = 0.35;
    this.invuln = 0.4;
    game.shake(6);
    if (this === game.localPlayer) {
      game.damageVignette = 1;
    }
    if (this.hp <= 0) { this.hp = 0; game.onPlayerDeath(); }
  }

  heal(a) { this.hp = Utils.clamp(this.hp + a, 0, this.maxHp); }

  useBread(game) {
    if (this.breadCount > 0 && this.hp < this.maxHp) {
      this.breadCount--;
      this.heal(15);
      Audio2.heal();
      if (game && game.particles) {
        game.particles.spawn(this.x, this.y, '#4af626', { count: 8, minSpeed: 30, maxSpeed: 100, life: 0.4, size: 3 });
      }
      return true;
    }
    return false;
  }

  useNovacola(game) {
    if (this.novacolaCount > 0) {
      this.novacolaCount--;
      this.novaColaTimer = 8;
      Audio2.reload();
      if (game && game.particles) {
        game.particles.spawn(this.x, this.y, '#00ffcc', { count: 12, minSpeed: 40, maxSpeed: 120, life: 0.4, size: 3 });
      }
      return true;
    }
    return false;
  }

  useMedkit(game) {
    if (this.medkitsCount > 0 && this.hp < this.maxHp) {
      this.medkitsCount--;
      this.heal(40);
      Audio2.heal();
      game.particles.spawn(this.x, this.y, '#4af626', { count: 12, minSpeed: 40, maxSpeed: 140, life: 0.5, size: 4 });
      return true;
    }
    return false;
  }

  useShield(game) {
    if (this.shieldsCount > 0 && this.shieldHp < this.maxShieldHp) {
      this.shieldsCount--;
      this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp + 50);
      if (Audio2.shield) Audio2.shield(); else Audio2.reload();
      game.particles.spawn(this.x, this.y, '#1c6cff', { count: 12, minSpeed: 40, maxSpeed: 140, life: 0.5, size: 4 });
      return true;
    }
    return false;
  }

  // Thrown with G — lobbed to wherever the mouse is aimed (clamped to a max throw
  // range), landing after a short flight before detonating. Mirrors the boss
  // grenadier/mortar pattern already used elsewhere: a timed AOE at a fixed spot
  // rather than a simulated arc, since that's simple, predictable, and already
  // proven to work well for lobbed explosives in this codebase.
  throwGrenade(game) {
    if (this.grenadeCount <= 0) return false;
    this.grenadeCount--;

    const maxRange = 420;
    const dx = this.input.mouse.worldX - this.x, dy = this.input.mouse.worldY - this.y;
    const rawDist = Math.hypot(dx, dy) || 1;
    const dist = Math.min(maxRange, rawDist);
    const ang = Math.atan2(dy, dx);
    const tx = this.x + Math.cos(ang) * dist;
    const ty = this.y + Math.sin(ang) * dist;

    Audio2.shoot('cannon');
    game.particles.spawn(this.x, this.y, '#4f5e3d', { count: 6, angle: ang, spread: 0.2, minSpeed: 80, maxSpeed: 200, life: 0.2 });

    const owner = this;
    const dmg = 55 * this.mods.damage;
    setTimeout(() => {
      game.particles.spawn(tx, ty, '#ffaa00', { count: 8, minSpeed: 40, maxSpeed: 110, life: 0.35, size: 3 });
      game.explode(tx, ty, 90, dmg, owner);
    }, 550);
    return true;
  }

  draw(ctx, time) {
    // dash trail
    for (const t of this.dashTrail) {
      ctx.globalAlpha = t.life * 1.2;
      ctx.fillStyle = 'rgba(74, 246, 38, 0.4)';
      ctx.beginPath(); ctx.arc(t.x, t.y, this.radius * 0.85, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // speed boost aura
    if (this.novaColaTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.22 + 0.14 * Math.sin(time * 8);
      ctx.strokeStyle = '#00ffcc'; // neon cyan glow
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#00ffcc';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 1.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const bob = Math.sin(this.walkPhase) * 1.5;
    const flashing = this.hitFlash > 0 && Math.floor(this.hitFlash * 20) % 2 === 0;
    const skin = getCharacter(this.charId);

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
    ctx.fillStyle = skin.camo;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 7.5, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skin.camoStroke;
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

    // Glowing night-vision goggles / tactical visor — shadowBlur is expensive and this
    // ran every frame for every player regardless of state; only pay for the glow
    // while actually flashing from a hit.
    ctx.fillStyle = flashing ? '#ff3b52' : skin.visor;
    if (flashing) { ctx.shadowBlur = 15; ctx.shadowColor = '#ff3b52'; }
    ctx.fillRect(4.5, -4, 2, 8); // visor lens

    // Draw NVG strap highlights
    if (flashing) ctx.shadowBlur = 0;
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
    } else if (wDef.key === 'revolver') {
      // Colt Python: short barrel, chunky cylinder
      ctx.fillRect(5, 2.5, 7, 3);
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(9, 4, 3, 0, Math.PI * 2); ctx.fill(); // cylinder
      ctx.fillStyle = '#111';
      ctx.fillRect(3.5, 5.5, 2, 3); // grip
    } else if (wDef.key === 'mac10') {
      // MAC-10: stubby body, folded stock, long stick mag
      ctx.fillRect(4, 2, 9, 3.5); // receiver
      ctx.fillStyle = '#222';
      ctx.fillRect(7, 5.5, 2, 6); // long stick magazine
      ctx.fillStyle = '#111';
      ctx.fillRect(-2, 3, 6, 1.5); // folded stock
      ctx.fillRect(13, 3, 5, 1.8); // short barrel
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

    // 5. Draw active energy shield bubble
    if (this.shieldHp > 0) {
      ctx.save();
      ctx.translate(this.x, this.y + bob);
      const pulseRadius = this.radius * 1.45 + Math.sin(time * 8) * 1.5;
      ctx.strokeStyle = 'rgba(28, 108, 255, ' + (0.55 + 0.15 * Math.sin(time * 4)) + ')';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#1c6cff';
      ctx.beginPath();
      ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(28, 108, 255, 0.08)';
      ctx.fill();
      ctx.restore();
    }

    // 6. Draw melee slash arc
    if (this.meleeSwing > 0) {
      const prog = 1 - this.meleeSwing / 0.22; // 0 -> 1 over the swing
      ctx.save();
      ctx.translate(this.x, this.y + bob);
      ctx.rotate(this.aimAngle);
      ctx.globalAlpha = Math.max(0, 1 - prog);
      ctx.strokeStyle = '#eaffff';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 14; ctx.shadowColor = '#bfffff';
      const half = this.meleeArc / 2;
      // sweep from one side of the arc to the other as the swing progresses
      const a = -half + this.meleeArc * prog;
      ctx.beginPath();
      ctx.arc(0, 0, this.meleeRange, a - 0.5, a + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
}
