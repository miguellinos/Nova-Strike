// ---------- ui.js : HUD + overlay rendering ----------
class UI {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      hpBar: document.getElementById('hp-bar'),
      hpText: document.getElementById('hp-text'),
      coins: document.getElementById('coins-val'),
      score: document.getElementById('score-val'),
      kills: document.getElementById('kills-val'),
      wave: document.getElementById('wave-label'),
      enemiesLeft: document.getElementById('enemies-left'),
      weaponName: document.getElementById('weapon-name'),
      ammo: document.getElementById('ammo-text'),
      reloadBar: document.getElementById('reload-bar'),
      dashBar: document.getElementById('dash-bar'),
      bossWrap: document.getElementById('boss-bar-wrap'),
      bossName: document.getElementById('boss-name'),
      bossBar: document.getElementById('boss-bar'),
      banner: document.getElementById('wave-banner'),
      shopCoins: document.getElementById('shop-coins'),
      shopCards: document.getElementById('shop-cards'),
      shopCloseBtn: document.getElementById('shop-close-btn'),
      shopWaitMsg: document.getElementById('shop-wait-msg'),
      gameoverStats: document.getElementById('gameover-stats'),
      
      // new active items and shield elements
      shieldBar: document.getElementById('shield-bar'),
      shieldText: document.getElementById('shield-text'),
      invMedkitCount: document.getElementById('inv-medkit-val'),
      invShieldCount: document.getElementById('inv-shield-val'),
      upgradeCards: document.getElementById('upgrade-cards'),
    };
    this.bannerTimer = 0;
  }

  showHUD(v) { this.el.hud.classList.toggle('hidden', !v); }

  updateHUD(game) {
    const p = game.localPlayer;
    this.el.hpBar.style.width = Utils.clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
    this.el.hpText.textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;
    
    // Shield updates
    if (this.el.shieldBar) {
      this.el.shieldBar.style.width = Utils.clamp((p.shieldHp / p.maxShieldHp) * 100, 0, 100) + '%';
    }
    if (this.el.shieldText) {
      this.el.shieldText.textContent = 'Schild: ' + Math.ceil(p.shieldHp) + '%';
    }
    
    // Active inventory updates
    if (this.el.invMedkitCount) {
      this.el.invMedkitCount.textContent = p.medkitsCount;
    }
    if (this.el.invShieldCount) {
      this.el.invShieldCount.textContent = p.shieldsCount;
    }

    this.el.coins.textContent = p.coins;
    this.el.score.textContent = p.score;
    this.el.kills.textContent = p.kills;
    this.el.wave.textContent = 'WELLE ' + game.waves.wave;
    this.el.enemiesLeft.textContent = 'Gegner: ' + (game.mode === 'guest' ? (game._enemiesLeft || 0) : game.waves.totalRemaining());
    this.el.weaponName.textContent = p.weaponDef().name;
    this.el.ammo.textContent = (p.reloading ? '...' : p.weapons[p.currentWeapon].ammo) + ' / ' + p.magSize();
    this.el.reloadBar.style.width = p.reloading ? ((1 - p.reloadTimer / p.reloadTotal) * 100) + '%' : '0%';
    this.el.dashBar.style.width = Utils.clamp((1 - p.dashCd / p.dashCooldown()) * 100, 0, 100) + '%';

    if (game.boss && !game.boss.dead) {
      this.el.bossWrap.classList.remove('hidden');
      this.el.bossName.textContent = game.boss.name + (game.boss.phase2 ? '  [RASEND]' : '');
      this.el.bossBar.style.width = Utils.clamp((game.boss.hp / game.boss.maxHp) * 100, 0, 100) + '%';
    } else {
      this.el.bossWrap.classList.add('hidden');
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= game.dt;
      this.el.banner.style.opacity = Utils.clamp(this.bannerTimer, 0, 1);
      if (this.bannerTimer <= 0) this.el.banner.classList.add('hidden');
    }
  }

  showBanner(text) {
    this.el.banner.textContent = text;
    this.el.banner.classList.remove('hidden');
    this.el.banner.style.opacity = 1;
    this.bannerTimer = 2.2;
  }

<<<<<<< HEAD
  showUpgradeChoices(game) {
    this.el.upgradeCards.innerHTML = '';
=======
  showShop(game, onBuy) {
    const me = game.localPlayer;
    this.el.shopCoins.textContent = me.coins;
    this.el.shopCards.innerHTML = '';
    this.el.shopCloseBtn.classList.toggle('hidden', game.mode === 'guest');
    this.el.shopWaitMsg.classList.toggle('hidden', game.mode !== 'guest');
    if (game.mode === 'guest') return; // guest has no shop of its own; host advances the wave for the squad
>>>>>>> 02a618b9950c54887369d212480d7a9e98e53b0a
    const picks = game.shopUpgrades;
    picks.forEach((up) => {
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML =
        '<div class="icon">' + up.icon + '</div>' +
        '<div class="name">' + up.name + '</div>' +
        '<div class="desc">' + up.desc + '</div>' +
        '<button class="buy">AUSWÄHLEN (Gratis)</button>';
      const btn = card.querySelector('.buy');
<<<<<<< HEAD
      btn.addEventListener('click', () => {
        up.apply(game.player);
        Audio2.buy();
        Menus.hideAll();
        game.openTacticalShop();
      });
      this.el.upgradeCards.appendChild(card);
    });
  }

  showTacticalShop(game) {
    this.el.shopCoins.textContent = game.player.coins;
    this.el.shopCards.innerHTML = '';
    const p = game.player;

    // 1. Weapon Purchase Items
    const weaponItems = [
      { key: 'rifle', price: 120, name: 'M4A1 Sturmgewehr', icon: '🔫', desc: 'Mittelstrecken-Automatikgewehr.' },
      { key: 'shotgun', price: 180, name: 'Remington 870 Schrotflinte', icon: '💥', desc: 'Verursacht massiven Nahbereichschaden.' },
      { key: 'sniper', price: 250, name: 'Barrett .50 Cal Scharfschütze', icon: '🎯', desc: 'Hoher Einzelschaden, durchdringt Feinde.' },
      { key: 'cannon', price: 400, name: 'RPG-7 Raketenwerfer', icon: '🚀', desc: 'Verschießt explosive Raketen mit Flächenschaden.' }
    ];

    weaponItems.forEach((w) => {
      const isUnlocked = p.weapons[w.key] && p.weapons[w.key].unlocked;
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML =
        '<div class="icon">' + w.icon + '</div>' +
        '<div class="name">' + w.name + '</div>' +
        '<div class="desc">' + w.desc + '</div>' +
        '<button class="buy">' + (isUnlocked ? 'AUSGERÜSTET' : '🪙 ' + w.price) + '</button>';
      const btn = card.querySelector('.buy');
      btn.disabled = isUnlocked || p.coins < w.price;
      btn.addEventListener('click', () => {
        if (p.coins < w.price) return;
        p.coins -= w.price;
        p.unlock(w.key);
        Audio2.buy();
        this.showTacticalShop(game); // refresh
=======
      const refresh = () => {
        const bought = card.classList.contains('bought');
        btn.disabled = me.coins < up.price || (bought && !up.repeatable);
        this.el.shopCoins.textContent = me.coins;
      };
      btn.addEventListener('click', () => {
        if (me.coins < up.price) return;
        me.coins -= up.price;
        up.apply(me);
        Audio2.buy();
        card.classList.remove('bought'); void card.offsetWidth; card.classList.add('bought');
        // refresh all cards affordability
        this.el.shopCards.querySelectorAll('.shop-card').forEach((c) => {
          const b = c.querySelector('.buy');
          const price = parseInt(b.textContent.replace(/\D/g, ''), 10);
          b.disabled = me.coins < price;
        });
        this.el.shopCoins.textContent = me.coins;
>>>>>>> 02a618b9950c54887369d212480d7a9e98e53b0a
      });
      this.el.shopCards.appendChild(card);
    });

    // 2. Ammo refill
    const ammoPrice = 30;
    const ammoCard = document.createElement('div');
    ammoCard.className = 'shop-card';
    ammoCard.innerHTML =
      '<div class="icon">📦</div>' +
      '<div class="name">Munitionskiste</div>' +
      '<div class="desc">Füllt die Munition aller freigeschalteten Waffen auf.</div>' +
      '<button class="buy">🪙 ' + ammoPrice + '</button>';
    const ammoBtn = ammoCard.querySelector('.buy');
    ammoBtn.disabled = p.coins < ammoPrice;
    ammoBtn.addEventListener('click', () => {
      if (p.coins < ammoPrice) return;
      p.coins -= ammoPrice;
      for (const k in p.weapons) {
        if (p.weapons[k].unlocked) {
          p.weapons[k].ammo = Math.round(WEAPON_DEFS[k].mag * p.mods.mag);
        }
      }
      Audio2.buy();
      this.showTacticalShop(game); // refresh
    });
    this.el.shopCards.appendChild(ammoCard);

    // 3. Medkit purchase
    const medkitPrice = 40;
    const medkitCard = document.createElement('div');
    medkitCard.className = 'shop-card';
    medkitCard.innerHTML =
      '<div class="icon">🎒</div>' +
      '<div class="name">Tragbares Medkit</div>' +
      '<div class="desc">Erwirb 1 tragbares Medkit. Heilung per Tastendruck Q.</div>' +
      '<button class="buy">🪙 ' + medkitPrice + '</button>';
    const medkitBtn = medkitCard.querySelector('.buy');
    medkitBtn.disabled = p.coins < medkitPrice;
    medkitBtn.addEventListener('click', () => {
      if (p.coins < medkitPrice) return;
      p.coins -= medkitPrice;
      p.medkitsCount++;
      Audio2.buy();
      this.showTacticalShop(game); // refresh
    });
    this.el.shopCards.appendChild(medkitCard);

    // 4. Shield purchase
    const shieldPrice = 50;
    const shieldCard = document.createElement('div');
    shieldCard.className = 'shop-card';
    shieldCard.innerHTML =
      '<div class="icon">🛡️</div>' +
      '<div class="name">Schildzelle</div>' +
      '<div class="desc">Erwirb 1 aktive Schildzelle. Aufladen per Tastendruck E.</div>' +
      '<button class="buy">🪙 ' + shieldPrice + '</button>';
    const shieldBtn = shieldCard.querySelector('.buy');
    shieldBtn.disabled = p.coins < shieldPrice;
    shieldBtn.addEventListener('click', () => {
      if (p.coins < shieldPrice) return;
      p.coins -= shieldPrice;
      p.shieldsCount++;
      Audio2.buy();
      this.showTacticalShop(game); // refresh
    });
    this.el.shopCards.appendChild(shieldCard);
  }

  showGameOver(stats) {
    this.el.gameoverStats.innerHTML =
      '<div>Erreichte Welle: <b>' + stats.wave + '</b></div>' +
      '<div>Besiegte Gegner: <b>' + stats.kills + '</b></div>' +
      '<div>Punktestand: <b>' + stats.score + '</b></div>' +
      '<div>Gesammelte Münzen: <b>' + stats.coins + '</b></div>' +
      '<div>Spielzeit: <b>' + stats.time + '</b></div>';
  }
}
