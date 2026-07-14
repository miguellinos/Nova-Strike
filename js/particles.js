// ---------- particles.js : lightweight particle & FX pool ----------
class Particles {
  constructor() { this.list = []; }
  spawn(x, y, color, opts = {}) {
    const count = opts.count || 6;
    for (let i = 0; i < count; i++) {
      const a = opts.angle != null ? opts.angle + Utils.rand(-opts.spread || -0.5, opts.spread || 0.5) : Utils.rand(0, Math.PI * 2);
      const spd = Utils.rand(opts.minSpeed || 40, opts.maxSpeed || 160);
      this.list.push({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: opts.life || Utils.rand(0.25, 0.5), maxLife: opts.life || 0.5,
        size: opts.size || Utils.rand(2, 4), color, drag: opts.drag || 0.9,
      });
    }
  }
  burst(x, y, color, count, speed) { this.spawn(x, y, color, { count, minSpeed: speed * 0.4, maxSpeed: speed, size: Utils.rand(3, 6), life: 0.6 }); }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= p.drag; p.vy *= p.drag;
    }
  }
  draw(ctx) {
    for (const p of this.list) {
      const alpha = Utils.clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  clear() { this.list.length = 0; }
}
