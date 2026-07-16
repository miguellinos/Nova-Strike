// ---------- workbench.js : static world object where weapons are bought/upgraded ----------
class Workbench {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 34;
    this.interactRange = 80;
  }

  draw(ctx, time, near) {
    // workbench keeps its own crate-table silhouette (wider/flatter than the
    // other kiosks, with a distinct metal top plate) since it's meant to read
    // as a physical workstation, not a terminal — but shares the same status
    // ring / LED / glowing icon badge language as the rest via drawFieldKiosk.
    const w = this.radius * 2, h = this.radius * 1.1;
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.7, this.radius * 1.15, this.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (near) {
      const pulse = 0.65 + 0.35 * Math.sin(time * 5);
      ctx.globalAlpha = 0.35 + 0.2 * pulse;
      ctx.strokeStyle = '#ffcc33';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, this.radius * 0.7, this.radius * 1.5, this.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // crate-table body with a gradient instead of a flat brown fill
    const bodyGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    bodyGrad.addColorStop(0, '#5c4630');
    bodyGrad.addColorStop(1, '#382a1c');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(-w / 2, -h / 2, w, 2);
    ctx.strokeStyle = '#2a1f14';
    ctx.lineWidth = near ? 3 : 2;
    ctx.globalAlpha = near ? 1 : 0.75;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.globalAlpha = 1;

    // brushed metal top plate with a couple of rivets for detail
    const plateW = this.radius * 1.7, plateH = this.radius * 0.35;
    const plateGrad = ctx.createLinearGradient(0, -h / 2 - plateH, 0, -h / 2);
    plateGrad.addColorStop(0, '#767b74');
    plateGrad.addColorStop(1, '#454944');
    ctx.fillStyle = plateGrad;
    ctx.fillRect(-plateW / 2, -h / 2 - plateH, plateW, plateH);
    ctx.strokeStyle = '#2b2d2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-plateW / 2, -h / 2 - plateH, plateW, plateH);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(-plateW / 2 + 5, -h / 2 - plateH / 2, 1.6, 0, Math.PI * 2);
    ctx.arc(plateW / 2 - 5, -h / 2 - plateH / 2, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // status LED
    const ledPulse = 0.65 + 0.35 * Math.sin(time * (near ? 5 : 2.4));
    ctx.beginPath();
    ctx.fillStyle = near ? '#ffcc33' : 'rgba(255,255,255,0.25)';
    ctx.globalAlpha = near ? (0.6 + 0.4 * ledPulse) : 0.5;
    ctx.arc(-w / 2 + 7, h / 2 - 7, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // floating wrench badge
    const iy = -h / 2 - plateH - this.radius * 0.55;
    ctx.globalAlpha = 0.55 * ledPulse;
    ctx.fillStyle = '#ffcc33';
    ctx.shadowBlur = near ? 22 : 12;
    ctx.shadowColor = '#ffcc33';
    ctx.beginPath();
    ctx.arc(0, iy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🔧', 0, iy);

    ctx.font = '700 9px sans-serif';
    ctx.fillStyle = '#ffcc33';
    ctx.globalAlpha = 0.85;
    ctx.fillText('WERKBANK', 0, h / 2 + 12);
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}
