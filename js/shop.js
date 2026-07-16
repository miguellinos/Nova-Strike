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

// The goal object for "Extraktion" mode: stand inside the ring (all alive
// players in co-op) to channel an escape. Locked until the squad has cleared
// at least one wave, so it can't be rushed for a trivial instant win.
class ExtractionPoint {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 60;
    this.interactRange = 90;
  }

  // ready: wave gate passed (helicopter is inbound at all)
  // progress: 0..1 channel fraction
  // active: someone is currently channeling right now
  draw(ctx, time, ready, progress, active) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 1.05, this.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // landing pad ring
    const pulse = 0.6 + 0.4 * Math.sin(time * (ready ? 3 : 1));
    ctx.strokeStyle = ready ? `rgba(74, 246, 38, ${0.5 + 0.3 * pulse})` : 'rgba(120, 120, 120, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = ready ? 'rgba(74, 246, 38, 0.25)' : 'rgba(120, 120, 120, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    // "H" landing marker
    ctx.fillStyle = ready ? 'rgba(74, 246, 38, 0.7)' : 'rgba(150, 150, 150, 0.5)';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', 0, 0);

    // channel progress arc
    if (ready && progress > 0) {
      ctx.strokeStyle = active ? '#8fffb0' : 'rgba(143, 255, 176, 0.5)';
      ctx.lineWidth = 7;
      ctx.shadowBlur = active ? 18 : 0;
      ctx.shadowColor = '#8fffb0';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

class Atm {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 20;
    this.interactRange = 60;
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

    // ATM cabinet
    ctx.fillStyle = '#2a2d33';
    ctx.fillRect(-this.radius, -this.radius * 0.4, this.radius * 2, this.radius * 0.8);
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = near ? 3 : 2;
    ctx.strokeRect(-this.radius, -this.radius * 0.4, this.radius * 2, this.radius * 0.8);

    // Glowing ATM icon
    ctx.shadowBlur = near ? 20 : 10;
    ctx.shadowColor = '#ffcc00';
    ctx.fillStyle = '#ffcc00';
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏧', 0, -this.radius * 0.85);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}
