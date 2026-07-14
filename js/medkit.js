// ---------- medkit.js : health & shield pickups ----------
class Medkit {
  constructor(x, y, heal = 25) {
    this.x = x; this.y = y; this.heal = heal;
    this.radius = 11;
    this.vx = Utils.rand(-40, 40); this.vy = Utils.rand(-40, 40);
    this.dead = false;
    this.phase = Utils.rand(0, 6.28);
    this.life = 18; // despawns if left uncollected
  }
  update(dt, game) {
    const p = game.nearestPlayer(this.x, this.y);
    const d = Utils.dist(this.x, this.y, p.x, p.y);
    const range = p.mods.coinRange * 0.6;
    if (d < range) {
      const a = Utils.angle(this.x, this.y, p.x, p.y);
      const pull = Utils.lerp(300, 90, d / range);
      this.vx += Math.cos(a) * pull * dt * 6;
      this.vy += Math.sin(a) * pull * dt * 6;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.9; this.vy *= 0.9;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (d < p.radius + this.radius + 4) this.collect(game, p);
  }
  collect(game, p) {
    if (this.dead) return;
    this.dead = true;
    (p || game.player).medkitsCount++;
    Audio2.coin(); // play pickup sound
    game.particles.spawn(this.x, this.y, '#4af626', { count: 6, minSpeed: 30, maxSpeed: 90, life: 0.35, size: 3 });
  }
  draw(ctx, time) {
    const pulse = 0.75 + 0.25 * Math.sin(time * 5 + this.phase);
    const blink = this.life < 4 && Math.floor(this.life * 6) % 2 === 0;
    if (blink) return;
    const r = this.radius;
    
    ctx.shadowBlur = 10; ctx.shadowColor = '#4af626';
    ctx.globalAlpha = pulse;
    
    // Draw military style rectangular box (rounded corners or chamfered)
    ctx.fillStyle = '#2b381f'; // dark olive green pouch
    ctx.strokeStyle = '#1d2615';
    ctx.lineWidth = 2;
    ctx.fillRect(this.x - r, this.y - r * 0.75, r * 2, r * 1.5);
    ctx.strokeRect(this.x - r, this.y - r * 0.75, r * 2, r * 1.5);
    
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    
    // Draw white circle with green cross in center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#2b381f';
    const t = r * 0.12, arm = r * 0.32;
    ctx.fillRect(this.x - t, this.y - arm, t * 2, arm * 2);
    ctx.fillRect(this.x - arm, this.y - t, arm * 2, t * 2);
  }
}

class ShieldPickup {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 11;
    this.vx = Utils.rand(-40, 40); this.vy = Utils.rand(-40, 40);
    this.dead = false;
    this.phase = Utils.rand(0, 6.28);
    this.life = 18; // despawns if left uncollected
  }
  update(dt, game) {
    const p = game.nearestPlayer(this.x, this.y);
    const d = Utils.dist(this.x, this.y, p.x, p.y);
    const range = p.mods.coinRange * 0.6;
    if (d < range) {
      const a = Utils.angle(this.x, this.y, p.x, p.y);
      const pull = Utils.lerp(300, 90, d / range);
      this.vx += Math.cos(a) * pull * dt * 6;
      this.vy += Math.sin(a) * pull * dt * 6;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.9; this.vy *= 0.9;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (d < p.radius + this.radius + 4) this.collect(game, p);
  }
  collect(game, p) {
    if (this.dead) return;
    this.dead = true;
    (p || game.player).shieldsCount++;
    Audio2.coin(); // pickup sound
    game.particles.spawn(this.x, this.y, '#1c6cff', { count: 6, minSpeed: 30, maxSpeed: 90, life: 0.35, size: 3 });
  }
  draw(ctx, time) {
    const pulse = 0.75 + 0.25 * Math.sin(time * 5 + this.phase);
    const blink = this.life < 4 && Math.floor(this.life * 6) % 2 === 0;
    if (blink) return;
    const r = this.radius;
    
    ctx.shadowBlur = 10; ctx.shadowColor = '#1c6cff';
    ctx.globalAlpha = pulse;
    
    // Draw cylindrical battery cell (blue and grey)
    ctx.fillStyle = '#222'; // base cap
    ctx.fillRect(this.x - r * 0.5, this.y - r, r, r * 2);
    ctx.fillStyle = '#1c6cff'; // blue glowing core
    ctx.fillRect(this.x - r * 0.4, this.y - r * 0.6, r * 0.8, r * 1.2);
    
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    
    // Draw active shield symbol (little triangle shield in the center)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x - 3, this.y - 2);
    ctx.lineTo(this.x + 3, this.y - 2);
    ctx.lineTo(this.x + 2, this.y + 2);
    ctx.lineTo(this.x, this.y + 4);
    ctx.lineTo(this.x - 2, this.y + 2);
    ctx.closePath();
    ctx.stroke();
  }
}
