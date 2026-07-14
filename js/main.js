// ---------- main.js : bootstrap, menus, loop ----------
const Menus = {
  overlays: ['main-menu', 'pause-menu', 'settings-menu', 'controls-menu', 'shop-menu', 'gameover-menu', 'upgrade-menu'],
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

  // ----- button actions (event delegation) -----
  document.getElementById('game-container').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    Audio2.init(); Audio2.resume();
    const action = btn.dataset.action;
    switch (action) {
      case 'start': game.newGame(); Menus.hideAll(); break;
      case 'settings': Menus.prev = getVisibleOverlay(); Menus.show('settings-menu'); break;
      case 'settings-back': Menus.show(Menus.prev || 'main-menu'); if (game.state === 'paused') {/* stay paused overlay */} break;
      case 'controls': Menus.prev = getVisibleOverlay(); Menus.show('controls-menu'); break;
      case 'controls-back': Menus.show(Menus.prev || 'main-menu'); break;
      case 'quit': Menus.show('main-menu'); alert('Danke fürs Spielen! Du kannst den Tab schließen.'); break;
      case 'resume': game.resume(); break;
      case 'restart': game.newGame(); Menus.hideAll(); break;
      case 'menu': game.state = 'menu'; game.ui.showHUD(false); Menus.show('main-menu'); break;
      case 'shop-close': game.closeShop(); break;
    }
  });

  function getVisibleOverlay() {
    for (const id of Menus.overlays) {
      if (!document.getElementById(id).classList.contains('hidden')) return id;
    }
    return 'main-menu';
  }

  // On-screen inventory buttons
  document.getElementById('inv-medkit').addEventListener('click', (e) => {
    if (game && game.player) {
      game.player.useMedkit(game);
    }
    e.stopPropagation();
  });
  document.getElementById('inv-shield').addEventListener('click', (e) => {
    if (game && game.player) {
      game.player.useShield(game);
    }
    e.stopPropagation();
  });

  // ----- game loop -----
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // clamp big frame gaps
    game.update(dt);
    game.render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
