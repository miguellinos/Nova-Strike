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
      invGrenadeCount: document.getElementById('inv-grenade-val'),
      upgradeCards: document.getElementById('upgrade-cards'),
      upgradeWaitMsg: document.getElementById('upgrade-wait-msg'),
      upgradeScore: document.getElementById('upgrade-score'),
      interactPrompt: document.getElementById('interact-prompt'),
      spectateBanner: document.getElementById('spectate-banner'),
      extractBanner: document.getElementById('extract-banner'),
      extractBannerText: document.getElementById('extract-banner-text'),
      extractProgressBar: document.getElementById('extract-progress-bar'),
      workbenchCoins: document.getElementById('workbench-coins'),
      workbenchCards: document.getElementById('workbench-cards'),
      toast: document.getElementById('toast'),
    };
    this.bannerTimer = 0;
    this._toastTimer = null;
  }

  // Non-blocking replacement for alert(): a short message that fades away on
  // its own. Driven by setTimeout (not the game loop) so it also works while a
  // menu is open and the loop isn't updating the HUD.
  toast(text, ms = 2600) {
    const el = this.el.toast;
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.classList.add('hidden'); this._toastTimer = null; }, ms);
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
    if (this.el.invGrenadeCount) {
      this.el.invGrenadeCount.textContent = p.grenadeCount || 0;
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

    if (this.el.spectateBanner) {
      this.el.spectateBanner.classList.toggle('hidden', !(p.hp <= 0 && game.players.length > 1));
    }

    if (this.el.extractBanner && game.extractionPoint) {
      const ready = game.waves.wave >= game.extractAvailableWave;
      const show = game.state === 'playing' && p.hp > 0;
      this.el.extractBanner.classList.toggle('hidden', !show);
      if (show) {
        if (!ready) {
          this.el.extractBannerText.textContent = '🚁 Extraktion verfügbar ab Welle ' + game.extractAvailableWave;
        } else if (!game.nearExtraction) {
          this.el.extractBannerText.textContent = '🚁 Extraktionszone erreichen';
        } else if (game.players.length > 1 && game.extractProgress < game.extractChannelTime) {
          this.el.extractBannerText.textContent = '🚁 In der Zone bleiben — alle Spieler müssen dabei sein';
        } else {
          this.el.extractBannerText.textContent = '🚁 Extraktion läuft...';
        }
        const pct = game.extractChannelTime ? Utils.clamp((game.extractProgress / game.extractChannelTime) * 100, 0, 100) : 0;
        this.el.extractProgressBar.style.width = pct + '%';
      }
    }

    if (this.el.interactPrompt) {
      const showPrompt = game.state === 'playing' && p.hp > 0 && !game.workbenchOpenLocal && !game.shopOpenLocal && !game.trainingOpenLocal && !game.atmOpenLocal;
      if (showPrompt && game.nearWorkbench) {
        this.el.interactPrompt.innerHTML = 'Drücke <b>F</b> für die Werkbank';
        this.el.interactPrompt.classList.remove('hidden');
      } else if (showPrompt && game.nearShop) {
        this.el.interactPrompt.innerHTML = 'Drücke <b>F</b> für den Shop';
        this.el.interactPrompt.classList.remove('hidden');
      } else if (showPrompt && game.nearTrainingRange) {
        this.el.interactPrompt.innerHTML = 'Drücke <b>F</b> für Trainingsrange';
        this.el.interactPrompt.classList.remove('hidden');
      } else if (showPrompt && game.nearAtm) {
        this.el.interactPrompt.innerHTML = 'Drücke <b>F</b> für den Geldautomaten';
        this.el.interactPrompt.classList.remove('hidden');
      } else {
        this.el.interactPrompt.classList.add('hidden');
      }
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
    
    const me = game.localPlayer || game.player;
    if (this.el.upgradeScore) this.el.upgradeScore.textContent = me.score;

    const picks = game.shopUpgrades || [];
    picks.forEach((up) => {
      const cost = up.price * 10;
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML =
        '<div class="icon">' + up.icon + '</div>' +
        '<div class="name">' + up.name + '</div>' +
        '<div class="desc">' + up.desc + '</div>' +
        '<button class="buy">🏆 ' + cost + '</button>';
      const btn = card.querySelector('.buy');
      btn.disabled = me.score < cost;
      btn.addEventListener('click', () => { 
        if (game.buyUpgradeAtTrainingRange(up, cost)) {
          this.showUpgradeChoices(game); // refresh / reroll
        }
      });
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

    // Waffen gibt es nur noch an der Werkbank (Taste F in der Nähe) — hier nur
    // Verbrauchsgüter: Munition, Medkits, Schilde.

    // 2. Ammo refill
    const ammoPrice = 27;
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
    const medkitPrice = 36;
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
    const shieldPrice = 45;
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

    // 5. Brot (Bread) purchase
    const breadPrice = 9;
    const breadCard = document.createElement('div');
    breadCard.className = 'shop-card';
    breadCard.innerHTML =
      '<div class="icon">🍞</div>' +
      '<div class="name">Frisches Brot</div>' +
      '<div class="desc">Heilt dich sofort um 15 HP. Extrem billig!</div>' +
      '<button class="buy">🪙 ' + breadPrice + '</button>';
    const breadBtn = breadCard.querySelector('.buy');
    breadBtn.disabled = me.coins < breadPrice || me.hp >= me.maxHp;
    breadBtn.addEventListener('click', () => {
      if (game.purchase('bread', null, breadPrice)) this.showTacticalShop(game); // refresh
    });
    this.el.shopCards.appendChild(breadCard);

    // 6. Novacola purchase
    const novacolaPrice = 22;
    const novacolaCard = document.createElement('div');
    novacolaCard.className = 'shop-card';
    novacolaCard.innerHTML =
      '<div class="icon">🥤</div>' +
      '<div class="name">Novacola</div>' +
      '<div class="desc">Gibt dir einen heftigen Speedboost für 8 Sek.</div>' +
      '<button class="buy">🪙 ' + novacolaPrice + '</button>';
    const novacolaBtn = novacolaCard.querySelector('.buy');
    novacolaBtn.disabled = me.coins < novacolaPrice;
    novacolaBtn.addEventListener('click', () => {
      if (game.purchase('novacola', null, novacolaPrice)) this.showTacticalShop(game); // refresh
    });
    this.el.shopCards.appendChild(novacolaCard);

    // 7. Handgranate purchase
    const grenadePrice = 40;
    const grenadeCard = document.createElement('div');
    grenadeCard.className = 'shop-card';
    grenadeCard.innerHTML =
      '<div class="icon">💣</div>' +
      '<div class="name">Handgranate</div>' +
      '<div class="desc">Wirf sie mit Taste G. Flächenschaden am Zielpunkt.</div>' +
      '<button class="buy">🪙 ' + grenadePrice + '</button>';
    const grenadeBtn = grenadeCard.querySelector('.buy');
    grenadeBtn.disabled = me.coins < grenadePrice;
    grenadeBtn.addEventListener('click', () => {
      if (game.purchase('grenade', null, grenadePrice)) this.showTacticalShop(game); // refresh
    });
    this.el.shopCards.appendChild(grenadeCard);
  }

  // ----- workbench: buy new weapons + upgrade owned weapons (per player, "press E") -----
  showWorkbench(game) {
    const me = game.localPlayer || game.player;
    if (this.el.workbenchCoins) this.el.workbenchCoins.textContent = me.coins;
    if (!this.el.workbenchCards) return;
    this.el.workbenchCards.innerHTML = '';

    WEAPON_SHOP_ITEMS.forEach((w) => {
      const owned = me.weapons[w.key] && me.weapons[w.key].unlocked;
      const def = WEAPON_DEFS[w.key];
      const card = document.createElement('div');
      card.className = 'shop-card';
      
      const stats = getStatsAtLevel(def, 0);
      const statsHtml = `
        <div class="weapon-stats">
          <span>💥 ${stats.damage}</span>
          <span>⏱️ ${stats.fireRate}/s</span>
          <span>🔄 ${stats.reload}s</span>
          <span>🔋 ${stats.mag}</span>
        </div>
      `;

      card.innerHTML =
        '<div class="icon">' + getWeaponIconSvg(w.key) + '</div>' +
        '<div class="name">' + def.name + '</div>' +
        '<div class="desc">' + w.desc + '</div>' +
        statsHtml +
        '<button class="buy">' + (owned ? 'AUSGERÜSTET' : '🪙 ' + w.price) + '</button>';
      const btn = card.querySelector('.buy');
      btn.disabled = owned || me.coins < w.price;
      btn.addEventListener('click', () => {
        if (game.buyWeaponAtWorkbench(w.key, w.price)) this.showWorkbench(game); // refresh
      });
      this.el.workbenchCards.appendChild(card);
    });

    // per-weapon upgrade cards — only for weapons the player already owns
    WEAPON_ORDER.forEach((key) => {
      if (!me.weapons[key] || !me.weapons[key].unlocked) return;
      const def = WEAPON_DEFS[key];
      const lvl = me.weaponLevels[key] || 0;
      const maxed = lvl >= WEAPON_UPGRADE_MAX;
      const price = WEAPON_UPGRADE_PRICES[lvl] || 0;
      const card = document.createElement('div');
      card.className = 'shop-card';

      const curr = getStatsAtLevel(def, lvl);
      const next = getStatsAtLevel(def, lvl + 1);
      
      const statsHtml = maxed ? `
        <div class="weapon-stats">
          <span>💥 ${curr.damage}</span>
          <span>⏱️ ${curr.fireRate}/s</span>
          <span>🔄 ${curr.reload}s</span>
          <span>🔋 ${curr.mag}</span>
        </div>
      ` : `
        <div class="weapon-stats">
          <span>💥 ${curr.damage} ➜ <b style="color:#00ffcc;">${next.damage}</b></span>
          <span>⏱️ ${curr.fireRate} ➜ <b style="color:#00ffcc;">${next.fireRate}</b></span>
          <span>🔋 ${curr.mag} ➜ <b style="color:#00ffcc;">${next.mag}</b></span>
        </div>
      `;

      card.innerHTML =
        '<div class="icon">' + getUpgradeIconSvg() + '</div>' +
        '<div class="name">' + def.name + ' Upgrade</div>' +
        '<div class="desc">Level ' + lvl + ' / ' + WEAPON_UPGRADE_MAX + '</div>' +
        statsHtml +
        '<button class="buy">' + (maxed ? 'MAX. LEVEL' : '🪙 ' + price) + '</button>';
      const btn = card.querySelector('.buy');
      btn.disabled = maxed || me.coins < price;
      btn.addEventListener('click', () => {
        if (game.upgradeWeaponAtWorkbench(key, price)) this.showWorkbench(game); // refresh
      });
      this.el.workbenchCards.appendChild(card);
    });
  }

  showInventory(game) {
    const me = game.localPlayer || game.player;

    // 1. Render Unlocked Weapons in top-right box
    const weaponsContainer = document.getElementById('inventory-weapons');
    if (weaponsContainer) {
      weaponsContainer.innerHTML = '';
      let weaponsCount = 0;
      WEAPON_ORDER.forEach((key) => {
        if (me.weapons[key] && me.weapons[key].unlocked) {
          weaponsCount++;
          const def = WEAPON_DEFS[key];
          const row = document.createElement('div');
          row.className = 'weapon-slot-row';
          
          const iconSvg = getWeaponIconSvg(key);
          
          const maxAmmo = Math.round(def.mag * me.mods.mag);
          const currentAmmo = me.weapons[key].ammo;

          row.innerHTML = `
            <span class="weapon-icon" style="display:inline-block; width:54px; text-align:center;">${iconSvg}</span>
            <span class="weapon-name">${def.name}</span>
            <span class="weapon-ammo">${currentAmmo} / ${maxAmmo}</span>
          `;
          weaponsContainer.appendChild(row);
        }
      });
      if (weaponsCount === 0) {
        weaponsContainer.innerHTML = '<div style="color: #666; font-size: 11px; padding: 10px;">Keine Waffen.</div>';
      }
    }

    // 2. Render Minecraft style slots for owned items
    const slotsContainer = document.getElementById('inventory-slots');
    if (slotsContainer) {
      slotsContainer.innerHTML = '';
      
      const items = [
        { id: 'bread', name: 'Frisches Brot', icon: '🍞', count: me.breadCount || 0, desc: 'Heilt dich sofort um 15 HP.', canUse: me.hp < me.maxHp },
        { id: 'novacola', name: 'Novacola', icon: '🥤', count: me.novacolaCount || 0, desc: 'Gibt dir einen Speedboost für 8 Sek.', canUse: true },
        { id: 'medkit', name: 'Tragbares Medkit', icon: '🎒', count: me.medkitsCount || 0, desc: 'Heilt dich sofort um 40 HP.', canUse: me.hp < me.maxHp },
        { id: 'shield', name: 'Schildzelle', icon: '🛡️', count: me.shieldsCount || 0, desc: 'Lädt dein Schild um 50 Punkte auf.', canUse: me.shieldHp < me.maxShieldHp },
        { id: 'grenade', name: 'Handgranate', icon: '💣', count: me.grenadeCount || 0, desc: 'Wirf sie mit Taste G. Flächenschaden am Zielpunkt.', canUse: true },
      ];

      let itemsOwned = 0;
      items.forEach((item) => {
        if (item.count > 0) {
          itemsOwned++;
          const slot = document.createElement('div');
          slot.className = 'mc-slot';
          if (!item.canUse) {
            slot.style.opacity = '0.55';
          }
          slot.innerHTML = `
            <span class="slot-icon">${item.icon}</span>
            <span class="slot-count">${item.count}</span>
            <div class="mc-slot-tooltip">
              <div class="mc-tooltip-title">${item.name}</div>
              <div>${item.desc}</div>
              <div class="mc-tooltip-action">${item.canUse ? 'Klicken zum Benutzen' : 'Voll / Nicht benutzbar'}</div>
            </div>
          `;
          
          if (item.canUse) {
            slot.addEventListener('click', () => {
              game.useInventoryItem(item.id);
            });
          }
          slotsContainer.appendChild(slot);
        }
      });

      if (itemsOwned === 0) {
        slotsContainer.innerHTML = '<div style="color: #888; font-size: 12px; text-align: center; width: 100%; padding: 15px;">Dein Rucksack ist leer. Besuche den Shop oben rechts!</div>';
      }
    }
  }

  drawInventoryPreview(game) {
    const me = game.localPlayer || game.player;
    const canvas = document.getElementById('inventory-player-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear preview canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fill portrait background
    ctx.fillStyle = '#111116';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#3c3c3c';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Save current player state to temporarily animate on the preview screen
    const oldX = me.x;
    const oldY = me.y;
    const oldAim = me.aimAngle;
    const oldWalk = me.walkPhase;
    const oldTrail = me.dashTrail;

    // Center player character inside the 120x150 portrait canvas
    me.x = canvas.width / 2;
    me.y = canvas.height / 2 + 10;
    me.aimAngle = Math.PI * 0.5; // face downwards/forwards
    me.walkPhase = game.time * 6.5; // animate walk phase
    me.dashTrail = []; // clear trails in preview

    ctx.save();
    me.draw(ctx, game.time);
    ctx.restore();

    // Restore original coordinates
    me.x = oldX;
    me.y = oldY;
    me.aimAngle = oldAim;
    me.walkPhase = oldWalk;
    me.dashTrail = oldTrail;
  }

  showGameOver(stats) {
    this.el.gameoverStats.innerHTML =
      '<div>Erreichte Welle: <b>' + stats.wave + '</b></div>' +
      '<div>Besiegte Gegner: <b>' + stats.kills + '</b></div>' +
      '<div>Punktestand: <b>' + stats.score + '</b></div>' +
      '<div>Gesammelte Münzen: <b>' + stats.coins + '</b></div>' +
      '<div>Spielzeit: <b>' + stats.time + '</b></div>';
  }

  showExtractSuccess(stats) {
    const el = document.getElementById('extract-stats');
    if (!el) return;
    el.innerHTML =
      '<div>Extrahiert in Welle: <b>' + stats.wave + '</b></div>' +
      '<div>Besiegte Gegner: <b>' + stats.kills + '</b></div>' +
      '<div>Punktestand: <b>' + stats.score + '</b></div>' +
      '<div>Gesammelte Münzen: <b>' + stats.coins + '</b></div>' +
      '<div>Spielzeit: <b>' + stats.time + '</b></div>';
  }

  showLexiconTab(tabId, game) {
    if (!this.el.lexiconContent) {
      this.el.lexiconContent = document.getElementById('lexicon-menu').querySelector('.lexicon-content');
    }
    const container = this.el.lexiconContent;
    if (!container) return;

    container.innerHTML = '';

    if (tabId === 'lexicon-weapons') {
      const grid = document.createElement('div');
      grid.className = 'lexicon-grid';

      for (const key of WEAPON_ORDER) {
        const def = WEAPON_DEFS[key];
        const shopItem = WEAPON_SHOP_ITEMS.find(item => item.key === key) || {};
        const iconSvg = getWeaponIconSvg(key);

        const card = document.createElement('div');
        card.className = 'lexicon-card';
        
        let perkHtml = '';
        if (def.burn) perkHtml = `<div class="lexicon-stat-item">🔥 Verbrennen: <b>${def.burn} DPS</b></div>`;
        else if (def.chain) perkHtml = `<div class="lexicon-stat-item">⚡ Blitzsprung: <b>${def.chain} Feinde</b></div>`;
        else if (def.slow) perkHtml = `<div class="lexicon-stat-item">❄️ Verlangsamen: <b>${def.slow}s</b></div>`;
        else if (def.pierce) perkHtml = `<div class="lexicon-stat-item">🎯 Durchdringen: <b>${def.pierce} Feinde</b></div>`;
        else if (def.aoe) perkHtml = `<div class="lexicon-stat-item">🚀 Explosion: <b>${def.aoe} AOE</b></div>`;

        card.innerHTML = `
          <div class="lexicon-card-header">
            <span class="lexicon-card-emoji">${iconSvg}</span>
            <span class="lexicon-card-title">${def.name}</span>
          </div>
          <div class="lexicon-card-desc">${shopItem.desc || 'Standardwaffe für Spezialeinsätze.'}</div>
          <div class="lexicon-stats">
            <div class="lexicon-stat-item">💥 Schaden: <b>${def.damage}</b></div>
            <div class="lexicon-stat-item">🔥 Feuerrate: <b>${def.fireRate}/s</b></div>
            <div class="lexicon-stat-item">🎒 Magazin: <b>${def.mag} Schuss</b></div>
            <div class="lexicon-stat-item">🔄 Nachladen: <b>${def.reload}s</b></div>
            <div class="lexicon-stat-item">🚀 Geschw.: <b>${def.speed} px/s</b></div>
            <div class="lexicon-stat-item">🪙 Preis: <b>${shopItem.price ? '$' + shopItem.price : 'Gratis'}</b></div>
            ${perkHtml}
          </div>
        `;
        grid.appendChild(card);
      }
      container.appendChild(grid);
    } 
    else if (tabId === 'lexicon-medkits') {
      const items = [
        { name: '🎒 Medkit', desc: 'Konsumierbares Erste-Hilfe-Set. Heilt augenblicklich 50 Gesundheitspunkte.', key: 'Q', limit: 'Max. 3 im Inventar', price: '🪙 25 Münzen im Shop' },
        { name: '🛡️ Schild-Batterie', desc: 'Konsumierbare Energiezelle. Lädt deinen Energieschild vollständig auf (100 Punkte).', key: 'E', limit: 'Max. 3 im Inventar', price: '🪙 35 Münzen im Shop' },
        { name: '🪙 Münzen', desc: 'Währung, die von besiegten Gegnern fallengelassen wird. Wird an der Werkbank und am Shop-Tisch im Hauptquartier ausgegeben.', key: 'Sammeln', limit: 'Unbegrenzt', price: 'Gratis von Feinden' },
        { name: '🏆 Punkte (Score)', desc: 'Erreichte Punktzahl durch Abschüsse und Überleben von Wellen. Kann im Trainingsbereich für globale Charakter-Upgrades ausgegeben werden.', key: 'Sammeln', limit: 'Permanent', price: 'Wellen-Boni' },
      ];

      const grid = document.createElement('div');
      grid.className = 'lexicon-grid';

      for (const item of items) {
        const card = document.createElement('div');
        card.className = 'lexicon-card';
        card.innerHTML = `
          <div class="lexicon-card-header">
            <span class="lexicon-card-title">${item.name}</span>
          </div>
          <div class="lexicon-card-desc">${item.desc}</div>
          <div class="lexicon-stats">
            <div class="lexicon-stat-item">Taste: <b>${item.key}</b></div>
            <div class="lexicon-stat-item">Limit: <b>${item.limit}</b></div>
            <div class="lexicon-stat-item">Kosten: <b>${item.price}</b></div>
          </div>
        `;
        grid.appendChild(card);
      }
      container.appendChild(grid);
    }
    else if (tabId === 'lexicon-enemies') {
      const grid = document.createElement('div');
      grid.className = 'lexicon-grid';

      const enemiesList = [
        { type: 'drone', emoji: '👾', details: 'Einfacher Infanterist. Versucht dich im Nahkampf anzureisen.' },
        { type: 'striker', emoji: '💀', details: 'Schneller, gepanzerter Sturmsoldat. Richtet hohen Nahkampfschaden an.' },
        { type: 'shooter', emoji: '🛞', details: 'Militärischer Scout-Humvee. Feuert schnelle Salven mit einem montierten MG.' },
        { type: 'tank', emoji: '🚜', details: 'Kampfpanzer mit schweren Ketten. Feuert langsame, aber verheerende Doppel-Explosivgeschosse ab.' },
        { type: 'bomber', emoji: '💥', details: 'Sprengstoff-Läufer. Läuft mit extrem hoher Geschwindigkeit auf dich zu und sprengt sich selbst in die Luft.' },
        { type: 'marksman', emoji: '🎯', details: 'Scharfschütze im Ghillie-Tarnanzug. Zielt aus großer Entfernung mit einem gelben Laser und feuert durchdringende Railgun-Projektile ab.' },
        { type: 'rockettank', emoji: '🚀', details: 'Raketenwerfer-Panzer. Feuert wärmesuchende Lenkraketen ab, die dich 5 Sekunden lang verfolgen und dann explodieren.' },
        { type: 'novabeast', emoji: '👹', details: 'Schwerer Panzerträger (APC). Ein massiver Rammbock, der mit hoher Geschwindigkeit direkt auf dich zustürmt.' }
      ];

      for (const e of enemiesList) {
        const def = ENEMY_DEFS[e.type];
        const name = def.name;
        const hp = def.hp;
        const speed = def.speed + ' px/s';
        const dmg = def.dmg;
        let features = def.ranged ? 'Fernkampf' : 'Nahkampf';
        if (e.type === 'bomber') features = 'Selbstmord-Explosion';
        if (e.type === 'rockettank') features = 'Lenkraketen';

        const card = document.createElement('div');
        card.className = 'lexicon-card';
        card.innerHTML = `
          <div class="lexicon-card-header">
            <span class="lexicon-card-emoji">${e.emoji}</span>
            <span class="lexicon-card-title">${name}</span>
          </div>
          <canvas class="lexicon-thumbnail" width="80" height="80" data-key="${e.type}" data-category="enemies" style="background:#090b08; border: 1px solid rgba(74,246,38,0.12); border-radius: 8px; margin: 8px auto; display: block;"></canvas>
          <div class="lexicon-card-desc">${e.details}</div>
          <div class="lexicon-stats">
            <div class="lexicon-stat-item">❤️ HP: <b>${hp}</b></div>
            <div class="lexicon-stat-item">⚡ Tempo: <b>${speed}</b></div>
            <div class="lexicon-stat-item">⚔️ Schaden: <b>${dmg}</b></div>
            <div class="lexicon-stat-item">ℹ️ Typ: <b>${features}</b></div>
          </div>
        `;
        grid.appendChild(card);
      }
      container.appendChild(grid);
    }
    else if (tabId === 'lexicon-bosses') {
      const grid = document.createElement('div');
      grid.className = 'lexicon-grid';

      const bossesList = [
        { type: 'tank', emoji: '👑', name: 'Superpanzer "LEVIATHAN"', hp: '1800+', speed: '60 px/s', dmg: '32', desc: 'Riesiger Kampfpanzer. Feuert explosive Dual-Kanonensalven und entfesselt Schockwellenringe.' },
        { type: 'spider', emoji: '🕷️', name: 'Arachno-Läufer "WIDOW"', hp: '1500+', speed: '140 px/s', dmg: '22', desc: 'Agiler mech-spinnenartiger Läufer. Prescht im Sprint vor und legt Netzbomben-Minen aus.' },
        { type: 'artillery', emoji: '🛡️', name: 'Haubitzen-Plattform "GOLIATH"', hp: '2800+', speed: '40 px/s', dmg: '30', desc: 'Schwere gepanzerte Belagerungsstation. Beschießt dich aus weiter Distanz und lädt Schilde auf.' },
        { type: 'swarm', emoji: '⚡', name: 'Befehlshaber "SCHWARM"', hp: '1700+', speed: '110 px/s', dmg: '18', desc: 'Schwebendes kybernetisches Zentralbewusstsein. Teleportiert sich und spawnt Dronen-Schwärme.' },
        { type: 'operative', emoji: '👤', name: 'Elite-Operator "GHOST"', hp: '900+', speed: '190 px/s', dmg: '16', desc: 'Menschlicher Elitesöldner mit SMG. Wenig HP, extrem schnell, spawnt niemals Verstärkung — wirft aber alle 35s eine Flashbang.' },
      ];

      for (const b of bossesList) {
        const card = document.createElement('div');
        card.className = 'lexicon-card';
        card.innerHTML = `
          <div class="lexicon-card-header">
            <span class="lexicon-card-emoji">${b.emoji}</span>
            <span class="lexicon-card-title">${b.name}</span>
          </div>
          <canvas class="lexicon-thumbnail" width="80" height="80" data-key="${b.type}" data-category="bosses" style="background:#090b08; border: 1px solid rgba(74,246,38,0.12); border-radius: 8px; margin: 8px auto; display: block;"></canvas>
          <div class="lexicon-card-desc">${b.desc}</div>
          <div class="lexicon-stats">
            <div class="lexicon-stat-item">❤️ HP: <b>${b.hp}</b></div>
            <div class="lexicon-stat-item">⚡ Tempo: <b>${b.speed}</b></div>
            <div class="lexicon-stat-item">⚔️ Schaden: <b>${b.dmg}</b></div>
            <div class="lexicon-stat-item">ℹ️ Typ: <b>Hauptboss</b></div>
          </div>
          <button class="btn btn-primary" style="margin-top: 10px; padding: 8px;" data-action="fight-boss" data-boss="${b.type}">⚔️ Bekämpfen</button>
        `;
        grid.appendChild(card);
      }
      container.appendChild(grid);
    }
    else if (tabId === 'lexicon-buildings') {
      const buildings = [
        { key: 'hangar', name: '🏢 Hangare', desc: 'Riesige Industriehallen. Hier spawnen vermehrt Feinde. Der Innenbereich ist dunkel und verbirgt Gegner, bis du sie beleuchtest.', inside: 'Dunkel (Fog of War)' },
        { key: 'baracke', name: '🏠 Baracken / Hütten', desc: 'Kleinere Holzhütten und Wachposten mit engen Türen. Ähnlich wie Hangare verbergen sie ihren Inhalt vor Blicken von außen.', inside: 'Dunkel (Fog of War)' },
        { key: 'basecamp', name: '🛡️ Hauptquartier', desc: 'Blau geflieste Sicherheitszone am linken Kartenrand. Geschützt durch ein blaues Laserschutzgitter, das feindliche Einheiten blockiert.', inside: 'Sicherheitszone' },
        { key: 'workbench', name: '🔧 Werkbank', desc: 'Steht im Hauptquartier. Ermöglicht dir das Freischalten neuer Primärwaffen und das Verbessern der Waffenwerte bis Stufe 3.', inside: 'Waffen-Upgrades' },
        { key: 'shop', name: '🛒 Shop-Tisch', desc: 'Befindet sich im Hauptquartier. Ermöglicht den Kauf von Munitionsboxen, Medkits und Schild-Akkus während der Wellen.', inside: 'Ausrüstungs-Verkauf' },
        { key: 'training', name: '🏋️ Trainingsbereich', desc: 'Hier kannst du am Ende jeder Welle deine globalen Charakterwerte mit erreichten Punkten verbessern.', inside: 'Charakter-Upgrades' },
        { key: 'atm', name: '🏧 Geldautomat', desc: 'Steht im Hauptquartier (nur im Koop-Modus). Ermöglicht es Spielern, sich gegenseitig Münzen zu überweisen.', inside: 'Geld-Transfer' },
      ];

      const grid = document.createElement('div');
      grid.className = 'lexicon-grid';

      for (const b of buildings) {
        const card = document.createElement('div');
        card.className = 'lexicon-card';
        card.innerHTML = `
          <div class="lexicon-card-header">
            <span class="lexicon-card-title">${b.name}</span>
          </div>
          <canvas class="lexicon-thumbnail" width="80" height="80" data-key="${b.key}" data-category="buildings" style="background:#090b08; border: 1px solid rgba(74,246,38,0.12); border-radius: 8px; margin: 8px auto; display: block;"></canvas>
          <div class="lexicon-card-desc">${b.desc}</div>
          <div class="lexicon-stats">
            <div class="lexicon-stat-item" style="grid-column: span 2;">Kategorie: <b>${b.inside}</b></div>
          </div>
        `;
        grid.appendChild(card);
      }
      container.appendChild(grid);
    }
    else if (tabId === 'lexicon-maps') {
      const maps = [
        { key: 'military', name: '🗺️ Hangar-Komplex Alpha', desc: 'Ein riesiger Militärstützpunkt mit zwei gigantischen Hangars (Nord und Süd). Ideal für kontrollierte Indoor-Gefechte.', theme: 'Militärisch (Schlamm & Erde)' },
        { key: 'battlefield', name: 'Sektor 4 - Schlachtfeld', desc: 'Ein offenes Trümmerfeld mit zahlreichen Barrikaden, Mauern und Kistenstapeln.', theme: 'Militärisch (Schlamm & Erde)' },
        { key: 'desert', name: 'Wüsten-Kreuzung', desc: 'Eine weitläufige Dünenlandschaft mit drei Hangaren im Süden. Der extreme Sandstaub erschwert die Sicht.', theme: 'Wüste (Sand & Staub)' },
        { key: 'arctic', name: 'Bunker-Ring', desc: 'Ein kreisförmiger Bunkerwall in der Mitte der eisigen Tundra. Der zentrale Raum bietet Schutz.', theme: 'Arktisch (Schnee & Eis)' },
        { key: 'toxic', name: 'Giftsumpf-Anlage', desc: 'Ein toxisches Industriegelände mit violetter Sumpferde und grünen Giftpfützen. Vier kleine Außenposten liegen in den Ecken.', theme: 'Toxisch (Violettes Sumpfland)' },
      ];

      const grid = document.createElement('div');
      grid.className = 'lexicon-grid';

      for (const m of maps) {
        const card = document.createElement('div');
        card.className = 'lexicon-card';
        card.innerHTML = `
          <div class="lexicon-card-header">
            <span class="lexicon-card-title">${m.name}</span>
          </div>
          <canvas class="lexicon-thumbnail" width="80" height="80" data-key="${m.key}" data-category="maps" style="background:#090b08; border: 1px solid rgba(74,246,38,0.12); border-radius: 8px; margin: 8px auto; display: block;"></canvas>
          <div class="lexicon-card-desc">${m.desc}</div>
          <div class="lexicon-stats">
            <div class="lexicon-stat-item" style="grid-column: span 2;">Vibe / Thema: <b>${m.theme}</b></div>
          </div>
        `;
        grid.appendChild(card);
      }
      container.appendChild(grid);
    }

    // Loop through injected canvases and render thumbnails
    const canvases = container.querySelectorAll('.lexicon-thumbnail');
    for (const canvas of canvases) {
      const ctx = canvas.getContext('2d');
      const cat = canvas.dataset.category;
      const key = canvas.dataset.key;
      drawLexiconThumbnail(ctx, cat, key, game);
    }
  }
}

function drawLexiconThumbnail(ctx, cat, key, game) {
  ctx.clearRect(0, 0, 80, 80);
  ctx.save();
  ctx.translate(40, 40); // center
  
  if (cat === 'enemies') {
    const e = new Enemy(key, 0, 0);
    e.vx = 1; e.vy = 0; // face right
    ctx.scale(1.2, 1.2);
    e.draw(ctx, 0, false);
  }
  else if (cat === 'bosses') {
    const b = new Boss(0, 0, 5, key);
    ctx.scale(0.48, 0.48);
    b.draw(ctx, 0, false);
  }
  else if (cat === 'buildings') {
    if (key === 'hangar') {
      ctx.fillStyle = '#2b2f33';
      ctx.fillRect(-35, -35, 70, 70);
      ctx.strokeStyle = '#1d2024';
      ctx.lineWidth = 1;
      for (let x = -25; x <= 25; x += 15) {
        ctx.beginPath(); ctx.moveTo(x, -35); ctx.lineTo(x, 35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-35, x); ctx.lineTo(35, x); ctx.stroke();
      }
      ctx.fillStyle = '#1c1d1f';
      ctx.fillRect(-35, -35, 70, 10);
      ctx.strokeStyle = '#050505';
      ctx.strokeRect(-35, -35, 70, 10);
      ctx.fillStyle = '#e5a93b';
      ctx.beginPath(); ctx.arc(10, 10, 8, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.stroke();
    }
    else if (key === 'baracke') {
      ctx.fillStyle = '#4a3d2c';
      ctx.fillRect(-35, -35, 70, 70);
      ctx.strokeStyle = '#2b2217';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-35, -35, 70, 70);
      ctx.fillStyle = '#6b573d';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.stroke();
    }
    else if (key === 'basecamp') {
      ctx.fillStyle = '#1e1c24';
      ctx.fillRect(-35, -35, 70, 70);
      ctx.strokeStyle = 'rgba(0, 255, 200, 0.25)';
      ctx.strokeRect(-35, -35, 70, 70);
      for (let x = -15; x <= 15; x += 15) {
        ctx.beginPath(); ctx.moveTo(x, -35); ctx.lineTo(x, 35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-35, x); ctx.lineTo(35, x); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.85)';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(22, -35); ctx.lineTo(22, 35); ctx.stroke();
    }
    else if (key === 'workbench') {
      ctx.fillStyle = '#3c4043';
      ctx.fillRect(-30, -15, 60, 30);
      ctx.strokeStyle = '#18191a';
      ctx.lineWidth = 2;
      ctx.strokeRect(-30, -15, 60, 30);
      ctx.fillStyle = '#9c2626';
      ctx.fillRect(-12, -8, 24, 16);
      ctx.strokeRect(-12, -8, 24, 16);
      ctx.fillStyle = '#999';
      ctx.fillRect(-4, -2, 8, 4);
    }
    else if (key === 'shop') {
      ctx.fillStyle = '#8a6237';
      ctx.fillRect(-30, -20, 60, 40);
      ctx.strokeStyle = '#4a321a';
      ctx.lineWidth = 2;
      ctx.strokeRect(-30, -20, 60, 40);
      ctx.fillStyle = '#d94141';
      ctx.fillRect(-15, -8, 12, 16);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-11, -2, 4, 4);
      ctx.fillStyle = '#3a86ff';
      ctx.fillRect(5, -10, 10, 16);
      ctx.fillStyle = '#ffa500';
      ctx.fillRect(8, -4, 4, 4);
    }
    else if (key === 'training') {
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ff3300';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
    else if (key === 'atm') {
      ctx.fillStyle = '#2a2d33';
      ctx.fillRect(-20, -15, 40, 30);
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 2;
      ctx.strokeRect(-20, -15, 40, 30);
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏧', 0, 0);
    }
  }
  else if (cat === 'maps') {
    let themeColor = '#221b14';
    let mudColor = '#17120d';
    let grassColor = '#2d3319';
    let detailColor = '#ff5500';
    
    if (key === 'military') {
      themeColor = '#221b14'; mudColor = '#17120d'; grassColor = '#2d3319';
    } else if (key === 'battlefield') {
      themeColor = '#2a2620'; mudColor = '#1c1914'; grassColor = '#3f452d';
    } else if (key === 'desert') {
      themeColor = '#3a2f1e'; mudColor = '#4a3d26'; grassColor = '#6b5a2e'; detailColor = '#ffaa00';
    } else if (key === 'arctic') {
      themeColor = '#dce8ee'; mudColor = '#a9c2cf'; grassColor = '#c3d8e0'; detailColor = '#4ad9ff';
    } else if (key === 'toxic') {
      themeColor = '#241a2e'; mudColor = '#33224a'; grassColor = '#6fbf3f'; detailColor = '#9c4eff';
    }

    ctx.fillStyle = themeColor;
    ctx.fillRect(-35, -35, 70, 70);
    ctx.fillStyle = mudColor;
    ctx.beginPath(); ctx.ellipse(-10, -5, 20, 12, 0.4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = grassColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(15, 15); ctx.lineTo(12, 5);
    ctx.moveTo(15, 15); ctx.lineTo(20, 7);
    ctx.moveTo(-18, 10); ctx.lineTo(-22, 0);
    ctx.stroke();
    ctx.fillStyle = detailColor;
    ctx.beginPath(); ctx.arc(-5, -20, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(22, -12, 2, 0, Math.PI*2); ctx.fill();
  }
  
  ctx.restore();
}

function getStatsAtLevel(def, lvl) {
  return {
    damage: Math.round(def.damage * (1 + lvl * 0.12) * 10) / 10,
    fireRate: Math.round(def.fireRate * (1 + lvl * 0.08) * 10) / 10,
    mag: Math.round(def.mag * (1 + lvl * 0.2)),
    reload: def.reload
  };
}

function getWeaponIconSvg(key) {
  switch (key) {
    case 'plasma':
      return `<svg width="36" height="36" viewBox="0 0 16 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="5" y="8" width="2" height="5" fill="#333"/>
        <rect x="4" y="11" width="2" height="2" fill="#222"/>
        <rect x="4" y="6" width="8" height="3" fill="#444"/>
        <rect x="3" y="6" width="1" height="2" fill="#222"/>
        <rect x="5" y="5" width="8" height="1.5" fill="#555"/>
        <rect x="9" y="8" width="2" height="1" fill="#ffa500"/>
        <rect x="11" y="8" width="1" height="1" fill="#ff4500"/>
        <rect x="7" y="9" width="1" height="1" fill="#555"/>
      </svg>`;
    
    case 'rifle':
      return `<svg width="48" height="36" viewBox="0 0 20 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="1" y="6" width="3" height="3" fill="#4a3b32"/>
        <rect x="2" y="7" width="2" height="4" fill="#3d3027"/>
        <rect x="4" y="6" width="6" height="3.5" fill="#333"/>
        <rect x="5" y="9.5" width="1.5" height="3.5" fill="#222"/>
        <rect x="7.5" y="9.5" width="2" height="4" fill="#111"/>
        <rect x="10" y="6.5" width="5" height="2.5" fill="#5c483a"/>
        <rect x="15" y="7" width="4" height="1.5" fill="#444"/>
        <rect x="6" y="4.5" width="3" height="1.5" fill="#222"/>
      </svg>`;

    case 'shotgun':
      return `<svg width="48" height="36" viewBox="0 0 20 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="1" y="7" width="4" height="2" fill="#5c3c24"/>
        <rect x="2" y="8" width="4" height="3.5" fill="#472e1c"/>
        <rect x="6" y="6.5" width="5" height="3" fill="#3a4042"/>
        <rect x="11" y="6.5" width="8" height="1.5" fill="#606668"/>
        <rect x="11" y="8" width="4" height="2" fill="#5c3c24"/>
        <rect x="15" y="8" width="3" height="1" fill="#444"/>
      </svg>`;

    case 'sniper':
      return `<svg width="54" height="36" viewBox="0 0 24 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="1" y="7" width="3" height="2" fill="#2d382b"/>
        <rect x="2" y="8" width="2" height="4" fill="#1b241a"/>
        <rect x="4" y="6.5" width="7" height="3.5" fill="#364035"/>
        <rect x="5" y="10" width="1.5" height="3" fill="#111"/>
        <rect x="8" y="10" width="2.5" height="4.5" fill="#222"/>
        <rect x="5.5" y="4" width="4.5" height="1.5" fill="#111"/>
        <rect x="5" y="3.5" width="1" height="2.5" fill="#2d382b"/>
        <rect x="9.5" y="3.5" width="1" height="2.5" fill="#2d382b"/>
        <rect x="11" y="7" width="10" height="1.5" fill="#222"/>
        <rect x="21" y="6" width="2" height="3.5" fill="#444"/>
        <rect x="14" y="8.5" width="1" height="5" fill="#111"/>
      </svg>`;

    case 'cannon':
      return `<svg width="48" height="36" viewBox="0 0 20 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="3" y="6" width="9" height="4.5" fill="#6b4c31"/>
        <rect x="4" y="6.5" width="7" height="3.5" fill="#523924"/>
        <rect x="0" y="6.5" width="3" height="3" fill="#3a4042"/>
        <rect x="1" y="6" width="1.5" height="4" fill="#222"/>
        <rect x="12" y="6.5" width="4" height="3.5" fill="#3a4042"/>
        <rect x="5" y="10.5" width="1.5" height="3" fill="#222"/>
        <rect x="10" y="10.5" width="1.5" height="2.5" fill="#222"/>
        <rect x="16" y="6" width="1.5" height="4" fill="#495738"/>
        <path d="M 17.5 6.5 L 19.5 8 L 17.5 9.5 Z" fill="#3d492f"/>
      </svg>`;

    case 'smg':
      return `<svg width="36" height="36" viewBox="0 0 16 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="2" y="5" width="10" height="4.5" fill="#2a2f32"/>
        <rect x="0" y="6" width="2" height="1.5" fill="#444"/>
        <rect x="4" y="9.5" width="1.8" height="4" fill="#1b1d1e"/>
        <rect x="4.4" y="13.5" width="1.2" height="2" fill="#000"/>
        <rect x="9.5" y="9.5" width="1.5" height="3" fill="#1b1d1e"/>
        <rect x="12" y="6.5" width="2" height="1.5" fill="#555"/>
        <rect x="6" y="3.8" width="3.5" height="1.2" fill="#ffa500" opacity="0.8"/>
      </svg>`;

    case 'flamethrower':
      return `<svg width="48" height="36" viewBox="0 0 20 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="2" y="6" width="10" height="3.5" fill="#3a3a3a"/>
        <rect x="3" y="9.5" width="1.5" height="3" fill="#1a1a1a"/>
        <rect x="8" y="9.5" width="1.5" height="2.5" fill="#1a1a1a"/>
        <rect x="5.5" y="9.5" width="4.5" height="4.5" fill="#b82525"/>
        <rect x="6" y="10" width="3.5" height="3.5" fill="#8f1b1b"/>
        <rect x="12" y="6.5" width="5" height="2" fill="#555"/>
        <rect x="17" y="6" width="1" height="3" fill="#111"/>
        <circle cx="18.5" cy="7.5" r="1" fill="#ffa500"/>
      </svg>`;

    case 'tesla':
      return `<svg width="48" height="36" viewBox="0 0 20 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="2" y="5.5" width="7" height="5" fill="#2d3338"/>
        <rect x="9" y="6" width="1.5" height="4" fill="#d16b28"/>
        <rect x="11.5" y="6" width="1.5" height="4" fill="#d16b28"/>
        <rect x="14" y="6" width="1.5" height="4" fill="#d16b28"/>
        <rect x="9" y="7" width="6.5" height="2" fill="#b05214"/>
        <path d="M 15.5 5.5 L 18 4.5 L 17 6.5 Z" fill="#69767f"/>
        <path d="M 15.5 10.5 L 18 11.5 L 17 9.5 Z" fill="#69767f"/>
        <circle cx="18" cy="8" r="1.5" fill="#2df0ff" opacity="0.9"/>
      </svg>`;

    case 'cryo':
      return `<svg width="48" height="36" viewBox="0 0 20 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="2" y="5.5" width="9" height="4.5" fill="#e3edf2"/>
        <rect x="3" y="6" width="7.5" height="3.5" fill="#afc5cf"/>
        <rect x="4" y="7" width="5.5" height="1.5" fill="#00e5ff"/>
        <rect x="3" y="10" width="1.5" height="3" fill="#1b2022"/>
        <rect x="8.5" y="10" width="1.5" height="2.5" fill="#1b2022"/>
        <rect x="11" y="6.5" width="6" height="2.5" fill="#7593a1"/>
        <rect x="17" y="6" width="1" height="3.5" fill="#00e5ff"/>
      </svg>`;

    case 'revolver':
      return `<svg width="36" height="36" viewBox="0 0 16 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="4" y="10" width="2" height="4" fill="#3a2a1a"/>
        <rect x="3.5" y="13" width="3" height="1.5" fill="#2a1d10"/>
        <circle cx="7" cy="8" r="2.4" fill="#555"/>
        <circle cx="7" cy="8" r="2.4" fill="none" stroke="#222" stroke-width="0.5"/>
        <rect x="5.5" y="6" width="2" height="1.5" fill="#333"/>
        <rect x="9" y="7.2" width="6" height="1.6" fill="#444"/>
        <rect x="14.5" y="7" width="1" height="2" fill="#222"/>
      </svg>`;

    case 'mac10':
      return `<svg width="36" height="36" viewBox="0 0 16 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="1" y="6.5" width="2" height="1.5" fill="#222"/>
        <rect x="3" y="6" width="7" height="3" fill="#333"/>
        <rect x="10" y="6.5" width="4" height="1.5" fill="#111"/>
        <rect x="4" y="9.5" width="1.5" height="2" fill="#111"/>
        <rect x="6" y="9" width="1.8" height="5" fill="#1a1a1a"/>
      </svg>`;

    case 'carbine':
      return `<svg width="48" height="36" viewBox="0 0 20 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="1" y="8" width="2" height="1.5" fill="#1c2126"/>
        <rect x="2" y="6.5" width="7" height="3" fill="#354049"/>
        <rect x="4" y="9.5" width="1.8" height="4" fill="#1c2126"/>
        <rect x="5" y="5" width="3" height="1.5" fill="#20262b"/>
        <rect x="9" y="6.8" width="9" height="1.8" fill="#404c56"/>
        <rect x="17.5" y="6.5" width="1.5" height="2.4" fill="#222"/>
      </svg>`;

    case 'sawedoff':
      return `<svg width="36" height="36" viewBox="0 0 16 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
        <rect x="2" y="8.5" width="4" height="3" fill="#5c3c24"/>
        <rect x="6" y="6.5" width="8" height="1.8" fill="#333"/>
        <rect x="6" y="8.5" width="8" height="1.8" fill="#2a2a2a"/>
        <circle cx="14.3" cy="7.4" r="0.9" fill="#111"/>
        <circle cx="14.3" cy="9.4" r="0.9" fill="#111"/>
      </svg>`;

    default:
      return `<svg width="36" height="36" viewBox="0 0 16 16">
        <rect x="4" y="6" width="8" height="4" fill="#888"/>
      </svg>`;
  }
}

function getUpgradeIconSvg() {
  return `<svg width="36" height="36" viewBox="0 0 16 16" style="image-rendering:pixelated; display:inline-block; vertical-align:middle;">
    <path d="M 2 14 L 9 7 L 11 9 L 4 16 Z" fill="#889297"/>
    <path d="M 8 6 C 8 3.8 9.8 2 12 2 C 14.2 2 16 3.8 16 6 C 16 7.5 15.2 8.8 14 9.5 L 12 7.5 L 10.5 9 C 9.3 8.3 8.3 7.3 8 6 Z" fill="#b0bac0"/>
    <circle cx="12" cy="6" r="1.2" fill="#111"/>
  </svg>`;
}
