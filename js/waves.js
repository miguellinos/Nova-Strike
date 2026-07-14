// ---------- waves.js : wave manager ----------
class WaveManager {
  constructor(game) {
    this.game = game;
    this.wave = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.active = false;
    this.isBossWave = false;
  }

  startWave(n) {
    this.wave = n;
    this.game.hpMult = 1 + (n - 1) * 0.12;
    this.game.dmgMult = 1 + (n - 1) * 0.06;
    Audio2.setIntensity(n);
    this.isBossWave = (n % 5 === 0);
    this.spawnQueue = [];
    this.active = true;

    // weapon unlocks
    const unlockMap = { 2: 'rifle', 3: 'shotgun', 4: 'sniper', 5: 'cannon' };
    if (unlockMap[n]) {
      for (const p of this.game.players) p.unlock(unlockMap[n]);
      this.game.ui.showBanner('NEUE WAFFE: ' + WEAPON_DEFS[unlockMap[n]].name + '  (Taste ' + (WEAPON_ORDER.indexOf(unlockMap[n]) + 1) + ')');
    } else {
      this.game.ui.showBanner('WELLE ' + n);
    }

    if (this.isBossWave) {
      const sp = this.game.world.randomSpawnPoint();
      const boss = new Boss(sp.x, sp.y, n);
      this.game.boss = boss;
      Audio2.bossSpawn();
      this.game.ui.showBanner('⚠ BOSS ⚠');
      // some adds too
      for (let i = 0; i < 4 + n; i++) this.spawnQueue.push('drone');
      for (let i = 0; i < 2 + Math.floor(n / 5); i++) this.spawnQueue.push('striker');
    } else {
      this.buildQueue(n);
    }
    this.spawnTimer = 0.5;
  }

  buildQueue(n) {
    const q = this.spawnQueue;
    const add = (type, count) => { for (let i = 0; i < count; i++) q.push(type); };
    add('drone', 4 + Math.floor(n * 1.6));
    if (n >= 2) add('striker', 2 + Math.floor(n * 0.9));
    if (n >= 3) add('shooter', 1 + Math.floor(n * 0.5));
    if (n >= 4) add('tank', Math.floor(n / 4));
    if (n >= 6 && n % 2 === 0) add('novabeast', Math.floor(n / 6));
    // shuffle
    for (let i = q.length - 1; i > 0; i--) {
      const j = Utils.randInt(0, i);
      [q[i], q[j]] = [q[j], q[i]];
    }
  }

  update(dt) {
    if (!this.active) return;
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        // spawn 1-2 at a time
        const batch = Math.min(this.spawnQueue.length, this.isBossWave ? 1 : Utils.randInt(1, 2));
        for (let i = 0; i < batch; i++) {
          const type = this.spawnQueue.shift();
          const sp = this.game.world.randomSpawnPoint();
          this.game.enemies.push(new Enemy(type, sp.x, sp.y, this.game.hpMult, this.game.dmgMult));
        }
        this.spawnTimer = Utils.rand(0.4, 0.9);
      }
    }
  }

  isCleared() {
    if (!this.active) return false;
    if (this.spawnQueue.length > 0) return false;
    if (this.game.enemies.length > 0) return false;
    if (this.isBossWave && this.game.boss && !this.game.boss.dead) return false;
    return true;
  }

  totalRemaining() {
    return this.spawnQueue.length + this.game.enemies.length + (this.game.boss && !this.game.boss.dead ? 1 : 0);
  }
}
