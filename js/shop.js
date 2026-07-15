// ---------- shop.js : static world object representing the physical shop counter ----------
class ShopTable {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 28;
    this.interactRange = 70;
  }

  draw(ctx, time, near) {
    const pulse = 0.7 + 0.3 * Math.sin(time * 3);
    ctx.save();
    ctx.translate(this.x, this.y);

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.6, this.radius * 1.1, this.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // shop counter (sleek tech terminal look)
    ctx.fillStyle = '#1b1b22';
    ctx.fillRect(-this.radius, -this.radius * 0.4, this.radius * 2, this.radius * 0.8);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = near ? 3 : 2;
    ctx.strokeRect(-this.radius, -this.radius * 0.4, this.radius * 2, this.radius * 0.8);

    // glowing screen / hologram on top
    ctx.shadowBlur = near ? 20 : 10;
    ctx.shadowColor = '#00ffcc';
    ctx.fillStyle = '#00ffcc';
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛒', 0, -this.radius * 0.85);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}

class TrainingRange {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 28;
    this.interactRange = 70;
  }

  draw(ctx, time, near) {
    const pulse = 0.7 + 0.3 * Math.sin(time * 3);
    ctx.save();
    ctx.translate(this.x, this.y);

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.6, this.radius * 1.1, this.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // training terminal
    ctx.fillStyle = '#112211';
    ctx.fillRect(-this.radius, -this.radius * 0.4, this.radius * 2, this.radius * 0.8);
    ctx.strokeStyle = '#4af626';
    ctx.lineWidth = near ? 3 : 2;
    ctx.strokeRect(-this.radius, -this.radius * 0.4, this.radius * 2, this.radius * 0.8);

    // glowing emblem
    ctx.shadowBlur = near ? 20 : 10;
    ctx.shadowColor = '#4af626';
    ctx.fillStyle = '#4af626';
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏋️', 0, -this.radius * 0.85);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}
