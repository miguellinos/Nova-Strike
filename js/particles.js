// ---------- particles.js : lightweight particle & FX pool ----------
// Supports several cheap shapes so combat reads with real "juice":
//   dot    - default round spark, shrinks over life
//   streak - directional spark/tracer, a line drawn along its velocity
//   smoke  - soft translucent puff that grows and drifts (with optional rise)
//   ring   - expanding stroked shockwave ring (impacts / explosions / crits)
//   glow   - soft additive halo (muzzle flash, energy pops)
// All the original spawn() options still work unchanged — the new fields are
// opt-in, so every existing caller keeps behaving exactly as before.
class Particles {
  constructor() { this.list = []; }

  spawn(x, y, color, opts = {}) {
    const count = opts.count || 6;
    // Hard cap: intense fights (many burning/dying enemies) could otherwise queue
    // thousands of particles, each an extra draw call and GC allocation per frame.
    if (this.list.length > 640) this.list.splice(0, this.list.length - 640);
    const spread = opts.spread != null ? opts.spread : 0.5;
    for (let i = 0; i < count; i++) {
      const a = opts.angle != null
        ? opts.angle + Utils.rand(-spread, spread)
        : Utils.rand(0, Math.PI * 2);
      const spd = Utils.rand(opts.minSpeed || 40, opts.maxSpeed || 160);
      const life = opts.life != null ? opts.life : Utils.rand(0.25, 0.5);
      this.list.push({
        x, y,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life, maxLife: life,
        size: opts.size != null ? opts.size : Utils.rand(2, 4),
        color,
        drag: opts.drag != null ? opts.drag : 0.9,
        gravity: opts.gravity || 0,
        grow: opts.grow || 0,
        fade: opts.fade || 1,
        shape: opts.shape || 'dot',
        glow: opts.glow || false,
      });
    }
  }

  burst(x, y, color, count, speed) {
    this.spawn(x, y, color, { count, minSpeed: speed * 0.4, maxSpeed: speed, size: Utils.rand(3, 6), life: 0.6 });
  }

  // --- reusable FX helpers -------------------------------------------------

  // Directional metal/energy sparks flung in a cone around `angle`.
  sparks(x, y, angle, color, opts = {}) {
    this.spawn(x, y, color, {
      count: opts.count || 7, angle, spread: opts.spread != null ? opts.spread : 0.9,
      minSpeed: opts.minSpeed || 160, maxSpeed: opts.maxSpeed || 420,
      life: opts.life || Utils.rand(0.14, 0.32), size: opts.size || Utils.rand(1.4, 2.6),
      drag: 0.82, gravity: opts.gravity || 380, fade: 1.6, shape: 'streak',
    });
  }

  // Soft grey/colored smoke puff that grows and rises.
  smoke(x, y, opts = {}) {
    this.spawn(x, y, opts.color || 'rgba(120,120,120,1)', {
      count: opts.count || 4, minSpeed: opts.minSpeed || 8, maxSpeed: opts.maxSpeed || 34,
      life: opts.life || Utils.rand(0.4, 0.75), size: opts.size || Utils.rand(4, 8),
      drag: 0.9, gravity: opts.gravity != null ? opts.gravity : -30, grow: opts.grow || 34,
      fade: 0.7, shape: 'smoke',
    });
  }

  // Muzzle flash: a bright glow pop + fast forward sparks + a wisp of smoke.
  muzzle(x, y, angle, opts = {}) {
    const scale = opts.scale || 1;
    // core flash
    this.spawn(x, y, opts.flash || '#fff3c4', {
      count: 2, angle, spread: 0.3, minSpeed: 20 * scale, maxSpeed: 90 * scale,
      life: 0.07, size: (7 + Utils.rand(0, 4)) * scale, drag: 0.7, fade: 1.4, shape: 'glow',
    });
    this.spawn(x, y, opts.color || '#ffd24a', {
      count: Math.round(5 * scale), angle, spread: 0.5,
      minSpeed: 120 * scale, maxSpeed: 320 * scale, life: Utils.rand(0.08, 0.18),
      size: Utils.rand(1.6, 3) * scale, drag: 0.8, fade: 1.5, shape: 'streak',
    });
    this.smoke(x + Math.cos(angle) * 6, y + Math.sin(angle) * 6, {
      count: 2, color: 'rgba(90,90,90,1)', size: Utils.rand(3, 5) * scale, life: 0.32, maxSpeed: 26,
    });
  }

  // Bullet impact: directional sparks + a dust/blood puff + a small ring.
  impact(x, y, angle, color, opts = {}) {
    const back = angle + Math.PI; // splash back toward the shooter
    this.sparks(x, y, back, opts.spark || '#ffdf8a', {
      count: opts.count || 6, spread: 1.0, gravity: 260,
      minSpeed: 120, maxSpeed: 300, life: Utils.rand(0.12, 0.26),
    });
    this.spawn(x, y, color, {
      count: 4, angle: back, spread: 1.4, minSpeed: 30, maxSpeed: 120,
      life: 0.22, size: Utils.rand(2, 3.4), drag: 0.86, gravity: 120, fade: 1.3, shape: 'dot',
    });
    if (opts.ring !== false) this.ring(x, y, opts.ringColor || color, opts.ringSize || 16, 0.18);
  }

  // Expanding shockwave ring.
  ring(x, y, color, size, life) {
    this.list.push({
      x, y, vx: 0, vy: 0, life, maxLife: life, size: size * 0.4, color,
      drag: 1, gravity: 0, grow: size * 6, fade: 1, shape: 'ring', glow: false,
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      if (p.grow) p.size += p.grow * dt;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const t = Utils.clamp(p.life / p.maxLife, 0, 1);
      const alpha = p.fade === 1 ? t : Math.pow(t, p.fade);

      if (p.shape === 'streak') {
        const sp = Math.hypot(p.vx, p.vy);
        const len = Math.min(18, sp * 0.03 + p.size * 2);
        const ux = sp > 0 ? p.vx / sp : 1, uy = sp > 0 ? p.vy / sp : 0;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - ux * len, p.y - uy * len);
        ctx.stroke();
      } else if (p.shape === 'smoke') {
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'ring') {
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 3 * t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'glow') {
        // cheap additive-looking halo: two stacked translucent discs, no shadowBlur
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() { this.list.length = 0; }
}
