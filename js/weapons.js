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
};
const WEAPON_ORDER = ['plasma', 'rifle', 'shotgun', 'sniper', 'cannon'];
