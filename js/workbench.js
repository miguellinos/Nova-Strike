// ---------- workbench.js : static world object where weapons are bought/upgraded ----------
class Workbench {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 34;
    this.interactRange = 80;
  }

  draw(ctx, time, near) {
    const pulse = 0.7 + 0.3 * Math.sin(time * 3);
    ctx.save();
    ctx.translate(this.x, this.y);

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.7, this.radius * 1.1, this.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // workbench table (military crate-table look)
    ctx.fillStyle = '#4f3b28';
    ctx.fillRect(-this.radius, -this.radius * 0.55, this.radius * 2, this.radius * 1.1);
    ctx.strokeStyle = '#2a1f14';
    ctx.lineWidth = 3;
    ctx.strokeRect(-this.radius, -this.radius * 0.55, this.radius * 2, this.radius * 1.1);

    // metal top plate
    ctx.fillStyle = '#5c5f5a';
    ctx.fillRect(-this.radius * 0.85, -this.radius * 0.7, this.radius * 1.7, this.radius * 0.35);
    ctx.strokeStyle = '#2b2d2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-this.radius * 0.85, -this.radius * 0.7, this.radius * 1.7, this.radius * 0.35);

    // wrench + gear icon glow
    ctx.shadowBlur = near ? 22 : 12;
    ctx.shadowColor = near ? '#ffcc33' : '#ffaa00';
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffcc33';
    ctx.fillText('🔧', 0, -this.radius * 1.05);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}
