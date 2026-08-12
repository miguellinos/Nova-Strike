// ---------- profile.js : server-backed player profiles (simple name, no password) ----------
// Settings used to live only in localStorage (see settings.js). Profile adds a
// server-side home for them (a JSON file, via server/db.js) so a profile's
// settings follow it across browsers/machines on the LAN, not just one browser's
// storage. Without a server (file:// play), Profile.playOffline() keeps the game
// fully playable using a local-only profile.
const Profile = {
  current: null, // { id, name, settings, last_played_at } — id === null means offline/local

  // Offline fallback: when there's no server (e.g. playing straight from
  // file://), the game must still be playable. This selects a local-only
  // profile backed by localStorage; server syncs become no-ops.
  playOffline() {
    this.current = { id: null, name: 'Lokal', settings: Settings.data, last_played_at: Date.now() };
  },

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
    Settings.reset(); // so a profile with no saved settings doesn't inherit the last one's
    Object.assign(Settings.data, profile.settings);
    Settings.save();
    fetch(`/api/profiles/${profile.id}/touch`, { method: 'POST' }).catch(() => {});
  },

  // Fire-and-forget: pushes the current settings to the server in the background
  // so gameplay/menu interaction never waits on the network round-trip.
  syncSettings() {
    if (!this.current || this.current.id === null) return; // offline profile: localStorage only
    fetch(`/api/profiles/${this.current.id}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: Settings.data }),
    }).catch(() => {});
  },
};
window.Profile = Profile; // expose for settings.js's `if (window.Profile) ...` sync hook
