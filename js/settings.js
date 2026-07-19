// ---------- settings.js : persisted options ----------
const Settings = {
  data: { master: 70, music: 50, sfx: 80, quality: 'high', fullscreen: false, character: 'woodland' },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('novastrike_settings'));
      if (s) Object.assign(this.data, s);
    } catch (e) {}
  },
  save() {
    try { localStorage.setItem('novastrike_settings', JSON.stringify(this.data)); } catch (e) {}
  },
  set(key, val) { this.data[key] = val; this.save(); if (window.Profile) Profile.syncSettings(); },
  masterVol() { return this.data.master / 100; },
  musicVol() { return (this.data.music / 100) * this.masterVol(); },
  sfxVol() { return (this.data.sfx / 100) * this.masterVol(); },
};
Settings.load();
