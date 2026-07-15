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
      upgradeScore: document.getElementById('upgrade-score'),
      interactPrompt: document.getElementById('interact-prompt'),
      spectateBanner: document.getElementById('spectate-banner'),
      workbenchCoins: document.getElementById('workbench-coins'),
      workbenchCards: document.getElementById('workbench-cards'),
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

    if (this.el.spectateBanner) {
      this.el.spectateBanner.classList.toggle('hidden', !(p.hp <= 0 && game.players.length > 1));
    }

    if (this.el.interactPrompt) {
      const showPrompt = game.state === 'playing' && p.hp > 0 && !game.workbenchOpenLocal && !game.shopOpenLocal && !game.trainingOpenLocal;
      if (showPrompt && game.nearWorkbench) {
        this.el.interactPrompt.innerHTML = 'Drücke <b>F</b> für die Werkbank';
        this.el.interactPrompt.classList.remove('hidden');
      } else if (showPrompt && game.nearShop) {
        this.el.interactPrompt.innerHTML = 'Drücke <b>F</b> für den Shop';
        this.el.interactPrompt.classList.remove('hidden');
      } else if (showPrompt && game.nearTrainingRange) {
        this.el.interactPrompt.innerHTML = 'Drücke <b>F</b> für Trainingsrange';
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
        { id: 'shield', name: 'Schildzelle', icon: '🛡️', count: me.shieldsCount || 0, desc: 'Lädt dein Schild um 50 Punkte auf.', canUse: me.shieldHp < me.maxShieldHp }
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
