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
  // fills the price gap between the cheap sidearms (40/55) and the rifle (108) —
  // a genuine mid-tier step up, not just a reskin of what's already there.
  carbine: {
    key: 'carbine', name: 'Vektor-Kompaktkarabiner', sound: 'rifle',
    damage: 14, fireRate: 7, range: 560, mag: 20, reload: 1.2,
    speed: 900, pellets: 1, spread: 0.05, pierce: 0, radius: 4, color: '#b8e6ff',
    aoe: 0,
  },
  sawedoff: {
    key: 'sawedoff', name: 'Sawed-Off Doppelflinte', sound: 'shotgun',
    damage: 13, fireRate: 1.9, range: 260, mag: 2, reload: 1.3,
    speed: 700, pellets: 6, spread: 0.4, pierce: 0, radius: 4, color: '#ff7a52',
    aoe: 0,
  },
};
// Number-key hotbar only covers keys 1-9, so the first 9 entries keep their existing
// bindings unchanged (no muscle-memory regression); the 2 cheap sidearms are appended
// at the end and reachable via mouse wheel cycling or the workbench, same as before
// this list had exactly 9 entries fitting the keyboard 1-for-1.
const WEAPON_ORDER = ['plasma', 'rifle', 'shotgun', 'sniper', 'cannon', 'smg', 'flamethrower', 'tesla', 'cryo', 'revolver', 'mac10', 'carbine', 'sawedoff'];

// Muzzle-flash / recoil intensity per weapon, so each gun feels physically
// distinct when fired (see Player.shoot()). 1 = baseline rifle-ish kick.
const MUZZLE_PUNCH = {
  plasma: 0.85, rifle: 1.0, smg: 0.7, mac10: 0.7, carbine: 0.95,
  revolver: 1.15, shotgun: 1.5, sawedoff: 1.6, sniper: 1.7, cannon: 2.2,
  flamethrower: 0.6, tesla: 0.9, cryo: 0.8,
};

// Per-weapon workbench upgrades (bought individually per gun, separate from the
// wave-end free upgrades which apply globally across all weapons).
const WEAPON_UPGRADE_MAX = 3;
// cost of level 1, 2, 3 — trimmed down and x10'd to match the new coin economy
// (coins are worth 10 each, weapon purchase prices are x10'd too), same
// affordability principle as WEAPON_SHOP_ITEMS above.
const WEAPON_UPGRADE_PRICES = [450, 900, 1600];

// Shop metadata (price/icon/description) for weapons purchasable at the workbench.
// Ordered cheapest-first so the shop lists affordable early-game options up top.
// Prices are x10 to match coins now being worth 10 each instead of 1 — same
// relative affordability, just bigger numbers.
// `category` groups weapons in the workbench UI (see ui.js showWorkbench) —
// purely a display grouping, has no effect on stats/behavior.
const WEAPON_CATEGORIES = {
  sidearm: '🔫 Sekundärwaffen',
  smg: '💨 Maschinenpistolen',
  rifle: '🎯 Sturmgewehre',
  shotgun: '💥 Schrotflinten',
  sniper: '🎯 Scharfschützengewehre',
  heavy: '🚀 Schwere Waffen',
  elemental: '⚡ Elementarwaffen',
};

const WEAPON_SHOP_ITEMS = [
  { key: 'revolver', price: 300, icon: '🔫', category: 'sidearm', desc: 'Günstiger Zweitschlag mit ordentlich Einzelschaden. Perfekt für den frühen Kampf.' },
  { key: 'mac10', price: 450, icon: '💨', category: 'smg', desc: 'Billige Kompakt-MP mit hoher Feuerrate für die ersten Wellen.' },
  { key: 'carbine', price: 600, icon: '🔫', category: 'rifle', desc: 'Präziser Kompaktkarabinier mit gutem Ausgleich aus Schaden, Reichweite und Feuerrate.' },
  { key: 'sawedoff', price: 700, icon: '💥', category: 'shotgun', desc: 'Doppelläufige Sawed-Off — verheerend auf kurze Distanz, aber nur 2 Schuss im Magazin.' },
  { key: 'rifle', price: 850, icon: '🔫', category: 'rifle', desc: 'Mittelstrecken-Automatikgewehr.' },
  { key: 'smg', price: 1200, icon: '💨', category: 'smg', desc: 'Extrem hohe Feuerrate, ideal gegen Schwärme.' },
  { key: 'shotgun', price: 1350, icon: '💥', category: 'shotgun', desc: 'Verursacht massiven Nahbereichschaden.' },
  { key: 'sniper', price: 1600, icon: '🎯', category: 'sniper', desc: 'Hoher Einzelschaden, durchdringt Feinde.' },
  { key: 'cryo', price: 1750, icon: '❄️', category: 'elemental', desc: 'Verlangsamt getroffene Gegner deutlich.' },
  { key: 'flamethrower', price: 1900, icon: '🔥', category: 'elemental', desc: 'Kurze Reichweite, setzt Gegner in Brand (Schaden über Zeit).' },
  { key: 'tesla', price: 2150, icon: '⚡', category: 'elemental', desc: 'Blitze springen auf nahe Gegner über.' },
  { key: 'cannon', price: 2600, icon: '🚀', category: 'heavy', desc: 'Verschießt explosive Raketen mit Flächenschaden.' },
];
