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

// Liang-Barsky segment-vs-AABB clip test: does the line from (x1,y1) to (x2,y2)
// pass through rc at all (partially or fully inside counts)?
function segmentIntersectsRect(x1, y1, x2, y2, rc) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - rc.x, rc.x + rc.w - x1, y1 - rc.y, rc.y + rc.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false; // parallel to this edge and outside it
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return true;
}

// is a straight line from (x1,y1) to (x2,y2) blocked by any of the given rects?
function segmentBlockedByRects(x1, y1, x2, y2, rects) {
  for (const rc of rects) {
    if (segmentIntersectsRect(x1, y1, x2, y2, rc)) return true;
  }
  return false;
// ---------- shared "field kiosk" chassis for interactable world props ----------
// Shop counter, workbench, training terminal and ATM all used to be a flat
// colored rectangle + a lone emoji — functional, but read as placeholder art.
// This draws one consistent, more detailed console shell (base plinth, angled
// warning stripe, status LED, glowing icon badge, animated ground ring when
// in range) that every prop below tints to its own accent color. Callers
// still draw their own icon glyph on top via `opts.icon`.
function drawFieldKiosk(ctx, x, y, time, near, opts) {
  const {
    radius = 30,
    accent = '#4af626',
    bodyTop = '#232a26',
    bodyBottom = '#141815',
    icon = '🔧',
    iconSize = 24,
    label = null,
  } = opts;
  const pulse = 0.65 + 0.35 * Math.sin(time * (near ? 5 : 2.4));
  const w = radius * 2, h = radius * 0.95;

  ctx.save();
  ctx.translate(x, y);

  // ground contact shadow, slightly wider than the base
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.62, radius * 1.15, radius * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  // proximity ring on the ground — the clearest possible "you can interact
  // here" signal, independent of the HUD prompt text
  if (near) {
    ctx.globalAlpha = 0.35 + 0.2 * pulse;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.62, radius * 1.5, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // base plinth: dark metal box with a subtle vertical gradient instead of a
  // flat fill, plus a beveled top edge and a diagonal hazard stripe accent
  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, bodyTop);
  grad.addColorStop(1, bodyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // bevel highlight along the top edge
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(-w / 2, -h / 2, w, 2);

  // diagonal accent stripe (tucked in a corner, subtle military kit detail)
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = w * 0.14;
  ctx.beginPath();
  ctx.moveTo(w / 2 - w * 0.22, -h / 2 - 4);
  ctx.lineTo(w / 2 + 4, h / 2 + 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // frame outline — brighter and thicker when the player is in range
  ctx.strokeStyle = accent;
  ctx.lineWidth = near ? 3 : 1.6;
  ctx.globalAlpha = near ? 1 : 0.7;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.globalAlpha = 1;

  // status LED, bottom-left corner: dim amber idle, bright + fast-pulsing accent when near
  ctx.beginPath();
  ctx.fillStyle = near ? accent : 'rgba(255,255,255,0.25)';
  ctx.globalAlpha = near ? (0.6 + 0.4 * pulse) : 0.5;
  ctx.arc(-w / 2 + 7, h / 2 - 7, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // floating icon badge above the console: soft glow disc + emoji, matching
  // the same "icon on a glow" language used on shop cards in the UI
  const iy = -h / 2 - radius * 0.55;
  ctx.globalAlpha = 0.55 * pulse;
  ctx.fillStyle = accent;
  ctx.shadowBlur = near ? 22 : 10;
  ctx.shadowColor = accent;
  ctx.beginPath();
  ctx.arc(0, iy, iconSize * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  ctx.font = `bold ${iconSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(icon, 0, iy);

  // small caption under the console (e.g. "SHOP", "F") — optional
  if (label) {
    ctx.font = '700 9px sans-serif';
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.85;
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, h / 2 + 11);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
