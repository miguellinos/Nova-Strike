// ---------- network.js : LAN co-op via local WebSocket relay (server/server.js) ----------

// Fed with packets from the remote peer; mimics the Input singleton's interface
// so Player.update() can drive a remote player exactly like a local one.
class RemoteInput {
  constructor() {
    this.keys = {};
    this.pressed = {};
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false };
  }
  applyPacket(d) {
    this.keys = d.keys || {};
    this.mouse.worldX = d.mouseWorldX || 0;
    this.mouse.worldY = d.mouseWorldY || 0;
    this.mouse.down = !!d.mouseDown;
    if (d.justPressed) for (const k of d.justPressed) this.pressed[k] = true;
  }
  key(k) { return !!this.keys[k]; }
  wasPressed(k) { return !!this.pressed[k]; }
  clearFrame() { this.pressed = {}; }
}

const Net = {
  ws: null,
  role: null,       // 'host' | 'guest'
  roomCode: null,
  hostReady: false,
  guestReady: false,
  peerConnected: false,
  handlers: {},      // event name -> callback

  on(event, cb) { this.handlers[event] = cb; },
  emit(event, data) { if (this.handlers[event]) this.handlers[event](data); },

  connect(ip) {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      let targetHost = location.host;
      if (ip) {
        targetHost = ip.includes(':') ? ip : `${ip}:3000`;
      }
      this.ws = new WebSocket(`${proto}://${targetHost}`);
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (e) => reject(e));
      this.ws.addEventListener('message', (ev) => this.handleMessage(JSON.parse(ev.data)));
      this.ws.addEventListener('close', () => this.emit('disconnected'));
    });
  },

  send(msg) { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)); },

  async hostGame() {
    this.role = 'host';
    this.hostReady = false; this.guestReady = false; this.peerConnected = false;
    await this.connect();
    this.send({ type: 'host' });
  },

  async joinGame(code, ip) {
    this.role = 'guest';
    this.hostReady = false; this.guestReady = false; this.peerConnected = false;
    await this.connect(ip);
    this.send({ type: 'join', code: code.toUpperCase() });
  },

  setReady() {
    if (this.role === 'host') this.hostReady = true; else this.guestReady = true;
    this.send({ type: 'ready' });
    this.emit('ready-changed', { hostReady: this.hostReady, guestReady: this.guestReady });
  },

  sendInput(data) { this.send({ type: 'input', data }); },
  sendSnapshot(data) { this.send({ type: 'snapshot', data }); },
  sendStart(gameMode) { this.send({ type: 'start', gameMode }); },

  handleMessage(msg) {
    switch (msg.type) {
      case 'room-created':
        this.roomCode = msg.code;
        this.emit('room-created', msg);
        break;
      case 'joined':
        this.peerConnected = true;
        this.emit('joined', msg);
        break;
      case 'join-error':
        this.emit('join-error', msg);
        break;
      case 'guest-joined':
        this.peerConnected = true;
        this.emit('guest-joined', msg);
        break;
      case 'ready':
        if (this.role === 'host') this.guestReady = true; else this.hostReady = true;
        this.emit('ready-changed', { hostReady: this.hostReady, guestReady: this.guestReady });
        break;
      case 'start':
        this.emit('start', msg);
        break;
      case 'input':
        this.emit('input', msg.data);
        break;
      case 'snapshot':
        this.emit('snapshot', msg.data);
        break;
      case 'host-left':
      case 'guest-left':
        this.peerConnected = false;
        this.emit('peer-left', msg);
        break;
    }
  },

  reset() {
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    this.ws = null; this.role = null; this.roomCode = null;
    this.hostReady = false; this.guestReady = false; this.peerConnected = false;
  },
};
