// ---------- world.js : the space station map ----------
class World {
  constructor() {
    this.w = 2400;
    this.h = 1800;
    this.rects = [];      // solid collision rects (walls, crates, obstacles)
    this.decor = [];      // neon lights, crystals, broken machines, energy particles
    this.energyDots = [];
    this.build();
  }
  build() {
    const t = 40; // border thickness
    // outer walls
    this.rects.push({ x: 0, y: 0, w: this.w, h: t, kind: 'wall' });
    this.rects.push({ x: 0, y: this.h - t, w: this.w, h: t, kind: 'wall' });
    this.rects.push({ x: 0, y: 0, w: t, h: this.h, kind: 'wall' });
    this.rects.push({ x: this.w - t, y: 0, w: t, h: this.h, kind: 'wall' });

    // interior obstacles / cover / crates / broken machines
    const obs = [
      [500, 400, 160, 40, 'wall'], [500, 400, 40, 260, 'wall'],
      [1700, 300, 200, 40, 'wall'], [1860, 300, 40, 220, 'wall'],
      [1100, 900, 200, 200, 'machine'], // central broken machine
      [400, 1300, 120, 120, 'crate'], [560, 1300, 120, 120, 'crate'],
      [1850, 1350, 140, 140, 'crate'], [1700, 1350, 120, 120, 'crate'],
      [300, 850, 40, 300, 'wall'],
      [1950, 750, 40, 300, 'wall'],
      [850, 250, 40, 200, 'wall'],
      [1500, 1450, 200, 40, 'wall'],
      [700, 700, 90, 90, 'crate'], [1600, 800, 90, 90, 'crate'],
    ];
    for (const o of obs) this.rects.push({ x: o[0], y: o[1], w: o[2], h: o[3], kind: o[4] });

    // decor: neon strips & crystals (non-solid)
    for (let i = 0; i < 26; i++) {
      this.decor.push({
        x: Utils.rand(60, this.w - 60), y: Utils.rand(60, this.h - 60),
        r: Utils.rand(6, 16), color: Utils.pick(['#2ff3ff', '#b14dff', '#2a6cff']),
        type: Utils.pick(['crystal', 'crystal', 'light']), phase: Utils.rand(0, 6.28),
      });
    }
    // floating energy particles
    for (let i = 0; i < 80; i++) {
      this.energyDots.push({ x: Utils.rand(0, this.w), y: Utils.rand(0, this.h),
        vy: Utils.rand(-8, -24), a: Utils.rand(0.1, 0.5) });
    }
  }
  update(dt) {
    for (const d of this.energyDots) {
      d.y += d.vy * dt;
      if (d.y < 0) { d.y = this.h; d.x = Utils.rand(0, this.w); }
    }
  }
  // a spawn point on the outer ring but not inside a wall
  randomSpawnPoint() {
    for (let i = 0; i < 30; i++) {
      const edge = Utils.randInt(0, 3);
      let x, y;
      if (edge === 0) { x = Utils.rand(80, this.w - 80); y = 90; }
      else if (edge === 1) { x = Utils.rand(80, this.w - 80); y = this.h - 90; }
      else if (edge === 2) { x = 90; y = Utils.rand(80, this.h - 80); }
      else { x = this.w - 90; y = Utils.rand(80, this.h - 80); }
      if (!pointInRects(x, y, this.rects, 30)) return { x, y };
    }
    return { x: this.w / 2, y: 90 };
  }
  draw(ctx, cam, time) {
    // floor grid
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
    const grid = 80;
    ctx.strokeStyle = 'rgba(40,80,160,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startX = Math.floor(cam.x / grid) * grid;
    const startY = Math.floor(cam.y / grid) * grid;
    for (let x = startX; x < cam.x + cam.w; x += grid) { ctx.moveTo(x, cam.y); ctx.lineTo(x, cam.y + cam.h); }
    for (let y = startY; y < cam.y + cam.h; y += grid) { ctx.moveTo(cam.x, y); ctx.lineTo(cam.x + cam.w, y); }
    ctx.stroke();

    // energy dots
    for (const d of this.energyDots) {
      if (d.x < cam.x - 20 || d.x > cam.x + cam.w + 20 || d.y < cam.y - 20 || d.y > cam.y + cam.h + 20) continue;
      ctx.globalAlpha = d.a;
      ctx.fillStyle = '#2ff3ff';
      ctx.fillRect(d.x, d.y, 2, 2);
    }
    ctx.globalAlpha = 1;

    // decor crystals / lights (glow)
    for (const d of this.decor) {
      if (d.x < cam.x - 40 || d.x > cam.x + cam.w + 40 || d.y < cam.y - 40 || d.y > cam.y + cam.h + 40) continue;
      const pulse = 0.6 + 0.4 * Math.sin(time * 2 + d.phase);
      ctx.globalAlpha = 0.5 * pulse;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      if (d.type === 'crystal') {
        ctx.moveTo(d.x, d.y - d.r); ctx.lineTo(d.x + d.r * 0.6, d.y); ctx.lineTo(d.x, d.y + d.r);
        ctx.lineTo(d.x - d.r * 0.6, d.y); ctx.closePath();
      } else { ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // solid rects
    for (const r of this.rects) {
      if (r.x > cam.x + cam.w || r.x + r.w < cam.x || r.y > cam.y + cam.h || r.y + r.h < cam.y) continue;
      let fill = '#16203c', stroke = '#3a63b8';
      if (r.kind === 'crate') { fill = '#243252'; stroke = '#4d78c8'; }
      else if (r.kind === 'machine') { fill = '#2a1840'; stroke = '#b14dff'; }
      ctx.fillStyle = fill;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      if (r.kind === 'machine') {
        ctx.fillStyle = 'rgba(177,77,255,' + (0.3 + 0.2 * Math.sin(time * 3)) + ')';
        ctx.fillRect(r.x + r.w / 2 - 10, r.y + r.h / 2 - 10, 20, 20);
      }
    }
  }
}
