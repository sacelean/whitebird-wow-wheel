export const CLASSES = [
  { name: 'Druid', color: '#ff7c0a', emoji: '🐻' },
  { name: 'Hunter', color: '#aad372', emoji: '🏹' },
  { name: 'Mage', color: '#3fc7eb', emoji: '🔮' },
  { name: 'Monk', color: '#00ff98', emoji: '🥋' },
  { name: 'Paladin', color: '#f48cba', emoji: '🛡️' },
  { name: 'Priest', color: '#ffffff', emoji: '✨' },
  { name: 'Rogue', color: '#fff468', emoji: '🗡️' },
  { name: 'Shaman', color: '#0070dd', emoji: '⚡' },
  { name: 'Warlock', color: '#8788ee', emoji: '🌀' },
  { name: 'Warrior', color: '#c69b6d', emoji: '⚔️' },
  { name: 'DK', color: '#c41e3a', emoji: '☠️' },
  { name: 'DH', color: '#a330c9', emoji: '👁️' }
];

export const CLASS_BY_NAME = new Map(CLASSES.map((wowClass) => [wowClass.name, wowClass]));
