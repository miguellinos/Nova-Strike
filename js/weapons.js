// ---------- weapons.js : weapon definitions ----------
// Base stats; player upgrades apply as multipliers/additions on top.
const WEAPON_DEFS = {
  plasma: {
    key: 'plasma', name: 'USP Taktik-Pistole', sound: 'plasma',
    damage: 18, fireRate: 5, range: 620, mag: 12, reload: 0.9,
    speed: 780, pellets: 1, spread: 0.03, pierce: 0, radius: 5, color: '#ffaa00',
    aoe: 0,
  },
  rifle: {
    key: 'rifle', name: 'M4A1 Sturmgewehr', sound: 'rifle',
    damage: 12, fireRate: 11, range: 640, mag: 32, reload: 1.4,
    speed: 900, pellets: 1, spread: 0.06, pierce: 0, radius: 4, color: '#ffc83b',
    aoe: 0,
  },
  shotgun: {
    key: 'shotgun', name: 'Remington 870 Schrotflinte', sound: 'shotgun',
    damage: 11, fireRate: 1.6, range: 320, mag: 6, reload: 1.6,
    speed: 720, pellets: 8, spread: 0.32, pierce: 0, radius: 4, color: '#ffa252',
    aoe: 0,
  },
  sniper: {
    key: 'sniper', name: 'Barrett .50 Cal Scharfschütze', sound: 'sniper',
    damage: 85, fireRate: 1.1, range: 1400, mag: 5, reload: 2.0,
    speed: 1500, pellets: 1, spread: 0.005, pierce: 4, radius: 5, color: '#ffe680',
    aoe: 0,
  },
  cannon: {
    key: 'cannon', name: 'RPG-7 Raketenwerfer', sound: 'cannon',
    damage: 70, fireRate: 0.8, range: 620, mag: 3, reload: 2.6,
    speed: 560, pellets: 1, spread: 0.02, pierce: 0, radius: 10, color: '#ff4d3b',
    aoe: 90, // explosion radius
  },
  smg: {
    key: 'smg', name: 'MP7 Maschinenpistole', sound: 'rifle',
    damage: 9, fireRate: 17, range: 520, mag: 40, reload: 1.3,
    speed: 880, pellets: 1, spread: 0.10, pierce: 0, radius: 3, color: '#7dff9e',
    aoe: 0,
  },
  flamethrower: {
    key: 'flamethrower', name: 'M9 Flammenwerfer', sound: 'shotgun',
    damage: 5, fireRate: 16, range: 210, mag: 60, reload: 2.2,
    speed: 430, pellets: 2, spread: 0.28, pierce: 2, radius: 7, color: '#ff8a1e',
    aoe: 0, burn: 4,       // applies burning damage-over-time
  },
  tesla: {
    key: 'tesla', name: 'Tesla-Blitzgewehr', sound: 'plasma',
    damage: 20, fireRate: 4.5, range: 560, mag: 14, reload: 1.8,
    speed: 1100, pellets: 1, spread: 0.02, pierce: 0, radius: 5, color: '#4ad9ff',
    aoe: 0, chain: 4,      // lightning jumps to nearby enemies
  },
  cryo: {
    key: 'cryo', name: 'CR-6 Frostwerfer', sound: 'sniper',
    damage: 14, fireRate: 3.5, range: 620, mag: 10, reload: 1.9,
    speed: 900, pellets: 1, spread: 0.03, pierce: 1, radius: 6, color: '#9fe8ff',
    aoe: 0, slow: 1.6,     // slows hit enemies for N seconds
  },
  // two very cheap early-game sidearms — meant as a first affordable upgrade off
  // the starting plasma pistol, well before rifle/shotgun become affordable.
  revolver: {
    key: 'revolver', name: 'Colt Python Revolver', sound: 'sniper',
    damage: 26, fireRate: 2.2, range: 520, mag: 6, reload: 1.1,
    speed: 820, pellets: 1, spread: 0.02, pierce: 1, radius: 5, color: '#ffd27a',
    aoe: 0,
  },
  mac10: {
    key: 'mac10', name: 'MAC-10 Kompakt-SMG', sound: 'rifle',
    damage: 7, fireRate: 9, range: 380, mag: 22, reload: 1.1,
    speed: 780, pellets: 1, spread: 0.12, pierce: 0, radius: 3, color: '#c9ff8a',
    aoe: 0,
  },
};
// Number-key hotbar only covers keys 1-9, so the first 9 entries keep their existing
// bindings unchanged (no muscle-memory regression); the 2 cheap sidearms are appended
// at the end and reachable via mouse wheel cycling or the workbench, same as before
// this list had exactly 9 entries fitting the keyboard 1-for-1.
const WEAPON_ORDER = ['plasma', 'rifle', 'shotgun', 'sniper', 'cannon', 'smg', 'flamethrower', 'tesla', 'cryo', 'revolver', 'mac10'];

// Per-weapon workbench upgrades (bought individually per gun, separate from the
// wave-end free upgrades which apply globally across all weapons).
const WEAPON_UPGRADE_MAX = 3;
const WEAPON_UPGRADE_PRICES = [65, 130, 227]; // cost of level 1, 2, 3 (-19% total)

// Shop metadata (price/icon/description) for weapons purchasable at the workbench.
const WEAPON_SHOP_ITEMS = [
  { key: 'rifle', price: 108, icon: '🔫', desc: 'Mittelstrecken-Automatikgewehr.' },
  { key: 'shotgun', price: 162, icon: '💥', desc: 'Verursacht massiven Nahbereichschaden.' },
  { key: 'sniper', price: 225, icon: '🎯', desc: 'Hoher Einzelschaden, durchdringt Feinde.' },
  { key: 'cannon', price: 360, icon: '🚀', desc: 'Verschießt explosive Raketen mit Flächenschaden.' },
  { key: 'smg', price: 180, icon: '💨', desc: 'Extrem hohe Feuerrate, ideal gegen Schwärme.' },
  { key: 'flamethrower', price: 288, icon: '🔥', desc: 'Kurze Reichweite, setzt Gegner in Brand (Schaden über Zeit).' },
  { key: 'tesla', price: 324, icon: '⚡', desc: 'Blitze springen auf nahe Gegner über.' },
  { key: 'cryo', price: 270, icon: '❄️', desc: 'Verlangsamt getroffene Gegner deutlich.' },
  // cheap early-game options — affordable right after the first wave or two,
  // long before rifle/shotgun money is realistic.
  { key: 'revolver', price: 40, icon: '🔫', desc: 'Günstiger Zweitschlag mit ordentlich Einzelschaden. Perfekt für den frühen Kampf.' },
  { key: 'mac10', price: 55, icon: '💨', desc: 'Billige Kompakt-MP mit hoher Feuerrate für die ersten Wellen.' },
];
