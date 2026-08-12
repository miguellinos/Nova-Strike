// ---------- main.js : bootstrap, menus, loop ----------
const Menus = {
  overlays: ['profile-menu', 'main-menu', 'play-menu', 'pause-menu', 'settings-menu', 'controls-menu', 'shop-menu', 'gameover-menu', 'extract-menu', 'upgrade-menu',
             'coop-menu', 'coop-host-menu', 'coop-join-menu', 'workbench-menu', 'inventory-menu', 'character-menu', 'cheat-menu', 'lexicon-menu', 'atm-menu'],
  prev: null,
  hideAll() { this.overlays.forEach((id) => document.getElementById(id).classList.add('hidden')); },
  show(id) { this.hideAll(); document.getElementById(id).classList.remove('hidden'); },
};

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  Input.init(canvas);
  const game = new Game(canvas);
  window.game = game;

  // Set from the lexicon's "⚔️ Bekämpfen" button; consumed (and cleared) by
  // 'cheat-start' — reuses the whole cheat-menu loadout picker instead of
  // building a second, near-identical UI just for boss practice fights.
  let pendingBossFight = null;
  const BOSS_NAMES = {
    tank: 'Superpanzer "LEVIATHAN"', spider: 'Arachno-Läufer "WIDOW"',
    artillery: 'Haubitzen-Plattform "GOLIATH"', swarm: 'Befehlshaber "SCHWARM"',
    operative: 'Elite-Operator "GHOST"',
  };

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
  const fsEl = document.getElementById('set-fullscreen');
  fsEl.checked = s.fullscreen;
  fsEl.addEventListener('change', () => {
    Settings.set('fullscreen', fsEl.checked);
    if (fsEl.checked && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    else if (!fsEl.checked && document.exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  });

  // Re-sync the settings widgets from Settings.data — used after a profile is
  // selected, since a profile carries its own saved settings.
  function refreshSettingsUI() {
    for (const [id, key] of [['set-master', 'master'], ['set-music', 'music'], ['set-sfx', 'sfx']]) {
      const el = document.getElementById(id);
      el.value = s[key];
      const valSpan = el.parentElement.querySelector('.slider-val');
      if (valSpan) valSpan.textContent = s[key];
    }
    quality.value = s.quality;
    fsEl.checked = s.fullscreen;
    Audio2.applyVolumes();
  }

  // ----- profiles -----
  const profileListEl = document.getElementById('profile-list');
  const profileNameInput = document.getElementById('profile-name-input');
  const profileError = document.getElementById('profile-error');
  const mainMenuProfile = document.getElementById('main-menu-profile');
  let cachedProfiles = [];

  function showProfileError(msg) {
    profileError.textContent = msg;
    profileError.classList.remove('hidden');
  }

  function enterMainMenu() {
    if (Profile.current) {
      mainMenuProfile.textContent = 'Profil: ' + Profile.current.name;
      refreshSettingsUI();
    }
    Menus.show('main-menu');
  }

  async function renderProfileList() {
    profileError.classList.add('hidden');
    profileListEl.innerHTML = '<p class="profile-empty">Lade Profile…</p>';
    try {
      cachedProfiles = await Profile.list();
    } catch (e) {
      // No server (e.g. file:// play) — offer offline play so the game is never blocked.
      profileListEl.innerHTML = '<p class="profile-empty">Kein Server erreichbar — spiele ohne Profil.</p>';
      return;
    }
    if (!cachedProfiles.length) {
      profileListEl.innerHTML = '<p class="profile-empty">Noch keine Profile. Erstelle eins unten.</p>';
      return;
    }
    profileListEl.innerHTML = cachedProfiles.map((p) =>
      '<button class="btn profile-item" data-action="profile-select" data-id="' + p.id + '">' + escapeHtml(p.name) + '</button>'
    ).join('');
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function createProfile() {
    const name = profileNameInput.value.trim();
    if (!name) { showProfileError('Bitte einen Namen eingeben.'); return; }
    try {
      const p = await Profile.getOrCreate(name);
      Profile.select(p);
      profileNameInput.value = '';
      enterMainMenu();
    } catch (e) {
      showProfileError('Profil konnte nicht erstellt werden (kein Server?). Du kannst ohne Profil spielen.');
    }
  }

  profileNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); createProfile(); }
  });

  renderProfileList();

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
      game.newGame('host', gameMode); // picks the random map layout (and extraction zone, if that mode)
      const extractPos = game.extractionPoint ? { x: game.extractionPoint.x, y: game.extractionPoint.y } : null;
      Net.sendStart(gameMode, game.world.layoutIndex, extractPos); // tell the guest which one, so both see the same map/zone
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
    // 'room-busy' is the one rejection aimed at a would-be host, so it belongs on
    // the host screen — the join screen isn't even visible to them.
    if (msg.reason === 'room-busy') {
      coop.hostStatus.textContent = 'Auf diesem Server läuft schon eine Runde.';
      coop.hostStatus.classList.remove('hidden');
      return;
    }
    coop.joinStatus.textContent = msg.reason === 'bad-code' ? 'Falscher Code.' : 'Kein Raum gefunden.';
  });
  Net.on('ready-changed', () => {
    if (Net.role === 'host') coop.hostGuestStatus.textContent = Net.guestReady ? 'Mitspieler ist bereit!' : 'Warte auf Mitspieler...';
    else coop.joinHostStatus.textContent = Net.hostReady ? 'Host ist bereit!' : 'Warte auf Host...';
    maybeStartMatch();
  });
  Net.on('start', (msg) => {
    if (Net.role === 'guest') {
      game.newGame('guest', msg.gameMode, msg.mapIndex, undefined, msg.extractPos);
      Menus.hideAll();
      Net.sendCharacter(Settings.data.character); // tell the host which skin to render for us
    }
  });
  Net.on('snapshot', (data) => { if (game.mode === 'guest') game.applySnapshot(data); });
  Net.on('input', (data) => { if (game.player2 && game.player2.isRemote) game.player2.input.applyPacket(data); });
  Net.on('shop-action', (data) => { game.onGuestShopAction(data); });
  Net.on('shop-done', () => { game.onGuestShopDone(); });
  Net.on('workbench-action', (data) => { game.onGuestWorkbenchAction(data); });
  Net.on('atm-action', (data) => { game.onGuestAtmAction(data); });
  Net.on('character', (msg) => { if (game.mode === 'host' && game.player2) game.player2.charId = msg.charId; });
  Net.on('peer-left', () => {
    if (game.state === 'playing' || game.state === 'shop') {
      game.ui.toast('Verbindung zum Mitspieler verloren.');
      game.cancelDelayed(); game.state = 'menu'; game.ui.showHUD(false); Net.reset(); Menus.show('main-menu');
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
      case 'start-extraction': Net.reset(); game.newGame('solo', 'extraction'); Menus.hideAll(); break;
      case 'play-menu': Menus.show('play-menu'); break;
      case 'play-back': Menus.show('main-menu'); break;
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
      case 'quit':
        // tear the run down like 'menu' does — otherwise the HUD stays drawn over
        // the main menu and the abandoned run keeps ticking behind it
        game.cancelDelayed(); game.state = 'menu'; game.ui.showHUD(false); Net.reset();
        Menus.show('main-menu'); game.ui.toast('Danke fürs Spielen! Du kannst den Tab schließen.');
        break;
      case 'resume': game.resume(); break;
      case 'restart': Net.reset(); game.newGame('solo', game.gameMode); Menus.hideAll(); break;
      case 'menu': game.cancelDelayed(); game.state = 'menu'; game.ui.showHUD(false); Net.reset(); Menus.show('main-menu'); break;
      case 'shop-close': game.leaveShop(); break;
      case 'workbench-close': game.closeWorkbench(); break;
      case 'inventory-close': game.closeInventory(); break;
      case 'upgrade-close': game.closeTrainingRange(); break;
      case 'atm-close': game.closeAtm(); break;
      case 'atm-send': {
        const val = parseInt(document.getElementById('atm-amount').value, 10) || 0;
        if (val > 0) game.sendCoinsFromAtm(val);
        break;
      }
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

      case 'profile-select': {
        const p = cachedProfiles.find((x) => String(x.id) === btn.dataset.id);
        if (p) { Profile.select(p); enterMainMenu(); }
        break;
      }
      case 'profile-create': createProfile(); break;
      case 'profile-offline': Profile.playOffline(); enterMainMenu(); break;
      case 'switch-profile': renderProfileList(); Menus.show('profile-menu'); break;

      case 'cheat-back':
        pendingBossFight = null;
        Menus.show(Menus.prev || 'main-menu');
        break;
      case 'fight-boss': {
        pendingBossFight = btn.dataset.boss;
        Menus.prev = 'lexicon-menu';
        document.getElementById('cheat-wave').value = 5;
        const title = document.querySelector('#cheat-menu .panel-title');
        const subtitle = document.querySelector('#cheat-menu .subtitle');
        if (title) title.textContent = '⚔️ BOSS-PROBEKAMPF';
        if (subtitle) subtitle.textContent = 'Lade dich aus, dann kämpfst du direkt gegen: ' + (BOSS_NAMES[pendingBossFight] || pendingBossFight);
        Menus.show('cheat-menu');
        renderCheatMaps();
        renderCheatWeapons();
        break;
      }
      case 'cheat-wave-inc': cheatStep('cheat-wave', 1, 1, 99); break;
      case 'cheat-wave-dec': cheatStep('cheat-wave', -1, 1, 99); break;
      case 'cheat-medkit-inc': cheatStep('cheat-medkits', 1, 0, 99); break;
      case 'cheat-medkit-dec': cheatStep('cheat-medkits', -1, 0, 99); break;
      case 'cheat-shield-inc': cheatStep('cheat-shields', 1, 0, 99); break;
      case 'cheat-shield-dec': cheatStep('cheat-shields', -1, 0, 99); break;
      case 'cheat-grenade-inc': cheatStep('cheat-grenades', 1, 0, 99); break;
      case 'cheat-grenade-dec': cheatStep('cheat-grenades', -1, 0, 99); break;
      case 'cheat-weapon-toggle':
        if (!btn.classList.contains('locked')) btn.classList.toggle('selected');
        break;
      case 'cheat-start': {
        const waveInput = document.getElementById('cheat-wave');
        const wave = Math.max(1, parseInt(waveInput.value, 10) || 1);
        const horror = document.getElementById('cheat-horror').checked;
        const weapons = Array.from(document.querySelectorAll('.cheat-weapon-card.selected')).map((el) => el.dataset.weapon);
        const medkits = Math.max(0, parseInt(document.getElementById('cheat-medkits').value, 10) || 0);
        const shields = Math.max(0, parseInt(document.getElementById('cheat-shields').value, 10) || 0);
        const grenades = Math.max(0, parseInt(document.getElementById('cheat-grenades').value, 10) || 0);
        const mapSelect = document.getElementById('cheat-map');
        const mapChoice = mapSelect ? parseInt(mapSelect.value, 10) : -1;
        const mapIndex = mapChoice >= 0 ? mapChoice : undefined; // undefined = World picks randomly, same as normal play
        const forceBoss = pendingBossFight;
        pendingBossFight = null;
        Net.reset();
        game.newGame('solo', horror ? 'horror' : 'standard', mapIndex, { wave, weapons, medkits, shields, grenades, forceBoss });
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
      const abilityHtml = c.ability
        ? '<div class="weapon-stats"><span>' + c.ability.icon + ' <b>' + c.ability.name + '</b> (Taste C, ' + c.ability.cd + 's)</span></div>' +
          '<div class="desc">' + c.ability.desc + '</div>'
        : '';
      card.innerHTML =
        '<div class="icon">' + c.icon + '</div>' +
        '<div class="name">' + c.name + '</div>' +
        '<div style="width:36px;height:14px;border-radius:4px;margin:4px 0 8px;background:' + c.camo + ';border:1px solid ' + c.camoStroke + ';"></div>' +
        '<div class="desc">' + (c.perkDesc || '') + '</div>' +
        abilityHtml +
        '<button class="buy" data-action="pick-character" data-char="' + c.id + '">' + (selected ? 'AUSGEWÄHLT' : 'AUSWÄHLEN') + '</button>';
      card.querySelector('.buy').disabled = selected;
      container.appendChild(card);
    });
  }

  function cheatStep(id, delta, min, max) {
    const el = document.getElementById(id);
    el.value = Utils.clamp((parseInt(el.value, 10) || 0) + delta, min, max);
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

  function renderCheatMaps() {
    const select = document.getElementById('cheat-map');
    if (!select || select.dataset.populated) return; // MAP_LAYOUTS never changes at runtime — build the list once
    select.dataset.populated = '1';
    MAP_LAYOUTS.forEach((layout, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = layout.name;
      select.appendChild(opt);
    });
  }

  // Cheat mode: press "M" while the main menu is open to pick a starting wave + weapons (solo only).
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'm') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (getVisibleOverlay() !== 'main-menu') return;
    pendingBossFight = null;
    Menus.prev = 'main-menu';
    const title = document.querySelector('#cheat-menu .panel-title');
    const subtitle = document.querySelector('#cheat-menu .subtitle');
    if (title) title.textContent = '🛠️ DEV-MODUS';
    if (subtitle) subtitle.textContent = 'Startwelle, Karte & Startwaffen wählen (nur Solo).';
    Menus.show('cheat-menu');
    renderCheatMaps();
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
  document.getElementById('inv-ability').addEventListener('click', (e) => {
    Input.pressed['c'] = true;
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

  // ----- UI sound feedback -----
  // Delegated, so it also covers buttons/cards injected dynamically (shop,
  // workbench, lexicon). Purely additive — never blocks or alters the click.
  const uiRoot = document.getElementById('game-container');
  if (uiRoot) {
    const isUi = (el) => el && el.closest && el.closest('.btn, .inv-btn, .shop-card .buy, .lexicon-tab-btn, .cheat-step-btn, .cheat-weapon-card, .mc-slot');
    uiRoot.addEventListener('click', (e) => { if (isUi(e.target)) Audio2.uiClick(); }, true);
    let lastHover = null;
    uiRoot.addEventListener('mouseover', (e) => {
      const el = isUi(e.target);
      if (el && el !== lastHover) { lastHover = el; Audio2.uiHover(); }
      else if (!el) lastHover = null;
    }, true);
  }

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
