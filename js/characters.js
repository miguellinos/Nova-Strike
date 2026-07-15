// ---------- characters.js : selectable soldier skins (camo / visor colors) ----------
// Each character has one small, subtle passive perk applied in Player's constructor
// (see js/player.js, applyCharacterPerk) — intentionally minor so the choice stays a
// flavor pick, not a hard build decision.
const CHARACTERS = [
  { id: 'woodland', name: 'Waldläufer', icon: '🟢', camo: '#3f4f33', camoStroke: '#1e2417', visor: '#4af626',
    perkDesc: 'Passiv: +6% Lauftempo.' },
  { id: 'desert', name: 'Wüstenfuchs', icon: '🟡', camo: '#8a7a4f', camoStroke: '#4a4128', visor: '#ffcc55',
    perkDesc: 'Passiv: +40 Münzen-Magnetreichweite.' },
  { id: 'arctic', name: 'Frostwolf', icon: '⚪', camo: '#c8d8e0', camoStroke: '#5a7080', visor: '#4ad9ff',
    perkDesc: 'Passiv: -15% Dash-Abklingzeit.' },
  { id: 'urban', name: 'Schattenläufer', icon: '⚫', camo: '#3a3d40', camoStroke: '#161718', visor: '#ff3b52',
    perkDesc: 'Passiv: +8% kritische Trefferchance.' },
  { id: 'crimson', name: 'Blutadler', icon: '🔴', camo: '#5c2020', camoStroke: '#2a0e0e', visor: '#ff8a3b',
    perkDesc: 'Passiv: 5% Chance, bei Kills 5 HP zu heilen.' },
];
function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
