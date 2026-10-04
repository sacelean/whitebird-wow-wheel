export const CLASSES = [
  { name: 'Druid', color: '#ff7c0a', emoji: '🐻', roles: ['Tanque', 'DPS', 'Sanador'] },
  { name: 'Hunter', color: '#aad372', emoji: '🏹', roles: ['DPS'] },
  { name: 'Mage', color: '#3fc7eb', emoji: '🔮', roles: ['DPS'] },
  { name: 'Monk', color: '#00ff98', emoji: '🥋', roles: ['Tanque', 'DPS', 'Sanador'] },
  { name: 'Paladin', color: '#f48cba', emoji: '🛡️', roles: ['Tanque', 'DPS', 'Sanador'] },
  { name: 'Priest', color: '#ffffff', emoji: '✨', roles: ['DPS', 'Sanador'] },
  { name: 'Rogue', color: '#fff468', emoji: '🗡️', roles: ['DPS'] },
  { name: 'Shaman', color: '#0070dd', emoji: '⚡', roles: ['DPS', 'Sanador'] },
  { name: 'Warlock', color: '#8788ee', emoji: '🌀', roles: ['DPS'] },
  { name: 'Warrior', color: '#c69b6d', emoji: '⚔️', roles: ['Tanque', 'DPS'] },
  { name: 'DK', color: '#c41e3a', emoji: '☠️', roles: ['Tanque', 'DPS'] },
  { name: 'DH', color: '#a330c9', emoji: '👁️', roles: ['Tanque', 'DPS'] },
  { name: 'Evoker', color: '#33937f', emoji: '🐉', roles: ['DPS', 'Sanador'] }
];

export const CLASS_BY_NAME = new Map(CLASSES.map((wowClass) => [wowClass.name, wowClass]));
