// ---------- settings.js : persisted options ----------
const SETTINGS_DEFAULTS = { master: 70, music: 50, sfx: 80, quality: 'high', fullscreen: false, character: 'woodland' };
const Settings = {
  data: Object.assign({}, SETTINGS_DEFAULTS),
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('novastrike_settings'));
      if (s) Object.assign(this.data, s);
    } catch (e) {
      console.warn('Einstellungen konnten nicht gelesen werden:', e);
    }
  },
  // Back to factory defaults. Needed when switching profiles: a profile that has
  // never saved settings carries `{}`, which would otherwise leave the previous
  // profile's values in place and make them look like its own.
  reset() { Object.assign(this.data, SETTINGS_DEFAULTS); },
  save() {
    try { localStorage.setItem('novastrike_settings', JSON.stringify(this.data)); } catch (e) {
      console.warn('Einstellungen konnten nicht gespeichert werden:', e);
    }
  },
  set(key, val) { this.data[key] = val; this.save(); if (window.Profile) Profile.syncSettings(); },
  masterVol() { return this.data.master / 100; },
  musicVol() { return (this.data.music / 100) * this.masterVol(); },
  sfxVol() { return (this.data.sfx / 100) * this.masterVol(); },
};
Settings.load();
