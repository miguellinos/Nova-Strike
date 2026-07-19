// ---------- turret.js : deployable sentry (Waldläufer ability) ----------
// Intentionally minimal — no HP/collision of its own, just a timed auto-shooter.
// Reuses the existing Projectile class so it benefits from the same impact FX,
// pierce/AOE handling and rendering as player bullets.
const TURRET_DEF = {
  key: 'turret', name: 'Wachtposten', sound: 'smg',
  damage: 14, fireRate: 5, range: 480, mag: Infinity, reload: 0,
  speed: 820, pellets: 1, spread: 0.05, pierce: 0, radius: 4, color: '#8fffb0', aoe: 0,
};

class Turret {
  constructor(x, y, owner, duration = 12) {
    this.x = x; this.y = y;
    this.owner = owner;
    this.life = duration;
    this.maxLife = duration;
    this.range = TURRET_DEF.range;
    this.fireCooldown = 0.2; // brief spin-up before the first shot
    this.angle = 0;
    this.dead = false;
    this.deploySpin = 0.35; // small pop-in animation
  }

  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.deploySpin > 0) this.deploySpin -= dt;

    // acquire nearest living target (enemy or boss) in range
    let target = null, bestD = this.range;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = Utils.dist(this.x, this.y, e.x, e.y);
      if (d < bestD) { bestD = d; target = e; }
    }
    if (game.boss && !game.boss.dead) {
      const d = Utils.dist(this.x, this.y, game.boss.x, game.boss.y);
      if (d < bestD) { bestD = d; target = game.boss; }
    }
    if (!target) return;
    this.angle = Utils.angle(this.x, this.y, target.x, target.y);

    if (this.fireCooldown > 0) { this.fireCooldown -= dt; return; }
    this.fireCooldown = 1 / TURRET_DEF.fireRate;
    const bx = this.x + Math.cos(this.angle) * 14;
    const by = this.y + Math.sin(this.angle) * 14;
    game.projectiles.push(new Projectile(bx, by, this.angle, TURRET_DEF, TURRET_DEF.damage, 0, true, false, this.owner));
    game.particles.muzzle(bx, by, this.angle, { scale: 0.6, color: TURRET_DEF.color });
  }

  draw(ctx, time) {
    const popScale = this.deploySpin > 0 ? 1 - this.deploySpin / 0.35 : 1;
    const fadeOut = this.life < 1.5 ? this.life / 1.5 : 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = fadeOut;
    ctx.scale(0.5 + 0.5 * popScale, 0.5 + 0.5 * popScale);

    // base
    ctx.fillStyle = '#1c231d';
    ctx.strokeStyle = '#4af626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // faint range ring while active (helps read the threat zone) — guest-side
    // turrets are hydrated straight from the network snapshot (see
    // Game.applySnapshot), which doesn't carry `range`, so this must not
    // assume it's set; a non-finite radius here throws and would silently
    // abort the rest of that render() call (hiding the player/enemies/boss
    // drawn after this loop for as long as the turret exists).
    ctx.globalAlpha = fadeOut * 0.08;
    ctx.strokeStyle = '#4af626';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, this.range || TURRET_DEF.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = fadeOut;

    // rotating turret head
    ctx.rotate(this.angle);
    ctx.fillStyle = '#2f3b25';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = '#111';
    ctx.fillRect(4, -2, 14, 4);

    // muzzle glow while spinning up
    if (this.deploySpin > 0) {
      ctx.globalAlpha = fadeOut * (this.deploySpin / 0.35);
      ctx.fillStyle = '#8fffb0';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // countdown ring above it
    ctx.save();
    ctx.globalAlpha = fadeOut;
    const t = this.life / this.maxLife;
    ctx.strokeStyle = '#4af626';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y - 22, 8, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
