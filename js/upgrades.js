// ---------- upgrades.js : upgrade definitions & effects ----------
const UPGRADES = [
  { id: 'damage', name: 'Stärkere Projektile', icon: '💥', desc: '+20% Waffenschaden', price: 50, repeatable: true,
    apply: (p) => { p.mods.damage += 0.20; } },
  { id: 'firerate', name: 'Schnellfeuer', icon: '🔥', desc: '+15% Feuerrate', price: 60, repeatable: true,
    apply: (p) => { p.mods.fireRate += 0.15; } },
  { id: 'move', name: 'Schnelle Bewegung', icon: '⚡', desc: '+15% Bewegungstempo', price: 40, repeatable: true,
    apply: (p) => { p.mods.move += 0.15; } },
  { id: 'hp', name: 'Mehr Gesundheit', icon: '❤️', desc: '+25 max. Lebenspunkte', price: 70, repeatable: true,
    apply: (p) => { p.maxHp += 25; p.heal(25); } },
  { id: 'reload', name: 'Schnelles Nachladen', icon: '🔄', desc: '-20% Nachladezeit', price: 50, repeatable: true,
    apply: (p) => { p.mods.reload = Math.max(0.2, p.mods.reload * 0.8); } },
  { id: 'mag', name: 'Größeres Magazin', icon: '📦', desc: '+30% Magazingröße', price: 60, repeatable: true,
    apply: (p) => { p.mods.mag += 0.30; } },
  { id: 'pierce', name: 'Durchschlag', icon: '🎯', desc: 'Projektile durchdringen +1 Gegner', price: 100, repeatable: true,
    apply: (p) => { p.mods.pierce += 1; } },
  { id: 'crit', name: 'Kritischer Treffer', icon: '✴️', desc: '+15% Chance auf doppelten Schaden', price: 100, repeatable: true,
    apply: (p) => { p.mods.crit = Math.min(0.75, p.mods.crit + 0.15); } },
  { id: 'dash', name: 'Schneller Dash', icon: '💨', desc: '-20% Dash-Abklingzeit', price: 75, repeatable: true,
    apply: (p) => { p.mods.dashCd = Math.max(0.3, p.mods.dashCd * 0.8); } },
  { id: 'lifesteal', name: 'Lebensraub', icon: '🩸', desc: '+15% Chance auf Heilung bei Kill', price: 150, repeatable: true,
    apply: (p) => { p.mods.lifesteal = Math.min(0.9, p.mods.lifesteal + 0.15); } },
  { id: 'magnet', name: 'Münzmagnet', icon: '🧲', desc: 'Größere Münz-Anziehung', price: 80, repeatable: true,
    apply: (p) => { p.mods.coinRange += 90; } },
  { id: 'coins', name: 'Mehr Münzen', icon: '🪙', desc: '+25% Münz-Drops', price: 120, repeatable: true,
    apply: (p) => { p.mods.coinMult += 0.25; } },
];

function rollShopUpgrades() {
  const pool = UPGRADES.slice();
  const picks = [];
  while (picks.length < 3 && pool.length) {
    const i = Utils.randInt(0, pool.length - 1);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
}
