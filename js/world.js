// ---------- world.js : the tactical battlefield map ----------
class World {
  constructor() {
    this.w = 2400;
    this.h = 1800;
    this.rects = [];      // solid collision rects (walls, crates, obstacles)
    this.decor = [];      // barbwire, rubble, rocks
    this.energyDots = []; // blowing dust particles
    this.build();
  }
  build() {
    const t = 40; // border thickness
    // outer walls
    this.rects.push({ x: 0, y: 0, w: this.w, h: t, kind: 'wall' });
    this.rects.push({ x: 0, y: this.h - t, w: this.w, h: t, kind: 'wall' });
    this.rects.push({ x: 0, y: 0, w: t, h: this.h, kind: 'wall' });
    this.rects.push({ x: this.w - t, y: 0, w: t, h: this.h, kind: 'wall' });

    // interior obstacles / cover / crates / bunkers
    const obs = [
      [500, 400, 160, 40, 'wall'], [500, 400, 40, 260, 'wall'],
      [1700, 300, 200, 40, 'wall'], [1860, 300, 40, 220, 'wall'],
      [1100, 900, 200, 200, 'machine'], // central sandbag bunker / headquarters
      [400, 1300, 120, 120, 'crate'], [560, 1300, 120, 120, 'crate'],
      [1850, 1350, 140, 140, 'crate'], [1700, 1350, 120, 120, 'crate'],
      [300, 850, 40, 300, 'wall'],
      [1950, 750, 40, 300, 'wall'],
      [850, 250, 40, 200, 'wall'],
      [1500, 1450, 200, 40, 'wall'],
      [700, 700, 90, 90, 'crate'], [1600, 800, 90, 90, 'crate'],
    ];
    for (const o of obs) this.rects.push({ x: o[0], y: o[1], w: o[2], h: o[3], kind: o[4] });

    // generate static terrain features
    this.grassPatches = [];
    for (let i = 0; i < 90; i++) {
      this.grassPatches.push({
        x: Utils.rand(40, this.w - 40),
        y: Utils.rand(40, this.h - 40),
        size: Utils.rand(6, 14),
        blades: Utils.randInt(3, 6)
      });
    }

    this.groundCraters = [];
    for (let i = 0; i < 18; i++) {
      this.groundCraters.push({
        x: Utils.rand(120, this.w - 120),
        y: Utils.rand(120, this.h - 120),
        r: Utils.rand(30, 75),
        cracks: Utils.randInt(5, 9)
      });
    }

    this.mudPuddles = [];
    for (let i = 0; i < 15; i++) {
      this.mudPuddles.push({
        x: Utils.rand(120, this.w - 120),
        y: Utils.rand(120, this.h - 120),
        rx: Utils.rand(40, 90),
        ry: Utils.rand(20, 45),
        rot: Utils.rand(0, Math.PI)
      });
    }

    this.tireTracks = [];
    for (let i = 0; i < 10; i++) {
      this.tireTracks.push({
        x: Utils.rand(200, this.w - 200),
        y: Utils.rand(200, this.h - 200),
        w: Utils.rand(180, 420),
        h: Utils.rand(18, 26),
        angle: Utils.rand(0, Math.PI * 2)
      });
    }

    // decor: barbed wire & rubble (non-solid obstacles)
    for (let i = 0; i < 28; i++) {
      this.decor.push({
        x: Utils.rand(60, this.w - 60), y: Utils.rand(60, this.h - 60),
        r: Utils.rand(14, 24),
        type: Utils.pick(['barbwire', 'barbwire', 'rubble', 'rubble']),
        rot: Utils.rand(0, 6.28),
      });
    }

    // blowing dust / sandstorm particles
    for (let i = 0; i < 50; i++) {
      this.energyDots.push({
        x: Utils.rand(0, this.w), y: Utils.rand(0, this.h),
        vx: Utils.rand(60, 150), vy: Utils.rand(-15, 15),
        r: Utils.rand(20, 50), a: Utils.rand(0.03, 0.09)
      });
    }
  }
  update(dt) {
    // move dust storm clouds slowly to the right
    for (const d of this.energyDots) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x > this.w + d.r) {
        d.x = -d.r;
        d.y = Utils.rand(0, this.h);
      }
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
    // ground base (muddy military brown)
    ctx.fillStyle = '#221b14';
    ctx.fillRect(cam.x, cam.y, cam.w, cam.h);

    // 1. Draw mud puddles
    ctx.fillStyle = '#17120d'; // darker wet mud
    for (const p of this.mudPuddles) {
      if (p.x < cam.x - p.rx || p.x > cam.x + cam.w + p.rx || p.y < cam.y - p.ry || p.y > cam.y + cam.h + p.ry) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Draw tire tracks
    ctx.fillStyle = '#1c1610'; // darker compressed mud
    for (const t of this.tireTracks) {
      if (t.x < cam.x - 300 || t.x > cam.x + cam.w + 300 || t.y < cam.y - 300 || t.y > cam.y + cam.h + 300) continue;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);
      // main track lines
      ctx.fillRect(-t.w / 2, -t.h / 2, t.w, 4);
      ctx.fillRect(-t.w / 2, t.h / 2 - 4, t.w, 4);
      // track ribs
      for (let x = -t.w / 2; x < t.w / 2; x += 12) {
        ctx.fillRect(x, -t.h / 2, 3, t.h);
      }
      ctx.restore();
    }

    // 3. Draw ground craters
    ctx.strokeStyle = '#120d09';
    ctx.lineWidth = 3;
    for (const c of this.groundCraters) {
      if (c.x < cam.x - c.r || c.x > cam.x + cam.w + c.r || c.y < cam.y - c.r || c.y > cam.y + cam.h + c.r) continue;
      ctx.fillStyle = '#19130f';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // inner dark center
      ctx.fillStyle = '#0d0a07';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.65, 0, Math.PI * 2);
      ctx.fill();
      
      // crater crack rays
      ctx.beginPath();
      for (let i = 0; i < c.cracks; i++) {
        const a = (i / c.cracks) * Math.PI * 2;
        ctx.moveTo(c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r);
        ctx.lineTo(c.x + Math.cos(a) * (c.r * 1.4), c.y + Math.sin(a) * (c.r * 1.4));
      }
      ctx.stroke();
    }

    // 4. Draw grass / foliage patches
    for (const g of this.grassPatches) {
      if (g.x < cam.x - g.size || g.x > cam.x + cam.w + g.size || g.y < cam.y - g.size || g.y > cam.y + cam.h + g.size) continue;
      ctx.strokeStyle = '#2d3319'; // muddy olive-green grass
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < g.blades; i++) {
        const a = -Math.PI / 2 + (i - g.blades / 2) * 0.28;
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x + Math.cos(a) * g.size, g.y + Math.sin(a) * g.size);
      }
      ctx.stroke();
    }

    // 5. Draw blowing dust clouds (behind assets)
    ctx.fillStyle = '#4c3f30';
    for (const d of this.energyDots) {
      if (d.x < cam.x - d.r || d.x > cam.x + cam.w + d.r || d.y < cam.y - d.r || d.y > cam.y + cam.h + d.r) continue;
      ctx.globalAlpha = d.a;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 6. Draw decor barbwire and debris rubble
    for (const d of this.decor) {
      if (d.x < cam.x - 40 || d.x > cam.x + cam.w + 40 || d.y < cam.y - 40 || d.y > cam.y + cam.h + 40) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);

      if (d.type === 'barbwire') {
        ctx.strokeStyle = '#484d4b'; // rusty dark metal
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        // double spiral rings
        ctx.arc(0, 0, d.r * 0.5, 0, Math.PI * 2);
        ctx.arc(0, 0, d.r * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        // spike bars
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const sx = Math.cos(a) * d.r * 0.9;
          const sy = Math.sin(a) * d.r * 0.9;
          ctx.moveTo(sx - 3, sy - 3); ctx.lineTo(sx + 3, sy + 3);
          ctx.moveTo(sx + 3, sy - 3); ctx.lineTo(sx - 3, sy + 3);
        }
        ctx.stroke();
      } else {
        // stone/brick/metal battlefield rubble
        ctx.fillStyle = '#3a3835';
        ctx.strokeStyle = '#232220';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-d.r * 0.4, -d.r * 0.3);
        ctx.lineTo(d.r * 0.5, -d.r * 0.5);
        ctx.lineTo(d.r * 0.3, d.r * 0.4);
        ctx.lineTo(-d.r * 0.4, d.r * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // 7. Solid obstacles (concrete walls, wooden crates, sandbags)
    for (const r of this.rects) {
      if (r.x > cam.x + cam.w || r.x + r.w < cam.x || r.y > cam.y + cam.h || r.y + r.h < cam.y) continue;
      
      if (r.kind === 'wall') {
        // Concrete military barricade blocks
        ctx.fillStyle = '#4a4d49';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        
        ctx.strokeStyle = '#222321';
        ctx.lineWidth = 3;
        ctx.strokeRect(r.x, r.y, r.w, r.h);

        // draw details: concrete seams & cracks
        ctx.strokeStyle = '#323531';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // vertical seams every 60px
        for (let sx = r.x + 60; sx < r.x + r.w; sx += 60) {
          ctx.moveTo(sx, r.y); ctx.lineTo(sx, r.y + r.h);
        }
        // diagonal concrete cracks
        ctx.moveTo(r.x + 10, r.y + 10); ctx.lineTo(r.x + 25, r.y + 15); ctx.lineTo(r.x + 28, r.y + 35);
        ctx.moveTo(r.x + r.w - 15, r.y + r.h - 10); ctx.lineTo(r.x + r.w - 30, r.y + r.h - 22);
        ctx.stroke();
      } 
      else if (r.kind === 'crate') {
        // Wooden ammo crate
        ctx.fillStyle = '#4f3b28';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        
        ctx.strokeStyle = '#2a1f14';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        
        // inner wood frame
        ctx.strokeRect(r.x + 7, r.y + 7, r.w - 14, r.h - 14);
        
        // diagonal plank lines (cross)
        ctx.beginPath();
        ctx.moveTo(r.x + 7, r.y + 7); ctx.lineTo(r.x + r.w - 7, r.y + r.h - 7);
        ctx.moveTo(r.x + r.w - 7, r.y + 7); ctx.lineTo(r.x + 7, r.y + r.h - 7);
        ctx.stroke();

        // stenciled yellow star/text in the center
        ctx.fillStyle = 'rgba(255, 170, 0, 0.25)';
        ctx.beginPath();
        ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.16, 0, Math.PI * 2);
        ctx.fill();
      } 
      else if (r.kind === 'machine') {
        // Sandbag checkpoint bunker
        ctx.fillStyle = '#7a6d56'; // base khaki
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = '#484032';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(r.x, r.y, r.w, r.h);

        // draw stacked sandbags
        ctx.fillStyle = '#877a62';
        const bagW = 33, bagH = 16;
        for (let sy = r.y; sy < r.y + r.h; sy += bagH) {
          // stagger rows
          const offset = (Math.round(sy / bagH) % 2) * (bagW / 2);
          for (let sx = r.x - offset; sx < r.x + r.w; sx += bagW) {
            // clamp drawing inside bounds
            const bx = Math.max(r.x, sx);
            const bw = Math.min(r.x + r.w, sx + bagW) - bx;
            if (bw > 0) {
              ctx.strokeRect(bx, sy, bw, bagH);
              // highlights
              ctx.fillRect(bx + 2, sy + 2, bw - 4, bagH - 4);
            }
          }
        }
      }
    }
  }
}
