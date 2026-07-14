// ---------- coin.js : collectible coins with magnet ----------
class Coin {
  constructor(x, y, value = 1) {
    this.x = x; this.y = y; this.value = value;
    this.radius = 6;
    this.vx = Utils.rand(-60, 60); this.vy = Utils.rand(-60, 60);
    this.dead = false;
    this.phase = Utils.rand(0, 6.28);
    this.collecting = false;
  }
  update(dt, game) {
    const p = game.player;
    const d = Utils.dist(this.x, this.y, p.x, p.y);
    // magnet
    if (d < p.mods.coinRange) {
      const a = Utils.angle(this.x, this.y, p.x, p.y);
      const pull = Utils.lerp(420, 120, d / p.mods.coinRange);
      this.vx += Math.cos(a) * pull * dt * 6;
      this.vy += Math.sin(a) * pull * dt * 6;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.9; this.vy *= 0.9;
    if (d < p.radius + this.radius + 4) this.collect(game);
  }
  collect(game) {
    if (this.dead) return;
    this.dead = true;
    game.player.coins += this.value;
    Audio2.coin();
    game.particles.spawn(this.x, this.y, '#ffcc33', { count: 6, minSpeed: 40, maxSpeed: 130, life: 0.4, size: 3 });
  }
  draw(ctx, time) {
    const pulse = 0.7 + 0.3 * Math.sin(time * 6 + this.phase);
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffcc33';
    ctx.fillStyle = '#ffcc33';
    ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff6cc';
    ctx.beginPath(); ctx.arc(this.x - 1.5, this.y - 1.5, this.radius * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}
