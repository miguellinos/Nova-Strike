// ---------- server.js : static file server + WebSocket relay for one LAN co-op room ----------
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
};

function localIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

function makeRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// single-room MVP state
const room = { code: makeRoomCode(), host: null, guest: null };

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

wss.on('connection', (ws) => {
  ws.role = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'host') {
      room.host = ws;
      room.guest = null;
      ws.role = 'host';
      send(ws, { type: 'room-created', code: room.code, ips: localIPs(), port: PORT });
      return;
    }

    if (msg.type === 'join') {
      if (!room.host || room.host.readyState !== ws.OPEN) {
        send(ws, { type: 'join-error', reason: 'no-room' });
        return;
      }
      if (String(msg.code || '').toUpperCase() !== room.code) {
        send(ws, { type: 'join-error', reason: 'bad-code' });
        return;
      }
      room.guest = ws;
      ws.role = 'guest';
      send(ws, { type: 'joined' });
      send(room.host, { type: 'guest-joined' });
      return;
    }

    // relay everything else (ready, input, snapshot, start) to the other side
    const target = ws.role === 'host' ? room.guest : ws.role === 'guest' ? room.host : null;
    send(target, msg);
  });

  ws.on('close', () => {
    if (ws.role === 'host') {
      room.host = null;
      send(room.guest, { type: 'host-left' });
    } else if (ws.role === 'guest') {
      room.guest = null;
      send(room.host, { type: 'guest-left' });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Nova Strike LAN server läuft auf Port ${PORT}`);
  console.log(`Raumcode: ${room.code}`);
  const ips = localIPs();
  if (ips.length) {
    console.log('Für den Gast im selben WLAN erreichbar unter:');
    for (const ip of ips) console.log(`  http://${ip}:${PORT}`);
  }
  console.log(`Host selbst öffnet: http://localhost:${PORT}`);
});
