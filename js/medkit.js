// ---------- medkit.js : health pickup that restores HP ----------
class Medkit {
  constructor(x, y, heal = 25) {
    this.x = x; this.y = y; this.heal = heal;
    this.radius = 11;
    this.vx = Utils.rand(-40, 40); this.vy = Utils.rand(-40, 40);
    this.dead = false;
    this.phase = Utils.rand(0, 6.28);
    this.life = 18; // despawns if left uncollected
  }
  update(dt, game) {
    const p = game.player;
    const d = Utils.dist(this.x, this.y, p.x, p.y);
    // gentle magnet, half the coin range
    const range = p.mods.coinRange * 0.6;
    if (d < range) {
      const a = Utils.angle(this.x, this.y, p.x, p.y);
      const pull = Utils.lerp(300, 90, d / range);
      this.vx += Math.cos(a) * pull * dt * 6;
      this.vy += Math.sin(a) * pull * dt * 6;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.9; this.vy *= 0.9;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (d < p.radius + this.radius + 4) this.collect(game);
  }
  collect(game) {
    if (this.dead) return;
    this.dead = true;
    game.player.heal(this.heal);
    Audio2.heal();
    game.particles.spawn(this.x, this.y, '#4dff88', { count: 10, minSpeed: 40, maxSpeed: 140, life: 0.5, size: 3 });
  }
  draw(ctx, time) {
    const pulse = 0.75 + 0.25 * Math.sin(time * 5 + this.phase);
    const blink = this.life < 4 && Math.floor(this.life * 6) % 2 === 0; // flash before despawn
    if (blink) return;
    const r = this.radius;
    ctx.shadowBlur = 14; ctx.shadowColor = '#4dff88';
    // rounded white capsule
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#eafff2';
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // green cross
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#25c65a';
    const t = r * 0.34, arm = r * 0.62;
    ctx.fillRect(this.x - t, this.y - arm, t * 2, arm * 2);
    ctx.fillRect(this.x - arm, this.y - t, arm * 2, t * 2);
  }
}
