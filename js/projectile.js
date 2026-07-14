// ---------- projectile.js ----------
class Projectile {
  constructor(x, y, angle, def, dmg, pierce, fromPlayer, crit = false, owner = null) {
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
    this.burn = def.burn || 0;     // burning damage-per-second applied on hit
    this.slow = def.slow || 0;     // slow duration (s) applied on hit
    this.chain = def.chain || 0;   // lightning chain jumps
    this.fromPlayer = fromPlayer;
    this.owner = owner;            // which Player fired this (for kill/coin attribution in co-op)
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
    if (this.aoe > 0) {
      // Rocket launcher projectile (RPG-7)
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      
      // Shadow glow for rocket engine
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff6f00';
      
      // Rocket tail flame
      ctx.fillStyle = '#ff3300';
      ctx.beginPath();
      ctx.moveTo(-15, -4);
      ctx.lineTo(-25, 0);
      ctx.lineTo(-15, 4);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(-15, -2);
      ctx.lineTo(-20, 0);
      ctx.lineTo(-15, 2);
      ctx.closePath();
      ctx.fill();
      
      ctx.shadowBlur = 0;
      
      // Rocket body (cylinder, military green)
      ctx.fillStyle = '#4f5e3d';
      ctx.fillRect(-10, -4, 15, 8);
      
      // Nose cone (pointed head, dark grey / metallic)
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.moveTo(5, -4);
      ctx.lineTo(15, 0);
      ctx.lineTo(5, 4);
      ctx.closePath();
      ctx.fill();
      
      // Rocket fins (at the back)
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(-14, -8);
      ctx.lineTo(-8, -8);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(-10, 4);
      ctx.lineTo(-14, 8);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    } else {
      // Regular bullet tracer round (elongated capsule along its movement path)
      ctx.save();
      ctx.shadowBlur = this.crit ? 16 : 8;
      ctx.shadowColor = this.color;
      ctx.strokeStyle = this.crit ? '#ffffff' : this.color;
      ctx.lineWidth = this.radius * 1.5;
      ctx.lineCap = 'round';
      
      // Draw a line from current position to a point back along velocity
      const len = 15;
      const speed = Math.hypot(this.vx, this.vy);
      const dx = speed > 0 ? (this.vx / speed) * len : 0;
      const dy = speed > 0 ? (this.vy / speed) * len : 0;
      
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - dx, this.y - dy);
      ctx.stroke();
      
      // Draw inner white core for extra brightness/impact
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = this.radius * 0.6;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - dx * 0.7, this.y - dy * 0.7);
      ctx.stroke();
      
      ctx.restore();
    }
  }
}
