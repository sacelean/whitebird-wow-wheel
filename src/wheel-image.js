import sharp from 'sharp';
import { CLASSES } from './classes.js';

const SIZE = 720;
const CENTER = SIZE / 2;
const RADIUS = 302;
const polar = (radius, angle) => ({
  x: CENTER + radius * Math.cos(angle),
  y: CENTER + radius * Math.sin(angle)
});

export async function makeWheelImage(remainingNames = CLASSES.map((item) => item.name)) {
  const slice = (Math.PI * 2) / CLASSES.length;
  const paths = CLASSES.map((item, index) => {
    const start = -Math.PI / 2 + index * slice;
    const end = start + slice;
    const a = polar(RADIUS, start);
    const b = polar(RADIUS, end);
    const mid = start + slice / 2;
    const label = polar(205, mid);
    const opacity = remainingNames.includes(item.name) ? 1 : 0.23;
    const textColor = ['#ffffff', '#fff468', '#aad372', '#3fc7eb', '#ffffff'].includes(item.color) ? '#15202b' : '#ffffff';
    return `<path d="M ${CENTER} ${CENTER} L ${a.x} ${a.y} A ${RADIUS} ${RADIUS} 0 0 1 ${b.x} ${b.y} Z" fill="${item.color}" fill-opacity="${opacity}" stroke="#111827" stroke-width="3"/>
      <text x="${label.x}" y="${label.y}" fill="${textColor}" font-family="Arial,sans-serif" font-size="22" font-weight="700" text-anchor="middle" dominant-baseline="middle" transform="rotate(${(mid * 180 / Math.PI) + 90} ${label.x} ${label.y})" opacity="${opacity}">${item.name}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".55"/></filter></defs>
    <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS + 16}" fill="#101722"/>
    <g filter="url(#shadow)">${paths}</g>
    <path d="M ${CENTER - 19} 33 L ${CENTER + 19} 33 L ${CENTER} 91 Z" fill="#f8fafc" stroke="#111827" stroke-width="5"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="47" fill="#111827" stroke="#f8fafc" stroke-width="6"/>
    <text x="${CENTER}" y="${CENTER + 7}" fill="#fff" font-family="Arial,sans-serif" font-size="23" font-weight="800" text-anchor="middle">WB</text>
    <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="none" stroke="#f8fafc" stroke-width="7"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
