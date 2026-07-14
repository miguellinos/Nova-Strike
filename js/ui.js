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
      upgradeWaitMsg: document.getElementById('upgrade-wait-msg'),
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

  showUpgradeChoices(game) {
    this.el.upgradeCards.innerHTML = '';
    if (this.el.upgradeWaitMsg) this.el.upgradeWaitMsg.classList.add('hidden');
    const picks = game.shopUpgrades || [];
    picks.forEach((up) => {
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML =
        '<div class="icon">' + up.icon + '</div>' +
        '<div class="name">' + up.name + '</div>' +
        '<div class="desc">' + up.desc + '</div>' +
        '<button class="buy">AUSWÄHLEN (Gratis)</button>';
      const btn = card.querySelector('.buy');
      btn.addEventListener('click', () => { game.chooseUpgrade(up); });
      this.el.upgradeCards.appendChild(card);
    });
  }

  // waiting-for-partner overlay after finishing the co-op shop
  showShopWaiting() {
    this.el.shopCoins.textContent = '';
    this.el.shopCards.innerHTML = '<div style="grid-column: 1/-1; padding: 30px; color: var(--gold); font-size: 18px;">✅ Du bist bereit.<br><br>Warte auf deinen Mitspieler...</div>';
    const closeBtn = document.querySelector('[data-action="shop-close"]');
    if (closeBtn) closeBtn.classList.add('hidden');
  }

  showTacticalShop(game) {
    const me = game.localPlayer || game.player;
    this.el.shopCoins.textContent = me.coins;
    this.el.shopCards.innerHTML = '';

    // everyone can shop for themselves now — always show the close/next button
    const closeBtn = document.querySelector('[data-action="shop-close"]');
    if (closeBtn) {
      closeBtn.classList.remove('hidden');
      closeBtn.textContent = (game.mode !== 'solo' && !game.midWaveShop) ? 'Fertig / Bereit ▶' : (game.midWaveShop ? 'Weiter ▶' : 'Nächste Welle ▶');
    }
    const waitMsg = document.getElementById('shop-wait-msg');
    if (waitMsg) waitMsg.classList.add('hidden');

    // 1. Weapon Purchase Items
    const weaponItems = [
      { key: 'rifle', price: 120, name: 'M4A1 Sturmgewehr', icon: '🔫', desc: 'Mittelstrecken-Automatikgewehr.' },
      { key: 'shotgun', price: 180, name: 'Remington 870 Schrotflinte', icon: '💥', desc: 'Verursacht massiven Nahbereichschaden.' },
      { key: 'sniper', price: 250, name: 'Barrett .50 Cal Scharfschütze', icon: '🎯', desc: 'Hoher Einzelschaden, durchdringt Feinde.' },
      { key: 'cannon', price: 400, name: 'RPG-7 Raketenwerfer', icon: '🚀', desc: 'Verschießt explosive Raketen mit Flächenschaden.' },
      { key: 'smg', price: 200, name: 'MP7 Maschinenpistole', icon: '💨', desc: 'Extrem hohe Feuerrate, ideal gegen Schwärme.' },
      { key: 'flamethrower', price: 320, name: 'M9 Flammenwerfer', icon: '🔥', desc: 'Kurze Reichweite, setzt Gegner in Brand (Schaden über Zeit).' },
      { key: 'tesla', price: 360, name: 'Tesla-Blitzgewehr', icon: '⚡', desc: 'Blitze springen auf nahe Gegner über.' },
      { key: 'cryo', price: 300, name: 'CR-6 Frostwerfer', icon: '❄️', desc: 'Verlangsamt getroffene Gegner deutlich.' }
    ];

    weaponItems.forEach((w) => {
      const isUnlocked = me.weapons[w.key] && me.weapons[w.key].unlocked;
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML =
        '<div class="icon">' + w.icon + '</div>' +
        '<div class="name">' + w.name + '</div>' +
        '<div class="desc">' + w.desc + '</div>' +
        '<button class="buy">' + (isUnlocked ? 'AUSGERÜSTET' : '🪙 ' + w.price) + '</button>';
      const btn = card.querySelector('.buy');
      btn.disabled = isUnlocked || me.coins < w.price;
      btn.addEventListener('click', () => {
        if (game.purchase('weapon', w.key, w.price)) this.showTacticalShop(game); // refresh
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
    ammoBtn.disabled = me.coins < ammoPrice;
    ammoBtn.addEventListener('click', () => {
      if (game.purchase('ammo', null, ammoPrice)) this.showTacticalShop(game); // refresh
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
    medkitBtn.disabled = me.coins < medkitPrice;
    medkitBtn.addEventListener('click', () => {
      if (game.purchase('medkit', null, medkitPrice)) this.showTacticalShop(game); // refresh
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
    shieldBtn.disabled = me.coins < shieldPrice;
    shieldBtn.addEventListener('click', () => {
      if (game.purchase('shield', null, shieldPrice)) this.showTacticalShop(game); // refresh
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
