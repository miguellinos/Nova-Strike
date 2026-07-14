// ---------- audio.js : procedural WebAudio SFX + music ----------
const Audio2 = {
  ctx: null, master: null, musicGain: null, sfxGain: null, musicTimer: 0, musicStep: 0, intensity: 1,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.master);
      this.applyVolumes();
    } catch (e) { console.warn('No audio', e); }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = 1;
    this.sfxGain.gain.value = Settings.sfxVol();
    this.musicGain.gain.value = Settings.musicVol() * 0.5;
  },
  tone({ freq = 440, type = 'sine', dur = 0.1, vol = 0.3, slideTo = null, delay = 0, dest = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise({ dur = 0.15, vol = 0.3, filter = 1200, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
  },
  shoot(kind) {
    const map = {
      plasma: { freq: 620, slideTo: 180, type: 'square', dur: 0.09, vol: 0.18 },
      rifle: { freq: 720, slideTo: 300, type: 'sawtooth', dur: 0.06, vol: 0.13 },
      shotgun: { freq: 300, slideTo: 90, type: 'sawtooth', dur: 0.14, vol: 0.25 },
      sniper: { freq: 900, slideTo: 120, type: 'square', dur: 0.2, vol: 0.24 },
      cannon: { freq: 160, slideTo: 40, type: 'sawtooth', dur: 0.28, vol: 0.32 },
    };
    this.tone(map[kind] || map.plasma);
  },
  reload() { this.tone({ freq: 200, slideTo: 500, type: 'square', dur: 0.12, vol: 0.15 });
             this.tone({ freq: 600, type: 'sine', dur: 0.08, vol: 0.12, delay: 0.14 }); },
  hit() { this.noise({ dur: 0.06, vol: 0.12, filter: 2500 }); },
  explosion() { this.noise({ dur: 0.4, vol: 0.4, filter: 900 });
                this.tone({ freq: 120, slideTo: 30, type: 'sawtooth', dur: 0.4, vol: 0.3 }); },
  enemyDie() { this.tone({ freq: 300, slideTo: 60, type: 'square', dur: 0.14, vol: 0.14 }); },
  coin() { this.tone({ freq: 1100, type: 'sine', dur: 0.07, vol: 0.14 });
           this.tone({ freq: 1600, type: 'sine', dur: 0.08, vol: 0.12, delay: 0.05 }); },
  heal() { this.tone({ freq: 700, slideTo: 1200, type: 'sine', dur: 0.14, vol: 0.18 });
           this.tone({ freq: 1000, slideTo: 1500, type: 'sine', dur: 0.16, vol: 0.14, delay: 0.08 }); },
  buy() { this.tone({ freq: 500, slideTo: 900, type: 'sine', dur: 0.1, vol: 0.2 });
          this.tone({ freq: 900, slideTo: 1300, type: 'sine', dur: 0.12, vol: 0.18, delay: 0.1 }); },
  dash() { this.tone({ freq: 700, slideTo: 1400, type: 'sine', dur: 0.18, vol: 0.16 }); },
  hurt() { this.tone({ freq: 180, slideTo: 60, type: 'sawtooth', dur: 0.16, vol: 0.2 }); },
  bossSpawn() { this.tone({ freq: 90, slideTo: 200, type: 'sawtooth', dur: 0.8, vol: 0.4 });
                this.noise({ dur: 0.8, vol: 0.2, filter: 500 }); },
  // simple procedural bassline that intensifies each wave
  setIntensity(i) { this.intensity = i; },
  updateMusic(dt) {
    if (!this.ctx || Settings.musicVol() <= 0) return;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      const bpm = 96 + Math.min(60, this.intensity * 5);
      this.musicTimer = 60 / bpm / 2;
      const scale = [0, 3, 5, 7, 10];
      const root = 55; // A1
      const note = root * Math.pow(2, (scale[this.musicStep % scale.length]) / 12);
      this.tone({ freq: note, type: 'triangle', dur: 0.24, vol: 0.5, dest: this.musicGain });
      if (this.musicStep % 4 === 0)
        this.tone({ freq: note * 4, type: 'sine', dur: 0.3, vol: 0.25, dest: this.musicGain });
      if (this.intensity > 3 && this.musicStep % 2 === 0)
        this.noise({ dur: 0.05, vol: 0.08 * 0.4, filter: 4000 });
      this.musicStep++;
    }
  },
};
