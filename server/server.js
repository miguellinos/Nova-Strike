// ---------- server.js : static file server + JSON API + WebSocket relay for one LAN co-op room ----------
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer, WebSocket } = require('ws');
const db = require('./db');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy(new Error('body too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJSON(res, status, obj) {
  const data = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(data);
}

// Returns true if the request was a profile API call and has been fully handled.
async function handleApi(req, res, reqPath) {
  if (reqPath === '/api/profiles' && req.method === 'GET') {
    sendJSON(res, 200, db.listProfiles());
    return true;
  }

  if (reqPath === '/api/profiles' && req.method === 'POST') {
    let body;
    try { body = JSON.parse((await readBody(req)) || '{}'); } catch { body = {}; }
    const name = String(body.name || '').trim().slice(0, 24);
    if (!name) { sendJSON(res, 400, { error: 'name required' }); return true; }
    sendJSON(res, 200, db.getOrCreateProfile(name));
    return true;
  }

  const settingsMatch = reqPath.match(/^\/api\/profiles\/(\d+)\/settings$/);
  if (settingsMatch && req.method === 'PUT') {
    let body;
    try { body = JSON.parse((await readBody(req)) || '{}'); } catch { body = {}; }
    const updated = db.updateSettings(Number(settingsMatch[1]), body.settings || {});
    if (updated) sendJSON(res, 200, updated);
    else sendJSON(res, 404, { error: 'profile not found' });
    return true;
  }

  const touchMatch = reqPath.match(/^\/api\/profiles\/(\d+)\/touch$/);
  if (touchMatch && req.method === 'POST') {
    db.touchProfile(Number(touchMatch[1]));
    sendJSON(res, 200, { ok: true });
    return true;
  }

  return false;
}

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
  let code = '';
  for (let i = 0; i < 4; i++) code += Math.floor(Math.random() * 10);
  return code;
}

// single-room MVP state
const room = { code: makeRoomCode(), host: null, guest: null };

const server = http.createServer(async (req, res) => {
  const reqPath = decodeURIComponent(req.url.split('?')[0]);

  if (reqPath.startsWith('/api/')) {
    try {
      const handled = await handleApi(req, res, reqPath);
      if (!handled) sendJSON(res, 404, { error: 'not found' });
    } catch (err) {
      sendJSON(res, 500, { error: 'internal error' });
    }
    return;
  }

  const filePath = path.join(ROOT, reqPath === '/' ? '/index.html' : reqPath);
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

wss.on('connection', (ws, req) => {
  ws.role = null;
  // Disable Nagle's algorithm: without this, small frequent packets (60Hz input,
  // 30Hz snapshots) can sit buffered for up to ~40ms waiting to be coalesced with
  // more data before the OS sends them — pure added latency for a game where every
  // packet is time-sensitive and none of them benefit from batching.
  req.socket.setNoDelay(true);
  console.log(`[connect] neue Verbindung von ${req.socket.remoteAddress}`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    // `null`, numbers and arrays all parse fine — reading .type off them would
    // throw inside this handler and take the whole server down with it.
    if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return;

    if (msg.type === 'host') {
      // one room per server: don't let a second client claim it and silently
      // drop the pair that is already playing
      if (room.host && room.host !== ws && room.host.readyState === WebSocket.OPEN) {
        send(ws, { type: 'join-error', reason: 'room-busy' });
        return;
      }
      room.host = ws;
      room.guest = null;
      ws.role = 'host';
      console.log(`[host] registriert, Code=${room.code}`);
      send(ws, { type: 'room-created', code: room.code, ips: localIPs(), port: PORT });
      return;
    }

    if (msg.type === 'join') {
      console.log(`[join] Versuch mit Code="${msg.code}" (erwartet "${room.code}"), Host aktiv=${!!(room.host && room.host.readyState === WebSocket.OPEN)}`);
      if (!room.host || room.host.readyState !== WebSocket.OPEN) {
        send(ws, { type: 'join-error', reason: 'no-room' });
        return;
      }
      if (String(msg.code || '').toUpperCase() !== room.code) {
        send(ws, { type: 'join-error', reason: 'bad-code' });
        return;
      }
      room.guest = ws;
      ws.role = 'guest';
      console.log('[join] erfolgreich, Mitspieler verbunden');
      send(ws, { type: 'joined' });
      send(room.host, { type: 'guest-joined' });
      return;
    }

    // relay everything else (ready, input, snapshot, start) to the other side —
    // forward the original raw bytes instead of JSON.stringify(msg) again: the
    // server only needed the parse above to read msg.type, the payload itself is
    // opaque to it and re-serializing it is wasted CPU on every single message
    // (60Hz input + 30Hz snapshots is the bulk of all traffic through this relay).
    const target = ws.role === 'host' ? room.guest : ws.role === 'guest' ? room.host : null;
    // .toString() so this always goes out as a text frame — ws.send() on a raw
    // Buffer defaults to a BINARY frame, which the client's `JSON.parse(ev.data)`
    // can't handle (ev.data would be a Blob/ArrayBuffer, not a string).
    if (target && target.readyState === target.OPEN) target.send(raw.toString());
  });

  ws.on('close', () => {
    if (ws.role === 'host') {
      console.log('[close] Host getrennt');
      room.host = null;
      send(room.guest, { type: 'host-left' });
    } else if (ws.role === 'guest') {
      console.log('[close] Gast getrennt');
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
