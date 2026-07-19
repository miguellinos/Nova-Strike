// ---------- world.js : the tactical battlefield map ----------
// Map layouts differ not just in wall/obstacle geometry but in ground "vibe" —
// each has a color theme so not every map reads as the same brown war-torn dirt field.
const THEMES = {
  military: { // muddy war-zone brown (the original look)
    ground: '#221b14', mud: '#17120d', track: '#1c1610',
    crater: '#19130f', craterInner: '#0d0a07', craterStroke: '#120d09',
    grass: '#2d3319', dust: '#4c3f30',
  },
  arctic: { // frozen tundra — pale ice blues instead of mud brown
    ground: '#dce8ee', mud: '#a9c2cf', track: '#93b0bf',
    crater: '#6f8fa0', craterInner: '#425c6b', craterStroke: '#3a4f5c',
    grass: '#c3d8e0', dust: '#eef6fa',
  },
  toxic: { // alien/toxic swamp — sickly purples and acid green
    ground: '#241a2e', mud: '#33224a', track: '#2a1c3d',
    crater: '#4a2f5c', craterInner: '#170f22', craterStroke: '#5c2f5a',
    grass: '#6fbf3f', dust: '#5fbf6f',
  },
  desert: { // dry sandy dunes — warm tan instead of muddy brown
    ground: '#3a2f1e', mud: '#4a3d26', track: '#5c4c2e',
    crater: '#4f3f24', craterInner: '#2a2113', craterStroke: '#2e2416',
    grass: '#6b5a2e', dust: '#8a7040',
  },
};

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
      [1350, 870, 80, 40, 'car', 0],
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
    hangars: [
      { x: 450, y: 650, w: 220, h: 180, gateSide: 'south', name: 'Baracke West', isHouse: true },
      { x: 1730, y: 650, w: 220, h: 180, gateSide: 'south', name: 'Baracke Ost', isHouse: true },
    ],
    obs: [
      [1100, 900, 200, 120, 'machine'],
      [1100, 500, 200, 35, 'wall'],
      [1100, 1550, 200, 35, 'wall'],
      [500, 950, 100, 100, 'crate'],
      [1800, 950, 100, 100, 'crate'],
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
  // Map 2: "Wüsten-Kreuzung" — 3 hangars in a row along the south edge (not 2 in
  // corners), huge open desert to the north with only scattered standalone cover.
  {
    name: 'Wüsten-Kreuzung',
    theme: 'desert',
    hangars: [
      { x: 100, y: 1350, w: 520, h: 360, gateSide: 'north', name: 'Außenposten West' },
      { x: 940, y: 1350, w: 520, h: 360, gateSide: 'north', name: 'Außenposten Mitte' },
      { x: 1780, y: 1350, w: 520, h: 360, gateSide: 'north', name: 'Außenposten Ost' },
      { x: 400, y: 250, w: 220, h: 180, gateSide: 'south', name: 'Wüsten-Hütte West', isHouse: true },
      { x: 1780, y: 250, w: 220, h: 180, gateSide: 'south', name: 'Wüsten-Hütte Ost', isHouse: true },
    ],
    obs: [
      [300, 500, 90, 90, 'crate'], [1155, 250, 90, 90, 'crate'], [1950, 500, 90, 90, 'crate'],
      [900, 750, 200, 100, 'machine'],
      [700, 600, 30, 300, 'wall'], [1670, 600, 30, 300, 'wall'],
      [500, 950, 90, 90, 'crate'], [1810, 950, 90, 90, 'crate'], [1155, 1050, 90, 90, 'crate'],
    ],
  },
  // Map 3: "Bunker-Ring" — only 1 hangar (north-center), everything else is a huge
  // open field wrapped around a ring-shaped central fortress. Very different shape.
  {
    name: 'Bunker-Ring',
    theme: 'arctic',
    hangars: [
      { x: 920, y: 100, w: 560, h: 360, gateSide: 'south', name: 'Zentralkommando' },
      { x: 620, y: 800, w: 200, h: 160, gateSide: 'east', name: 'Ring-Ausguck West', isHouse: true },
      { x: 1580, y: 800, w: 200, h: 160, gateSide: 'west', name: 'Ring-Ausguck Ost', isHouse: true },
    ],
    obs: [
      // ring fortress around the map center, with a gap on each side to enter
      [950, 650, 200, 30, 'wall'], [1250, 650, 200, 30, 'wall'],
      [950, 1120, 200, 30, 'wall'], [1250, 1120, 200, 30, 'wall'],
      [950, 650, 30, 200, 'wall'], [950, 950, 30, 200, 'wall'],
      [1420, 650, 30, 200, 'wall'], [1420, 950, 30, 200, 'wall'],
      [1100, 850, 200, 100, 'machine'],
      // scattered cover in the big open field outside the ring
      [400, 300, 90, 90, 'crate'], [2000, 300, 90, 90, 'crate'],
      [400, 1500, 90, 90, 'crate'], [2000, 1500, 90, 90, 'crate'],
      [300, 900, 90, 90, 'crate'], [2100, 900, 90, 90, 'crate'],
    ],
  },
  // Map 4: "Giftsumpf-Anlage" — 4 small hangars spread along BOTH the east and west
  // edges (not north/south like every other map), diagonal cover lines through a
  // toxic swamp center. Different geometry AND a completely different color vibe.
  {
    name: 'Giftsumpf-Anlage',
    theme: 'toxic',
    hangars: [
      // hangars stay at x >= 350 / x <= 2000 like every other map, so none of them
      // ever overlap the shop building that's always built in the top-left corner
      { x: 320, y: 200, w: 480, h: 340, gateSide: 'south', name: 'Sumpf-Station Nordwest' },
      { x: 320, y: 1260, w: 480, h: 340, gateSide: 'north', name: 'Sumpf-Station Südwest' },
      { x: 1600, y: 200, w: 480, h: 340, gateSide: 'south', name: 'Sumpf-Station Nordost' },
      { x: 1600, y: 1260, w: 480, h: 340, gateSide: 'north', name: 'Sumpf-Station Südost' },
      { x: 385, y: 820, w: 200, h: 160, gateSide: 'south', name: 'Filterstation A', isHouse: true },
      { x: 1815, y: 820, w: 200, h: 160, gateSide: 'south', name: 'Filterstation B', isHouse: true },
    ],
    obs: [
      [1100, 850, 200, 100, 'machine'],
      [800, 500, 30, 260, 'wall'], [1600, 500, 30, 260, 'wall'],
      [800, 1040, 30, 260, 'wall'], [1600, 1040, 30, 260, 'wall'],
      [900, 620, 90, 90, 'crate'], [1410, 620, 90, 90, 'crate'],
      [900, 1090, 90, 90, 'crate'], [1410, 1090, 90, 90, 'crate'],
      [1155, 350, 90, 90, 'crate'], [1155, 1360, 90, 90, 'crate'],
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
    const layoutDef = MAP_LAYOUTS[this.layoutIndex] || MAP_LAYOUTS[0];
    this.theme = THEMES[layoutDef.theme] || THEMES.military;
    this.build();
    // Precomputed once instead of `world.rects.filter(...)` running fresh every
    // single frame inside Player.update() (60x/sec per player, so 120x/sec in co-op)
    // — rects are static after build(), filtering them repeatedly is pure waste.
    this.playerCollidableRects = this.rects.filter((r) => r.kind !== 'enemy-barrier');
    // solid walls only (no crates/barriers) — used for line-of-sight checks like
    // melee not reaching through a wall.
    this.wallRects = this.rects.filter((r) => r.kind === 'wall' || r.kind === 'hangar-wall');
  }

  // pushes a hangar's perimeter walls (with a gate gap) + its interior partition
  buildHangar(hx, hy, hw, hh, gateSide, name, isHouse = false) {
    this.hangars.push({ x: hx, y: hy, w: hw, h: hh, name, isHouse });
    const gateGap = isHouse ? 80 : 160; // standard door gap width
    if (gateSide === 'south') {
      const gate = (hw - gateGap) / 2;
      this.rects.push({ x: hx, y: hy, w: hw, h: 25, kind: 'hangar-wall' }); // top
      this.rects.push({ x: hx, y: hy, w: 25, h: hh, kind: 'hangar-wall' }); // left
      this.rects.push({ x: hx + hw - 25, y: hy, w: 25, h: hh, kind: 'hangar-wall' }); // right
      this.rects.push({ x: hx, y: hy + hh - 25, w: gate, h: 25, kind: 'hangar-wall', gateSide: 'right' });
      this.rects.push({ x: hx + hw - gate, y: hy + hh - 25, w: gate, h: 25, kind: 'hangar-wall', gateSide: 'left' });
    } else if (gateSide === 'north') {
      const gate = (hw - gateGap) / 2;
      this.rects.push({ x: hx, y: hy + hh - 25, w: hw, h: 25, kind: 'hangar-wall' }); // bottom
      this.rects.push({ x: hx, y: hy, w: 25, h: hh, kind: 'hangar-wall' }); // left
      this.rects.push({ x: hx + hw - 25, y: hy, w: 25, h: hh, kind: 'hangar-wall' }); // right
      this.rects.push({ x: hx, y: hy, w: gate, h: 25, kind: 'hangar-wall', gateSide: 'right' });
      this.rects.push({ x: hx + hw - gate, y: hy, w: gate, h: 25, kind: 'hangar-wall', gateSide: 'left' });
    } else if (gateSide === 'east') {
      const gateH = (hh - gateGap) / 2;
      this.rects.push({ x: hx, y: hy, w: 25, h: hh, kind: 'hangar-wall' }); // left
      this.rects.push({ x: hx, y: hy, w: hw, h: 25, kind: 'hangar-wall' }); // top
      this.rects.push({ x: hx, y: hy + hh - 25, w: hw, h: 25, kind: 'hangar-wall' }); // bottom
      this.rects.push({ x: hx + hw - 25, y: hy, w: 25, h: gateH, kind: 'hangar-wall' });
      this.rects.push({ x: hx + hw - 25, y: hy + hh - gateH, w: 25, h: gateH, kind: 'hangar-wall' });
    } else if (gateSide === 'west') {
      const gateH = (hh - gateGap) / 2;
      this.rects.push({ x: hx + hw - 25, y: hy, w: 25, h: hh, kind: 'hangar-wall' }); // right
      this.rects.push({ x: hx, y: hy, w: hw, h: 25, kind: 'hangar-wall' }); // top
      this.rects.push({ x: hx, y: hy + hh - 25, w: hw, h: 25, kind: 'hangar-wall' }); // bottom
      this.rects.push({ x: hx, y: hy, w: 25, h: gateH, kind: 'hangar-wall' });
      this.rects.push({ x: hx, y: hy + hh - gateH, w: 25, h: gateH, kind: 'hangar-wall' });
    }
    if (!isHouse) {
      this.addHangarInterior(hx, hy, hw, hh, gateSide);
    }
  }

  getBuildingAt(x, y) {
    if (!this.hangars) return null;
    for (const h of this.hangars) {
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
        return h;
      }
    }
    return null;
  }

  // stealth cover: true while (x,y) is inside a bush's leaf cluster.
  isInBush(x, y) {
    for (const d of this.decor) {
      if (d.type !== 'bush') continue;
      const hideR = d.r * 0.9;
      if (Utils.dist(x, y, d.x, d.y) < hideR) return true;
    }
    return false;
  }

  build() {
    const t = 40; // border thickness
    // outer walls (with doorway to the shop/workbench safe annex on the left from y: 200 to y: 800)
    this.rects.push({ x: 0, y: 0, w: this.w, h: t, kind: 'wall' });
    this.rects.push({ x: 0, y: this.h - t, w: this.w, h: t, kind: 'wall' });
    
    // Left outer wall split to leave an opening from y: 200 to y: 800
    this.rects.push({ x: 0, y: 0, w: t, h: 200, kind: 'wall' });
    this.rects.push({ x: 0, y: 800, w: t, h: this.h - 800, kind: 'wall' });
    
    this.rects.push({ x: this.w - t, y: 0, w: t, h: this.h, kind: 'wall' });

    // Build the Safe Haven Pocket Alcove extension on the left:
    // x: -300 to x: 0, y: 200 to y: 800
    this.rects.push({ x: -300, y: 200, w: 300, h: t, kind: 'wall' }); // North wall
    this.rects.push({ x: -300, y: 800 - t, w: 300, h: t, kind: 'wall' }); // South wall
    this.rects.push({ x: -300, y: 200, w: t, h: 600, kind: 'wall' }); // West wall
    
    // The player-only entrance gate (laser shield blocks enemies) at x: 0, y: 200..800
    this.rects.push({ x: 0, y: 200, w: t, h: 600, kind: 'enemy-barrier' });

    const layout = MAP_LAYOUTS[this.layoutIndex] || MAP_LAYOUTS[0];
    for (const h of layout.hangars) this.buildHangar(h.x, h.y, h.w, h.h, h.gateSide, h.name, h.isHouse);
    for (const o of layout.obs) {
      this.rects.push({ x: o[0], y: o[1], w: o[2], h: o[3], kind: o[4], angle: o[5] || 0 });
    }

    this.workbenchPos = { x: -150, y: 500 };

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

    // Generate decor (barbed wire, barrels, tires, bushes, toolboxes, server decks, cardboard boxes)
    this.decor = [];
    for (let i = 0; i < 60; i++) {
      const dx = Utils.rand(60, this.w - 60);
      const dy = Utils.rand(60, this.h - 60);
      
      // Clean safe haven camp
      if (dx < 20) continue;
      
      const building = this.getBuildingAt(dx, dy);
      let type;
      if (building) {
        // Indoor types suitable for hangars and outposts
        type = Utils.pick(['barrel', 'tires', 'toolbox', 'carton', 'ammo-crate', 'console', 'rubble']);
      } else {
        // Outdoor types
        type = Utils.pick(['bush', 'bush', 'barbwire', 'rubble', 'barrel', 'tires']);
      }
      
      // ~30% of bushes are grown larger — bigger hiding footprint, and reads
      // visually as denser cover instead of every bush being the same size.
      const big = type === 'bush' && Utils.chance(0.3);
      const r = type === 'bush' ? (big ? Utils.rand(34, 46) : Utils.rand(14, 24)) : Utils.rand(14, 24);

      this.decor.push({
        x: dx, y: dy,
        r,
        type,
        rot: Utils.rand(0, Math.PI * 2),
        color: type === 'barrel' ? Utils.pick(['#2b4a70', '#b54124', '#c98a28', '#38573c']) : null
      });

      // barrels are solid — block movement and line of sight like any other
      // obstacle instead of being walk-through decoration.
      if (type === 'barrel') {
        const half = r * 0.85;
        this.rects.push({ x: dx - half, y: dy - half, w: half * 2, h: half * 2, kind: 'barrel' });
      }
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
  // a spawn point on the outer ring but not inside a wall or building
  randomSpawnPoint() {
    if (this.hangars && this.hangars.length > 0 && Utils.chance(0.75)) {
      return this.randomHangarSpawnPoint();
    }
    for (let i = 0; i < 40; i++) {
      const edge = Utils.randInt(0, 3);
      let x, y;
      if (edge === 0) { x = Utils.rand(80, this.w - 80); y = 90; }
      else if (edge === 1) { x = Utils.rand(80, this.w - 80); y = this.h - 90; }
      else if (edge === 2) { x = 90; y = Utils.rand(80, this.h - 80); }
      else { x = this.w - 90; y = Utils.rand(80, this.h - 80); }
      if (!pointInRects(x, y, this.rects, 30) && this.getBuildingAt(x, y) === null) {
        return { x, y };
      }
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
    const theme = this.theme;
    // ground base (per-map color theme)
    ctx.fillStyle = theme.ground;
    ctx.fillRect(cam.x, cam.y, cam.w, cam.h);

    // 1. Draw mud puddles
    ctx.fillStyle = theme.mud;
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

    // 1c. Draw Safe Haven Pocket Floor
    const shopFloorX = -300;
    const shopFloorY = 200;
    const shopFloorW = 300;
    const shopFloorH = 600;
    if (!(shopFloorX > cam.x + cam.w || shopFloorX + shopFloorW < cam.x || shopFloorY > cam.y + cam.h || shopFloorY + shopFloorH < cam.y)) {
      ctx.fillStyle = '#1e1c24'; // sleek dark purple-ish grey
      ctx.fillRect(shopFloorX, shopFloorY, shopFloorW, shopFloorH);
      
      // Draw grid/tiles
      ctx.strokeStyle = 'rgba(0, 255, 200, 0.15)'; // glowing cyan tiles
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let gx = shopFloorX + 50; gx < shopFloorX + shopFloorW; gx += 50) {
        ctx.moveTo(gx, shopFloorY); ctx.lineTo(gx, shopFloorY + shopFloorH);
      }
      for (let gy = shopFloorY + 50; gy < shopFloorY + shopFloorH; gy += 50) {
        ctx.moveTo(shopFloorX, gy); ctx.lineTo(shopFloorX + shopFloorW, gy);
      }
      ctx.stroke();

      // Draw "BASE CAMP" on the floor
      ctx.fillStyle = 'rgba(0, 255, 200, 0.2)';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛡️ BASE CAMP', shopFloorX + shopFloorW / 2, shopFloorY + shopFloorH / 2);
    }

    // 2. Draw tire tracks
    ctx.fillStyle = theme.track;
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

    // 4. Draw grass / foliage patches
    for (const g of this.grassPatches) {
      if (g.x < cam.x - g.size || g.x > cam.x + cam.w + g.size || g.y < cam.y - g.size || g.y > cam.y + cam.h + g.size) continue;
      ctx.strokeStyle = theme.grass;
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
    ctx.fillStyle = theme.dust;
    for (const d of this.energyDots) {
      if (d.x < cam.x - d.r || d.x > cam.x + cam.w + d.r || d.y < cam.y - d.r || d.y > cam.y + cam.h + d.r) continue;
      ctx.globalAlpha = d.a;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 6. Draw decor barbwire, rubble, barrels, tires, bushes, toolboxes, cartons, ammo chests, and consoles
    for (const d of this.decor) {
      if (d.x < cam.x - 40 || d.x > cam.x + cam.w + 40 || d.y < cam.y - 40 || d.y > cam.y + cam.h + 40) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);

      if (d.type === 'barbwire') {
        ctx.strokeStyle = '#484d4b'; // rusty dark metal
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, d.r * 0.5, 0, Math.PI * 2);
        ctx.arc(0, 0, d.r * 0.9, 0, Math.PI * 2);
        ctx.stroke();
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
      } else if (d.type === 'rubble') {
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
      } else if (d.type === 'barrel') {
        const barrelColor = d.color || '#2b4a70';
        ctx.fillStyle = barrelColor;
        ctx.strokeStyle = '#161d24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, d.r * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Inner rim
        ctx.beginPath();
        ctx.arc(0, 0, d.r * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        // Cap
        ctx.fillStyle = '#10141a';
        ctx.beginPath();
        ctx.arc(d.r * 0.3, -d.r * 0.2, d.r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'tires') {
        ctx.fillStyle = '#1c1c1f';
        ctx.strokeStyle = '#0c0c0d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, d.r * 0.95, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // treads
        ctx.strokeStyle = '#2b2b30';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          ctx.moveTo(Math.cos(a) * d.r * 0.8, Math.sin(a) * d.r * 0.8);
          ctx.lineTo(Math.cos(a) * d.r * 0.95, Math.sin(a) * d.r * 0.95);
        }
        ctx.stroke();
        // Center hole
        ctx.fillStyle = theme.ground;
        ctx.beginPath();
        ctx.arc(0, 0, d.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'bush') {
        const bushColor = theme.grass || '#285e2b';
        ctx.fillStyle = bushColor;
        ctx.strokeStyle = '#183c1b';
        ctx.lineWidth = 1.5;
        // Draw organic overlapping leaf cluster
        ctx.beginPath();
        ctx.arc(-d.r * 0.2, -d.r * 0.2, d.r * 0.65, 0, Math.PI * 2);
        ctx.arc(d.r * 0.3, -d.r * 0.1, d.r * 0.6, 0, Math.PI * 2);
        ctx.arc(-d.r * 0.1, d.r * 0.3, d.r * 0.62, 0, Math.PI * 2);
        ctx.arc(d.r * 0.2, d.r * 0.2, d.r * 0.58, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (d.type === 'toolbox') {
        ctx.fillStyle = '#b82d23'; // toolbox red
        ctx.strokeStyle = '#1c0807';
        ctx.lineWidth = 2;
        const w = d.r * 1.5, h = d.r * 0.85;
        ctx.fillRect(-w/2, -h/2, w, h);
        ctx.strokeRect(-w/2, -h/2, w, h);
        // silver latch handle
        ctx.strokeStyle = '#cccccc';
        ctx.beginPath();
        ctx.moveTo(-w/4, 0); ctx.lineTo(w/4, 0);
        ctx.stroke();
      } else if (d.type === 'carton') {
        ctx.fillStyle = '#9c7347'; // cardboard tan
        ctx.strokeStyle = '#4f3b25';
        ctx.lineWidth = 2;
        const w = d.r * 1.25, h = d.r * 1.25;
        ctx.fillRect(-w/2, -h/2, w, h);
        ctx.strokeRect(-w/2, -h/2, w, h);
        // carton fold tape
        ctx.strokeStyle = '#c49e78';
        ctx.beginPath();
        ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0);
        ctx.stroke();
      } else if (d.type === 'ammo-crate') {
        ctx.fillStyle = '#3f4f38'; // olive military chest
        ctx.strokeStyle = '#181f16';
        ctx.lineWidth = 2.5;
        const w = d.r * 1.7, h = d.r * 0.85;
        ctx.fillRect(-w/2, -h/2, w, h);
        ctx.strokeRect(-w/2, -h/2, w, h);
        // tactical markings
        ctx.fillStyle = '#d1bf90';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AM-8', 0, 0);
      } else if (d.type === 'console') {
        ctx.fillStyle = '#2b2d30'; // steel mainframe console
        ctx.strokeStyle = '#16171a';
        ctx.lineWidth = 2.5;
        const w = d.r * 1.5, h = d.r * 1.0;
        ctx.fillRect(-w/2, -h/2, w, h);
        ctx.strokeRect(-w/2, -h/2, w, h);
        // glowing green monitor grid
        ctx.fillStyle = '#1bff54';
        ctx.fillRect(-w/3.2, -h/3.2, w/2.8, h/2.5);
      }
      ctx.restore();
    }

    // 7. Solid obstacles (concrete walls, wooden crates, sandbags)
    for (const r of this.rects) {
      if (r.x > cam.x + cam.w || r.x + r.w < cam.x || r.y > cam.y + cam.h || r.y + r.h < cam.y) continue;
      
      if (r.kind === 'enemy-barrier') {
        const pulse = 0.5 + 0.3 * Math.sin(time * 6);
        ctx.save();
        ctx.fillStyle = `rgba(0, 255, 240, ${pulse * 0.25})`;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        
        ctx.strokeStyle = `rgba(0, 255, 240, ${pulse * 0.75})`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00fff0';
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(r.x + r.w / 2, r.y);
        ctx.lineTo(r.x + r.w / 2, r.y + r.h);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      
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
