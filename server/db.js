// ---------- db.js : SQLite-backed player profiles (name only, no password) ----------
// Uses node's built-in node:sqlite (no native module / node-gyp build needed).
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, 'novastrike.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    last_played_at INTEGER NOT NULL
  )
`);

function toProfile(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, settings: JSON.parse(row.settings), last_played_at: row.last_played_at };
}

function listProfiles() {
  return db.prepare('SELECT id, name, settings, last_played_at FROM profiles ORDER BY last_played_at DESC').all()
    .map(toProfile);
}

function getProfileByName(name) {
  return toProfile(db.prepare('SELECT id, name, settings, last_played_at FROM profiles WHERE name = ?').get(name));
}

function getProfile(id) {
  return toProfile(db.prepare('SELECT id, name, settings, last_played_at FROM profiles WHERE id = ?').get(id));
}

// Simple named profiles have no password, so "sign in" and "sign up" are the same
// action: an existing name resumes that profile, a new name creates one.
function getOrCreateProfile(name) {
  const existing = getProfileByName(name);
  if (existing) return existing;
  const now = Date.now();
  const info = db.prepare('INSERT INTO profiles (name, settings, created_at, last_played_at) VALUES (?, ?, ?, ?)')
    .run(name, '{}', now, now);
  return getProfile(info.lastInsertRowid);
}

function touchProfile(id) {
  db.prepare('UPDATE profiles SET last_played_at = ? WHERE id = ?').run(Date.now(), id);
}

function updateSettings(id, settings) {
  const info = db.prepare('UPDATE profiles SET settings = ?, last_played_at = ? WHERE id = ?')
    .run(JSON.stringify(settings), Date.now(), id);
  return info.changes > 0 ? getProfile(id) : null;
}

module.exports = { listProfiles, getOrCreateProfile, getProfile, touchProfile, updateSettings };
