// ---------- characters.js : selectable soldier skins (camo / visor colors) ----------
// Each character has one small, subtle passive perk applied in Player's constructor
// (see js/player.js, applyCharacterPerk) — intentionally minor so the choice stays a
// flavor pick, not a hard build decision.
//
// Each character also has one signature active ability (Taste C, own cooldown per
// character — see Player.useAbility() in js/player.js). Unlike the passive, this is
// meant to give each character real tactical identity and a build-around moment.
const CHARACTERS = [
  { id: 'woodland', name: 'Waldläufer', icon: '🟢', camo: '#3f4f33', camoStroke: '#1e2417', visor: '#4af626',
    perkDesc: 'Passiv: +6% Lauftempo.',
    ability: { id: 'turret', name: 'Wachtposten', icon: '🛡️', cd: 22, desc: 'Stellt für 12s ein automatisches Geschütz auf, das nahe Gegner beschießt.' } },
  { id: 'desert', name: 'Wüstenfuchs', icon: '🟡', camo: '#8a7a4f', camoStroke: '#4a4128', visor: '#ffcc55',
    perkDesc: 'Passiv: +40 Münzen-Magnetreichweite.',
    ability: { id: 'slowfield', name: 'Adrenalin', icon: '⏱️', cd: 20, desc: 'Verlangsamt alle Gegner in der Nähe für 4s drastisch — du bleibst normal schnell.' } },
  { id: 'arctic', name: 'Frostwolf', icon: '⚪', camo: '#c8d8e0', camoStroke: '#5a7080', visor: '#4ad9ff',
    perkDesc: 'Passiv: -15% Dash-Abklingzeit.',
    ability: { id: 'frostnova', name: 'Frostnova', icon: '❄️', cd: 16, desc: 'Explosionsartige Kälte-Welle: beschädigt und verlangsamt alle Gegner ringsum.' } },
  { id: 'urban', name: 'Schattenläufer', icon: '⚫', camo: '#3a3d40', camoStroke: '#161718', visor: '#ff3b52',
    perkDesc: 'Passiv: +8% kritische Trefferchance.',
    ability: { id: 'shieldburst', name: 'Energie-Stoß', icon: '🔵', cd: 18, desc: 'Lädt dein Schild sofort auf und stößt nahe Gegner mit einer Druckwelle zurück.' } },
  { id: 'crimson', name: 'Blutadler', icon: '🔴', camo: '#5c2020', camoStroke: '#2a0e0e', visor: '#ff8a3b',
    perkDesc: 'Passiv: 5% Chance, bei Kills 5 HP zu heilen.',
    ability: { id: 'bloodrage', name: 'Blutrausch', icon: '🩸', cd: 24, desc: 'Für 6s: mehr Schaden, mehr Feuerrate und Lebensraub bei jedem Treffer.' } },
];
function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
