// ---------- utils.js : math & helpers ----------
const Utils = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.hypot(dx, dy); },
  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
  angle(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  // circle vs axis-aligned rect collision resolution -> returns adjusted {x,y}
  chance(p) { return Math.random() < p; },
};

// Circle vs rectangles: push circle out of any overlapping rect. rects: {x,y,w,h}
function resolveCircleRects(cx, cy, r, rects) {
  let x = cx, y = cy;
  for (const rc of rects) {
    const nx = Utils.clamp(x, rc.x, rc.x + rc.w);
    const ny = Utils.clamp(y, rc.y, rc.y + rc.h);
    let dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      let d = Math.sqrt(d2);
      if (d === 0) {
        // center inside rect: push out along smallest axis
        const left = x - rc.x, right = rc.x + rc.w - x;
        const top = y - rc.y, bottom = rc.y + rc.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = rc.x - r;
        else if (m === right) x = rc.x + rc.w + r;
        else if (m === top) y = rc.y - r;
        else y = rc.y + rc.h + r;
      } else {
        const overlap = r - d;
        x += (dx / d) * overlap;
        y += (dy / d) * overlap;
      }
    }
  }
  return { x, y };
}

// does a point (or small circle) hit any rect?
function pointInRects(x, y, rects, r = 0) {
  for (const rc of rects) {
    if (x + r > rc.x && x - r < rc.x + rc.w && y + r > rc.y && y - r < rc.y + rc.h) return true;
  }
  return false;
}
