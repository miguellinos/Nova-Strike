// ---------- main.js : bootstrap, menus, loop ----------
const Menus = {
  overlays: ['main-menu', 'pause-menu', 'settings-menu', 'controls-menu', 'shop-menu', 'gameover-menu', 'upgrade-menu',
             'coop-menu', 'coop-host-menu', 'coop-join-menu', 'workbench-menu', 'inventory-menu', 'character-menu', 'cheat-menu', 'lexicon-menu'],
  prev: null,
  hideAll() { this.overlays.forEach((id) => document.getElementById(id).classList.add('hidden')); },
  show(id) { this.hideAll(); document.getElementById(id).classList.remove('hidden'); },
};

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  Input.init(canvas);
  const game = new Game(canvas);
  window.game = game;

  // ----- settings UI -----
  const s = Settings.data;
  const bindSlider = (id, key) => {
    const el = document.getElementById(id);
    const valSpan = el.parentElement.querySelector('.slider-val');
    el.value = s[key];
    valSpan.textContent = s[key];
    el.addEventListener('input', () => {
      Settings.set(key, parseInt(el.value, 10));
      valSpan.textContent = el.value;
      Audio2.applyVolumes();
    });
  };
  bindSlider('set-master', 'master');
  bindSlider('set-music', 'music');
  bindSlider('set-sfx', 'sfx');
  const quality = document.getElementById('set-quality');
  quality.value = s.quality;
  quality.addEventListener('change', () => Settings.set('quality', quality.value));
  const fs = document.getElementById('set-fullscreen');
  fs.checked = s.fullscreen;
  fs.addEventListener('change', () => {
    Settings.set('fullscreen', fs.checked);
    if (fs.checked && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    else if (!fs.checked && document.exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  });

  // ----- LAN co-op networking -----
  const coop = {
    hostStatus: document.getElementById('coop-host-status'),
    codeWrap: document.getElementById('coop-code-wrap'),
    roomCode: document.getElementById('coop-room-code'),
    hostIps: document.getElementById('coop-host-ips'),
    hostGuestStatus: document.getElementById('coop-host-guest-status'),
    hostReadyBtn: document.getElementById('coop-host-ready-btn'),
    codeInput: document.getElementById('coop-code-input'),
    joinStatus: document.getElementById('coop-join-status'),
    joinReadyWrap: document.getElementById('coop-join-ready-wrap'),
    joinHostStatus: document.getElementById('coop-join-host-status'),
  };
  coop.codeInput.addEventListener('input', () => {
    coop.codeInput.value = coop.codeInput.value.replace(/\D/g, '').slice(0, 4);
  });

  function maybeStartMatch() {
    if (Net.hostReady && Net.guestReady && Net.role === 'host') {
      const modeSelect = document.getElementById('coop-game-mode');
      const gameMode = modeSelect ? modeSelect.value : 'standard';
      game.newGame('host', gameMode); // picks the random map layout
      Net.sendStart(gameMode, game.world.layoutIndex); // tell the guest which one, so both see the same map
      Menus.hideAll();
    }
  }

  Net.on('room-created', (msg) => {
    coop.hostStatus.classList.add('hidden');
    coop.codeWrap.classList.remove('hidden');
    coop.roomCode.textContent = msg.code;
    coop.hostIps.innerHTML = (msg.ips || []).map((ip) => `<span class="coop-ip-chip">http://${ip}:${msg.port}</span>`).join('')
      || '<span class="coop-ip-chip coop-ip-chip-empty">(keine LAN-IP gefunden)</span>';
    coop.hostReadyBtn.classList.remove('hidden');
  });
  Net.on('guest-joined', () => { coop.hostGuestStatus.textContent = 'Mitspieler verbunden! Beide auf Bereit klicken.'; });
  Net.on('joined', () => {
    coop.joinStatus.textContent = 'Verbunden.';
    coop.joinReadyWrap.classList.remove('hidden');
  });
  Net.on('join-error', (msg) => {
    coop.joinStatus.textContent = msg.reason === 'bad-code' ? 'Falscher Code.' : 'Kein Raum gefunden.';
  });
  Net.on('ready-changed', () => {
    if (Net.role === 'host') coop.hostGuestStatus.textContent = Net.guestReady ? 'Mitspieler ist bereit!' : 'Warte auf Mitspieler...';
    else coop.joinHostStatus.textContent = Net.hostReady ? 'Host ist bereit!' : 'Warte auf Host...';
    maybeStartMatch();
  });
  Net.on('start', (msg) => {
    if (Net.role === 'guest') {
      game.newGame('guest', msg.gameMode, msg.mapIndex);
      Menus.hideAll();
      Net.sendCharacter(Settings.data.character); // tell the host which skin to render for us
    }
  });
  Net.on('snapshot', (data) => { if (game.mode === 'guest') game.applySnapshot(data); });
  Net.on('input', (data) => { if (game.player2 && game.player2.isRemote) game.player2.input.applyPacket(data); });
  Net.on('shop-action', (data) => { game.onGuestShopAction(data); });
  Net.on('shop-done', () => { game.onGuestShopDone(); });
  Net.on('workbench-action', (data) => { game.onGuestWorkbenchAction(data); });
  Net.on('character', (msg) => { if (game.mode === 'host' && game.player2) game.player2.charId = msg.charId; });
  Net.on('peer-left', () => {
    if (game.state === 'playing' || game.state === 'shop') {
      alert('Verbindung zum Mitspieler verloren.');
      game.state = 'menu'; game.ui.showHUD(false); Net.reset(); Menus.show('main-menu');
    }
  });
  Net.on('disconnected', () => { Net.peerConnected = false; });

  // ----- button actions (event delegation) -----
  document.getElementById('game-container').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    Audio2.init(); Audio2.resume();
    const action = btn.dataset.action;
    switch (action) {
      case 'start-standard': Net.reset(); game.newGame('solo', 'standard'); Menus.hideAll(); break;
      case 'start-horror': Net.reset(); game.newGame('solo', 'horror'); Menus.hideAll(); break;
      case 'settings': Menus.prev = getVisibleOverlay(); Menus.show('settings-menu'); break;
      case 'settings-back': Menus.show(Menus.prev || 'main-menu'); if (game.state === 'paused') {/* stay paused overlay */} break;
      case 'controls': Menus.prev = getVisibleOverlay(); Menus.show('controls-menu'); break;
      case 'controls-back': Menus.show(Menus.prev || 'main-menu'); break;
      case 'lexicon-menu':
        Menus.prev = getVisibleOverlay();
        Menus.show('lexicon-menu');
        // Reset active tabs to Weapons by default
        document.querySelectorAll('.lexicon-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === 'lexicon-weapons'));
        game.ui.showLexiconTab('lexicon-weapons', game);
        break;
      case 'lexicon-back':
        Menus.show(Menus.prev || 'main-menu');
        break;
      case 'quit': Menus.show('main-menu'); alert('Danke fürs Spielen! Du kannst den Tab schließen.'); break;
      case 'resume': game.resume(); break;
      case 'restart': Net.reset(); game.newGame('solo', game.gameMode); Menus.hideAll(); break;
      case 'menu': game.state = 'menu'; game.ui.showHUD(false); Net.reset(); Menus.show('main-menu'); break;
      case 'shop-close': game.leaveShop(); break;
      case 'workbench-close': game.closeWorkbench(); break;
      case 'inventory-close': game.closeInventory(); break;
      case 'upgrade-close': game.closeTrainingRange(); break;
      case 'open-shop':
        if (game.mode === 'solo') {
          if (game.state === 'playing') { game.midWaveShop = true; game.openTacticalShop(); }
        } else if (!game.shopOpenLocal && game.state === 'playing') {
          // co-op: personal mid-wave shop overlay, no free upgrade, world keeps running
          game.midWaveShop = true;
          game.shopOpenLocal = true;
          game.ui.showHUD(false);
          game.ui.showTacticalShop(game);
          Menus.show('shop-menu');
        }
        break;

      case 'character-menu': Menus.show('character-menu'); renderCharacterMenu(); break;
      case 'character-back': Menus.show('main-menu'); break;

      case 'cheat-back': Menus.show('main-menu'); break;
      case 'cheat-wave-inc': {
        const el = document.getElementById('cheat-wave');
        el.value = Math.min(99, (parseInt(el.value, 10) || 1) + 1);
        break;
      }
      case 'cheat-wave-dec': {
        const el = document.getElementById('cheat-wave');
        el.value = Math.max(1, (parseInt(el.value, 10) || 1) - 1);
        break;
      }
      case 'cheat-weapon-toggle':
        if (!btn.classList.contains('locked')) btn.classList.toggle('selected');
        break;
      case 'cheat-start': {
        const waveInput = document.getElementById('cheat-wave');
        const wave = Math.max(1, parseInt(waveInput.value, 10) || 1);
        const horror = document.getElementById('cheat-horror').checked;
        const weapons = Array.from(document.querySelectorAll('.cheat-weapon-card.selected')).map((el) => el.dataset.weapon);
        Net.reset();
        game.newGame('solo', horror ? 'horror' : 'standard', undefined, { wave, weapons });
        Menus.hideAll();
        break;
      }
      case 'pick-character':
        Settings.set('character', btn.dataset.char);
        if (game.player) game.player.charId = btn.dataset.char;
        renderCharacterMenu();
        break;

      case 'coop-menu': Menus.show('coop-menu'); break;
      case 'coop-back': Menus.show('main-menu'); break;
      case 'coop-cancel': Net.reset(); Menus.show('main-menu'); break;
      case 'coop-ready': Net.setReady(); btn.disabled = true; btn.textContent = 'Bereit ✓'; break;

      case 'coop-host':
        coop.hostStatus.textContent = 'Verbinde zum lokalen Server...';
        coop.hostStatus.classList.remove('hidden');
        coop.codeWrap.classList.add('hidden');
        coop.hostReadyBtn.classList.add('hidden'); coop.hostReadyBtn.disabled = false; coop.hostReadyBtn.textContent = 'Bereit';
        Menus.show('coop-host-menu');
        Net.hostGame().catch(() => { coop.hostStatus.textContent = 'Server nicht erreichbar. Läuft "npm start"?'; });
        break;

      case 'coop-join':
        coop.joinStatus.textContent = '';
        coop.joinReadyWrap.classList.add('hidden');
        coop.codeInput.value = '';
        const ipInput = document.getElementById('coop-ip-input');
        if (ipInput) {
          ipInput.value = (location.hostname && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') ? location.hostname : '';
        }
        Menus.show('coop-join-menu');
        break;

      case 'coop-join-submit': {
        const code = coop.codeInput.value.trim();
        const ipValInput = document.getElementById('coop-ip-input');
        const ip = ipValInput ? ipValInput.value.trim() : '';
        if (code.length !== 4) { coop.joinStatus.textContent = 'Bitte 4-stelligen Code eingeben.'; break; }
        coop.joinStatus.textContent = 'Verbinde...';
        Net.joinGame(code, ip).catch(() => { coop.joinStatus.textContent = 'Verbindung fehlgeschlagen. IP korrekt?'; });
        break;
      }
    }
  });

  function renderCharacterMenu() {
    const container = document.getElementById('character-cards');
    if (!container) return;
    container.innerHTML = '';
    CHARACTERS.forEach((c) => {
      const selected = Settings.data.character === c.id;
      const card = document.createElement('div');
      card.className = 'shop-card' + (selected ? ' bought' : '');
      card.innerHTML =
        '<div class="icon">' + c.icon + '</div>' +
        '<div class="name">' + c.name + '</div>' +
        '<div style="width:36px;height:14px;border-radius:4px;margin:4px 0 8px;background:' + c.camo + ';border:1px solid ' + c.camoStroke + ';"></div>' +
        '<div class="desc">' + (c.perkDesc || '') + '</div>' +
        '<button class="buy" data-action="pick-character" data-char="' + c.id + '">' + (selected ? 'AUSGEWÄHLT' : 'AUSWÄHLEN') + '</button>';
      card.querySelector('.buy').disabled = selected;
      container.appendChild(card);
    });
  }

  function renderCheatWeapons() {
    const container = document.getElementById('cheat-weapons');
    if (!container) return;
    container.innerHTML = '';
    WEAPON_ORDER.forEach((key) => {
      const def = WEAPON_DEFS[key];
      const isDefault = key === 'plasma'; // always owned — shown but locked on
      const card = document.createElement('div');
      card.className = 'cheat-weapon-card' + (isDefault ? ' selected locked' : '');
      card.dataset.action = 'cheat-weapon-toggle';
      card.dataset.weapon = key;
      card.innerHTML = '<span class="cheat-weapon-check"></span><span class="cheat-weapon-name">' + def.name + '</span>';
      container.appendChild(card);
    });
  }

  // Cheat mode: press "M" while the main menu is open to pick a starting wave + weapons (solo only).
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'm') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (getVisibleOverlay() !== 'main-menu') return;
    Menus.show('cheat-menu');
    renderCheatWeapons();
  });

  function getVisibleOverlay() {
    for (const id of Menus.overlays) {
      if (!document.getElementById(id).classList.contains('hidden')) return id;
    }
    return 'main-menu';
  }

  // On-screen inventory buttons — go through the normal input channel so this
  // also works for the remote (guest) player, whose actions only take effect
  // once relayed to and consumed by the host's simulation.
  document.getElementById('inv-medkit').addEventListener('click', (e) => {
    Input.pressed['q'] = true;
    e.stopPropagation();
  });
  document.getElementById('inv-shield').addEventListener('click', (e) => {
    Input.pressed['e'] = true;
    e.stopPropagation();
  });
  document.getElementById('inv-grenade').addEventListener('click', (e) => {
    Input.pressed['g'] = true;
    e.stopPropagation();
  });

  // Handle tab switching in Lexicon
  document.getElementById('game-container').addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.lexicon-tab-btn');
    if (!tabBtn) return;
    
    document.querySelectorAll('.lexicon-tab-btn').forEach(btn => btn.classList.remove('active'));
    tabBtn.classList.add('active');
    
    const targetTab = tabBtn.dataset.tab;
    game.ui.showLexiconTab(targetTab, game);
  });

  // ----- game loop -----
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // clamp big frame gaps
    // An uncaught error inside update()/render() used to kill the whole loop
    // silently — requestAnimationFrame(loop) was never called again, which
    // looked like the entire game freezing (frozen HUD, no more shooting/
    // clicking working, since nothing was updating anymore). Catch here so
    // one bad frame doesn't brick the whole session, and log it so the real
    // cause is visible in the console instead of just "everything is gone".
    try {
      game.update(dt);
      game.render();
    } catch (err) {
      console.error('Frame error (game kept running):', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
