// ---------- profile.js : server-backed player profiles (simple name, no password) ----------
// Settings used to live only in localStorage (see settings.js). Profile adds a
// server-side home for them (SQLite, via server/db.js) so a profile's settings
// follow it across browsers/machines on the LAN, not just one browser's storage.
const Profile = {
  current: null, // { id, name, settings, last_played_at }

  async list() {
    const res = await fetch('/api/profiles');
    if (!res.ok) throw new Error('Profilliste konnte nicht geladen werden.');
    return res.json();
  },

  async getOrCreate(name) {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Profil konnte nicht erstellt werden.');
    return res.json();
  },

  select(profile) {
    this.current = profile;
    Object.assign(Settings.data, profile.settings);
    Settings.save();
    fetch(`/api/profiles/${profile.id}/touch`, { method: 'POST' }).catch(() => {});
  },

  // Fire-and-forget: pushes the current settings to the server in the background
  // so gameplay/menu interaction never waits on the network round-trip.
  syncSettings() {
    if (!this.current) return;
    fetch(`/api/profiles/${this.current.id}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: Settings.data }),
    }).catch(() => {});
  },
};
