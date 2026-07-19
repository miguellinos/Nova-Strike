// ---------- db.js : file-backed player profiles (name only, no password) ----------
// A tiny JSON-file store — no native modules, no node:sqlite (which needs Node
// >=22.5). Works on any Node >=18 and is plenty for a single-LAN profile list.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'profiles.json');

// { nextId: number, profiles: [{ id, name, settings, created_at, last_played_at }] }
let store = { nextId: 1, profiles: [] };

function load() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.profiles)) {
      store = { nextId: parsed.nextId || 1, profiles: parsed.profiles };
    }
  } catch { /* no file yet or unreadable — start empty */ }
}
load();

function persist() {
  try { fs.writeFileSync(FILE, JSON.stringify(store, null, 2)); } catch { /* best effort */ }
}

function toProfile(p) {
  if (!p) return null;
  return { id: p.id, name: p.name, settings: p.settings || {}, last_played_at: p.last_played_at };
}

function listProfiles() {
  return store.profiles
    .slice()
    .sort((a, b) => b.last_played_at - a.last_played_at)
    .map(toProfile);
}

function getProfile(id) {
  return toProfile(store.profiles.find((p) => p.id === id));
}

// Simple named profiles have no password, so "sign in" and "sign up" are the same
// action: an existing name resumes that profile, a new name creates one.
function getOrCreateProfile(name) {
  const existing = store.profiles.find((p) => p.name === name);
  if (existing) return toProfile(existing);
  const now = Date.now();
  const p = { id: store.nextId++, name, settings: {}, created_at: now, last_played_at: now };
  store.profiles.push(p);
  persist();
  return toProfile(p);
}

function touchProfile(id) {
  const p = store.profiles.find((x) => x.id === id);
  if (p) { p.last_played_at = Date.now(); persist(); }
}

function updateSettings(id, settings) {
  const p = store.profiles.find((x) => x.id === id);
  if (!p) return null;
  p.settings = settings || {};
  p.last_played_at = Date.now();
  persist();
  return toProfile(p);
}

module.exports = { listProfiles, getOrCreateProfile, getProfile, touchProfile, updateSettings };
