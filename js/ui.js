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
    if (this.el.upgradeWaitMsg) this.el.upgradeWaitMsg.classList.toggle('hidden', game.mode !== 'guest');
    if (game.mode === 'guest') return; // only the host drives the squad's wave progression
    const me = game.localPlayer || game.player;
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
      btn.addEventListener('click', () => {
        up.apply(me);
        Audio2.buy();
        Menus.hideAll();
        game.openTacticalShop();
      });
      this.el.upgradeCards.appendChild(card);
    });
  }

  showTacticalShop(game) {
    const me = game.localPlayer || game.player;
    this.el.shopCoins.textContent = me.coins;
    this.el.shopCards.innerHTML = '';

    // Handle co-op close buttons
    const closeBtn = document.querySelector('[data-action="shop-close"]');
    if (closeBtn) {
      closeBtn.classList.toggle('hidden', game.mode === 'guest');
    }
    // check if wait message exists
    const waitMsg = document.getElementById('shop-wait-msg');
    if (waitMsg) {
      waitMsg.classList.toggle('hidden', game.mode !== 'guest');
    }

    // 1. Weapon Purchase Items
    const weaponItems = [
      { key: 'rifle', price: 120, name: 'M4A1 Sturmgewehr', icon: '🔫', desc: 'Mittelstrecken-Automatikgewehr.' },
      { key: 'shotgun', price: 180, name: 'Remington 870 Schrotflinte', icon: '💥', desc: 'Verursacht massiven Nahbereichschaden.' },
      { key: 'sniper', price: 250, name: 'Barrett .50 Cal Scharfschütze', icon: '🎯', desc: 'Hoher Einzelschaden, durchdringt Feinde.' },
      { key: 'cannon', price: 400, name: 'RPG-7 Raketenwerfer', icon: '🚀', desc: 'Verschießt explosive Raketen mit Flächenschaden.' }
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
        if (me.coins < w.price) return;
        me.coins -= w.price;
        me.unlock(w.key);
        Audio2.buy();
        this.showTacticalShop(game); // refresh
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
      if (me.coins < ammoPrice) return;
      me.coins -= ammoPrice;
      for (const k in me.weapons) {
        if (me.weapons[k].unlocked) {
          me.weapons[k].ammo = Math.round(WEAPON_DEFS[k].mag * me.mods.mag);
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
    medkitBtn.disabled = me.coins < medkitPrice;
    medkitBtn.addEventListener('click', () => {
      if (me.coins < medkitPrice) return;
      me.coins -= medkitPrice;
      me.medkitsCount++;
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
    shieldBtn.disabled = me.coins < shieldPrice;
    shieldBtn.addEventListener('click', () => {
      if (me.coins < shieldPrice) return;
      me.coins -= shieldPrice;
      me.shieldsCount++;
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
