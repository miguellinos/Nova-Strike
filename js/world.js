// ---------- world.js : the tactical battlefield map ----------
// Two completely distinct map layouts — different hangar counts/positions AND
// different obstacle density/shape, not just rearranged furniture in the same shell.
// Picked randomly per match (the index is synced host->guest so both see the same map).
const MAP_LAYOUTS = [
  // Map 0: "Hangar-Komplex Alpha" — massive hangar buildings covering 80% of the map,
  // leaving road space outside.
  {
    name: 'Hangar-Komplex Alpha',
    hangars: [
      { x: 350, y: 80, w: 1950, h: 740, gateSide: 'south', name: 'Alpha Hangar Nord' },
      { x: 350, y: 980, w: 1950, h: 740, gateSide: 'north', name: 'Alpha Hangar Süd' },
    ],
    obs: [
      // format: [x, y, w, h, kind, angle]
      [870, 430, 160, 40, 'airplane-fuselage', 0],
      [1470, 1330, 160, 40, 'airplane-fuselage', Math.PI],
      [800, 870, 60, 60, 'fuel-tank'],
      [860, 870, 60, 60, 'fuel-tank'],
      [1200, 870, 80, 40, 'car', 0],
      [600, 1200, 40, 80, 'car', Math.PI / 2],
      [500, 300, 80, 80, 'crate'],
      [2000, 1200, 80, 80, 'crate'],
      [2100, 200, 60, 60, 'fuel-tank'],
      [2160, 200, 60, 60, 'fuel-tank'],
    ],
  },
  // Map 1: "Sektor 4 - Schlachtfeld" — open battlefield map layout, wide paths,
  // sandbags and fuel tank cover, completely different gameplay feel.
  {
    name: 'Sektor 4 - Schlachtfeld',
    hangars: [], // Open field, no hangars!
    obs: [
      [1100, 900, 200, 120, 'machine'],
      [1100, 500, 200, 35, 'wall'],
      [1100, 1550, 200, 35, 'wall'],
      [500, 700, 100, 100, 'crate'],
      [1800, 700, 100, 100, 'crate'],
      [500, 1300, 100, 100, 'crate'],
      [1800, 1300, 100, 100, 'crate'],
      [900, 1150, 90, 90, 'crate'],
      [1410, 1150, 90, 90, 'crate'],
      [400, 950, 60, 60, 'fuel-tank'],
      [460, 950, 60, 60, 'fuel-tank'],
      [1900, 950, 60, 60, 'fuel-tank'],
      [1960, 950, 60, 60, 'fuel-tank'],
    ],
  },
];

class World {
  constructor(layoutIndex) {
    this.w = 2400;
    this.h = 1800;
    this.rects = [];      // solid collision rects (walls, crates, obstacles)
    this.hangars = [];
    this.decor = [];      // barbwire, rubble, rocks
    this.energyDots = []; // blowing dust particles
    this.layoutIndex = (layoutIndex !== undefined && layoutIndex !== null)
      ? layoutIndex
      : Utils.randInt(0, MAP_LAYOUTS.length - 1);
    this.build();
  }

  // pushes a hangar's perimeter walls (with a gate gap) + its interior partition
  buildHangar(hx, hy, hw, hh, gateSide, name) {
    this.hangars.push({ x: hx, y: hy, w: hw, h: hh, name });
    const gateGap = 160; // standard door gap width
    const gate = (hw - gateGap) / 2; // calculate wall segment sizes
    if (gateSide === 'south') {
      this.rects.push({ x: hx, y: hy, w: hw, h: 25, kind: 'hangar-wall' }); // top
      this.rects.push({ x: hx, y: hy, w: 25, h: hh, kind: 'hangar-wall' }); // left
      this.rects.push({ x: hx + hw - 25, y: hy, w: 25, h: hh, kind: 'hangar-wall' }); // right
      this.rects.push({ x: hx, y: hy + hh - 25, w: gate, h: 25, kind: 'hangar-wall', gateSide: 'right' });
      this.rects.push({ x: hx + hw - gate, y: hy + hh - 25, w: gate, h: 25, kind: 'hangar-wall', gateSide: 'left' });
    } else {
      this.rects.push({ x: hx, y: hy + hh - 25, w: hw, h: 25, kind: 'hangar-wall' }); // bottom
      this.rects.push({ x: hx, y: hy, w: 25, h: hh, kind: 'hangar-wall' }); // left
      this.rects.push({ x: hx + hw - 25, y: hy, w: 25, h: hh, kind: 'hangar-wall' }); // right
      this.rects.push({ x: hx, y: hy, w: gate, h: 25, kind: 'hangar-wall', gateSide: 'right' });
      this.rects.push({ x: hx + hw - gate, y: hy, w: gate, h: 25, kind: 'hangar-wall', gateSide: 'left' });
    }
    this.addHangarInterior(hx, hy, hw, hh, gateSide);
  }

  build() {
    const t = 40; // border thickness
    // outer walls
    this.rects.push({ x: 0, y: 0, w: this.w, h: t, kind: 'wall' });
    this.rects.push({ x: 0, y: this.h - t, w: this.w, h: t, kind: 'wall' });
    this.rects.push({ x: 0, y: 0, w: t, h: this.h, kind: 'wall' });
    this.rects.push({ x: this.w - t, y: 0, w: t, h: this.h, kind: 'wall' });

    const layout = MAP_LAYOUTS[this.layoutIndex] || MAP_LAYOUTS[0];
    for (const h of layout.hangars) this.buildHangar(h.x, h.y, h.w, h.h, h.gateSide, h.name);
    for (const o of layout.obs) {
      this.rects.push({ x: o[0], y: o[1], w: o[2], h: o[3], kind: o[4], angle: o[5] || 0 });
    }

    // Shop building walls in the top-left (outside the hangars)
    this.rects.push({ x: 40, y: 200, w: 200, h: 20, kind: 'hangar-wall' }); // North wall
    this.rects.push({ x: 40, y: 400, w: 200, h: 20, kind: 'hangar-wall' }); // South wall
    
    // East wall leaving a doorway from 270 to 330
    this.rects.push({ x: 220, y: 200, w: 20, h: 70, kind: 'hangar-wall' }); // East wall top
    this.rects.push({ x: 220, y: 330, w: 20, h: 90, kind: 'hangar-wall' }); // East wall bottom

    this.workbenchPos = { x: 120, y: 470 };

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

  addHangarInterior(hx, hy, hw, hh, gateSide) {
    if (hw >= 600) return; // leave massive hangars open for airplanes and vehicles
    if (gateSide === 'south') {
      // Horizontal middle divider
      this.rects.push({ x: hx, y: hy + 140, w: 140, h: 25, kind: 'hangar-wall' });
      this.rects.push({ x: hx + 220, y: hy + 140, w: hw - 220, h: 25, kind: 'hangar-wall' });
      
      // Vertical top partition
      this.rects.push({ x: hx + 200, y: hy, w: 25, h: 50, kind: 'hangar-wall' });
      this.rects.push({ x: hx + 200, y: hy + 110, w: 25, h: 30, kind: 'hangar-wall' });
      
      // Vertical bottom partition
      this.rects.push({ x: hx + 140, y: hy + 140, w: 25, h: 50, kind: 'hangar-wall' });
      this.rects.push({ x: hx + 140, y: hy + 250, w: 25, h: hh - 250, kind: 'hangar-wall' });
    } else {
      // Horizontal middle divider
      this.rects.push({ x: hx, y: hy + 140, w: 140, h: 25, kind: 'hangar-wall' });
      this.rects.push({ x: hx + 220, y: hy + 140, w: hw - 220, h: 25, kind: 'hangar-wall' });
      
      // Vertical top partition
      this.rects.push({ x: hx + 140, y: hy, w: 25, h: 50, kind: 'hangar-wall' });
      this.rects.push({ x: hx + 140, y: hy + 110, w: 25, h: 30, kind: 'hangar-wall' });
      
      // Vertical bottom partition
      this.rects.push({ x: hx + 200, y: hy + 140, w: 25, h: 55, kind: 'hangar-wall' });
      this.rects.push({ x: hx + 200, y: hy + 250, w: 25, h: hh - 250, kind: 'hangar-wall' });
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

  randomHangarSpawnPoint() {
    if (!this.hangars || this.hangars.length === 0) {
      return this.randomSpawnPoint();
    }
    for (let i = 0; i < 50; i++) {
      const h = Utils.pick(this.hangars);
      if (!h) continue;
      const m = 40; // safe margin
      const rx = Utils.rand(h.x + m, h.x + h.w - m);
      const ry = Utils.rand(h.y + m, h.y + h.h - m);
      if (!pointInRects(rx, ry, this.rects, 25)) {
        return { x: rx, y: ry };
      }
    }
    const h = Utils.pick(this.hangars);
    if (!h) return this.randomSpawnPoint();
    return { x: h.x + h.w / 2, y: h.y + h.h / 2 };
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

    // 1b. Draw Hangar concrete floors
    for (const h of this.hangars) {
      if (h.x > cam.x + cam.w || h.x + h.w < cam.x || h.y > cam.y + cam.h || h.y + h.h < cam.y) continue;
      ctx.fillStyle = '#2b2f33'; // industrial dark concrete
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.strokeStyle = '#1d2024';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let gx = h.x + 70; gx < h.x + h.w; gx += 70) {
        ctx.moveTo(gx, h.y); ctx.lineTo(gx, h.y + h.h);
      }
      for (let gy = h.y + 60; gy < h.y + h.h; gy += 60) {
        ctx.moveTo(h.x, gy); ctx.lineTo(h.x + h.w, gy);
      }
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 170, 0, 0.12)';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h.name, h.x + h.w / 2, h.y + h.h / 2);
    }

    // 1c. Draw Shop Floor (on the left outside area)
    const shopFloorX = 40;
    const shopFloorY = 220;
    const shopFloorW = 180;
    const shopFloorH = 180;
    if (!(shopFloorX > cam.x + cam.w || shopFloorX + shopFloorW < cam.x || shopFloorY > cam.y + cam.h || shopFloorY + shopFloorH < cam.y)) {
      ctx.fillStyle = '#1e1c24'; // sleek dark purple-ish grey
      ctx.fillRect(shopFloorX, shopFloorY, shopFloorW, shopFloorH);
      
      // Draw grid/tiles
      ctx.strokeStyle = 'rgba(0, 255, 200, 0.15)'; // glowing cyan tiles
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let gx = shopFloorX + 45; gx < shopFloorX + shopFloorW; gx += 45) {
        ctx.moveTo(gx, shopFloorY); ctx.lineTo(gx, shopFloorY + shopFloorH);
      }
      for (let gy = shopFloorY + 45; gy < shopFloorY + shopFloorH; gy += 45) {
        ctx.moveTo(shopFloorX, gy); ctx.lineTo(shopFloorX + shopFloorW, gy);
      }
      ctx.stroke();

      // Draw "SHOP" on the floor
      ctx.fillStyle = 'rgba(0, 255, 200, 0.2)';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛒 SHOP', shopFloorX + shopFloorW / 2, shopFloorY + shopFloorH / 2);
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
      
      if (r.kind === 'hangar-wall') {
        // Steel hangar wall panel
        ctx.fillStyle = '#3a4146'; // steel slate grey
        ctx.fillRect(r.x, r.y, r.w, r.h);
        
        ctx.strokeStyle = '#1e2124';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        
        // metal corrugated lines or rivets
        ctx.fillStyle = '#4c555b'; // highlight metal
        const isHorizontal = r.w > r.h;
        if (isHorizontal) {
          for (let sx = r.x + 20; sx < r.x + r.w; sx += 20) {
            ctx.fillRect(sx, r.y + 2, 2, r.h - 4);
            ctx.fillStyle = '#1e2124';
            ctx.fillRect(sx - 1, r.y + 4, 1.5, 1.5);
            ctx.fillRect(sx - 1, r.y + r.h - 6, 1.5, 1.5);
            ctx.fillStyle = '#4c555b';
          }
        } else {
          for (let sy = r.y + 20; sy < r.y + r.h; sy += 20) {
            ctx.fillRect(r.x + 2, sy, r.w - 4, 2);
            ctx.fillStyle = '#1e2124';
            ctx.fillRect(r.x + 4, sy - 1, 1.5, 1.5);
            ctx.fillRect(r.x + r.w - 6, sy - 1, 1.5, 1.5);
            ctx.fillStyle = '#4c555b';
          }
        }

        // Draw yellow-black hazard stripes on gate ends
        if (r.gateSide) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(r.x, r.y, r.w, r.h);
          ctx.clip();
          
          const stripeW = 22;
          const startX = r.gateSide === 'left' ? r.x : r.x + r.w - stripeW;
          
          ctx.fillStyle = '#ffaa00';
          ctx.fillRect(startX, r.y, stripeW, r.h);
          
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 4;
          ctx.beginPath();
          for (let offset = -10; offset < r.h + stripeW; offset += 10) {
            ctx.moveTo(startX, r.y + offset);
            ctx.lineTo(startX + stripeW, r.y + offset - stripeW);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      else if (r.kind === 'wall') {
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
      else if (r.kind === 'fuel-tank') {
        drawFuelTank(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w / 2);
      }
      else if (r.kind === 'car') {
        drawCar(ctx, r.x + r.w / 2, r.y + r.h / 2, r.angle || 0);
      }
      else if (r.kind === 'airplane-fuselage') {
        drawAirplane(ctx, r.x + r.w / 2, r.y + r.h / 2, r.angle || 0);
      }
    }
  }
}

// ---------- Custom Vehicle/Obstacle Drawing Helpers ----------
function drawAirplane(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 15, 110, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 15, 30, 90, 0, 0, Math.PI * 2);
  ctx.fill();

  // Airplane Body (military grey)
  ctx.fillStyle = '#6b7280';
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 3.5;
  
  // Main fuselage
  ctx.beginPath();
  ctx.moveTo(-100, 0);
  ctx.quadraticCurveTo(0, -22, 100, 0);
  ctx.quadraticCurveTo(0, 22, -100, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Large swept back wings
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.moveTo(-20, -18);
  ctx.lineTo(-65, -105);
  ctx.lineTo(-35, -105);
  ctx.lineTo(20, -18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(-20, 18);
  ctx.lineTo(-65, 105);
  ctx.lineTo(-35, 105);
  ctx.lineTo(20, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tail wings (elevators)
  ctx.beginPath();
  ctx.moveTo(-80, -8);
  ctx.lineTo(-98, -38);
  ctx.lineTo(-86, -38);
  ctx.lineTo(-70, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-80, 8);
  ctx.lineTo(-98, 38);
  ctx.lineTo(-86, 38);
  ctx.lineTo(-70, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Canopy (cockpit window, glowing blue)
  ctx.fillStyle = 'rgba(6, 182, 212, 0.65)';
  ctx.strokeStyle = '#0891b2';
  ctx.beginPath();
  ctx.ellipse(32, 0, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Nose cone
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.moveTo(90, -5);
  ctx.lineTo(110, 0);
  ctx.lineTo(90, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawFuelTank(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.arc(0, r * 0.3, r, 0, Math.PI * 2);
  ctx.fill();

  // Tank body (orange-red cylinder)
  ctx.fillStyle = '#b45309'; // rust orange
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inner top plate
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.arc(0, -r * 0.1, r * 0.82, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Danger stripes / text on top
  ctx.fillStyle = '#1e2937';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FUEL', 0, -r * 0.1);

  ctx.restore();
}

function drawCar(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(-45, -23, 90, 46);

  // Wheels
  ctx.fillStyle = '#111';
  ctx.fillRect(-35, -26, 18, 7);
  ctx.fillRect(15, -26, 18, 7);
  ctx.fillRect(-35, 19, 18, 7);
  ctx.fillRect(15, 19, 18, 7);

  // Car Body (military green)
  ctx.fillStyle = '#3f4f33';
  ctx.strokeStyle = '#1e2417';
  ctx.lineWidth = 3.5;
  ctx.fillRect(-40, -19, 80, 38);
  ctx.strokeRect(-40, -19, 80, 38);

  // Windshield
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(5, -15, 6, 30);
  ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.fillRect(5, -15, 6, 30);

  // Hood grill
  ctx.fillStyle = '#2d3725';
  ctx.fillRect(20, -11, 14, 22);

  // Cargo back
  ctx.fillStyle = '#2d3725';
  ctx.fillRect(-35, -15, 30, 30);

  ctx.restore();
}
