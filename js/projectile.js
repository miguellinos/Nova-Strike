// ---------- projectile.js ----------
class Projectile {
  constructor(x, y, angle, def, dmg, pierce, fromPlayer, crit = false) {
    this.x = x; this.y = y; this.startX = x; this.startY = y;
    this.vx = Math.cos(angle) * def.speed;
    this.vy = Math.sin(angle) * def.speed;
    this.angle = angle;
    this.damage = dmg;
    this.range = def.range;
    this.radius = def.radius;
    this.color = def.color;
    this.pierce = pierce;          // extra enemies it can pass through
    this.aoe = def.aoe || 0;
    this.fromPlayer = fromPlayer;
    this.crit = crit;
    this.dead = false;
    this.hitSet = new Set();
    this.trail = [];
  }
  update(dt, world) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Utils.dist(this.startX, this.startY, this.x, this.y) > this.range) this.dead = true;
    if (pointInRects(this.x, this.y, world.rects, this.radius)) this.dead = true;
  }
  draw(ctx) {
    // trail
    for (let i = 0; i < this.trail.length; i++) {
      const a = (i / this.trail.length) * 0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, this.radius * (i / this.trail.length), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // glow core
    ctx.shadowBlur = 12; ctx.shadowColor = this.color;
    ctx.fillStyle = this.crit ? '#fff' : this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + (this.crit ? 2 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
