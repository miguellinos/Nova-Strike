// ---------- characters.js : selectable soldier skins (camo / visor colors) ----------
const CHARACTERS = [
  { id: 'woodland', name: 'Waldläufer', icon: '🟢', camo: '#3f4f33', camoStroke: '#1e2417', visor: '#4af626' },
  { id: 'desert', name: 'Wüstenfuchs', icon: '🟡', camo: '#8a7a4f', camoStroke: '#4a4128', visor: '#ffcc55' },
  { id: 'arctic', name: 'Frostwolf', icon: '⚪', camo: '#c8d8e0', camoStroke: '#5a7080', visor: '#4ad9ff' },
  { id: 'urban', name: 'Schattenläufer', icon: '⚫', camo: '#3a3d40', camoStroke: '#161718', visor: '#ff3b52' },
  { id: 'crimson', name: 'Blutadler', icon: '🔴', camo: '#5c2020', camoStroke: '#2a0e0e', visor: '#ff8a3b' },
];
function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
