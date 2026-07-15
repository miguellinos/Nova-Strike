// ---------- input.js : keyboard & mouse ----------
const Input = {
  keys: {},
  mouse: { x: 0, y: 0, worldX: 0, worldY: 0, down: false, rightDown: false, rightPressed: false },
  pressed: {}, // one-frame edge triggers
  init(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // let text fields type normally
      const k = e.key.toLowerCase();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if (['w', 'a', 's', 'd', ' ', 'shift'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.keys[e.key.toLowerCase()] = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) { if (!this.mouse.rightDown) this.mouse.rightPressed = true; this.mouse.rightDown = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY > 0) this.pressed['wheeldown'] = true;
      else if (e.deltaY < 0) this.pressed['wheelup'] = true;
    }, { passive: false });
  },
  key(k) { return !!this.keys[k]; },
  wasPressed(k) { return !!this.pressed[k]; },
  clearFrame() { this.pressed = {}; this.mouse.rightPressed = false; },
};
