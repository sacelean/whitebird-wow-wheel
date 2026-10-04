import sharp from 'sharp';
import { CLASSES } from './classes.js';

const SIZE = 720;
const CENTER = SIZE / 2;
const RADIUS = 302;
const FONT = {
  A: '01110/10001/10001/11111/10001/10001/10001', B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01111/10000/10000/10000/10000/10000/01111', D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111', G: '01111/10000/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001', I: '11111/00100/00100/00100/00100/00100/11111',
  K: '10001/10010/10100/11000/10100/10010/10001', L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001', N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110', P: '11110/10001/10001/11110/10000/10000/10000',
  R: '11110/10001/10001/11110/10100/10010/10001', S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100', U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/01010/01010/00100',
  W: '10001/10001/10001/10101/10101/10101/01010', Y: '10001/10001/01010/00100/00100/00100/00100'
};

function pixelText(text, cell, gap, color) {
  const glyphWidth = cell * 5;
  const pitch = glyphWidth + gap;
  const width = text.length * pitch - gap;
  const rects = [];
  [...text].forEach((character, characterIndex) => {
    const bitmap = FONT[character];
    if (!bitmap) return;
    bitmap.split('/').forEach((row, rowIndex) => [...row].forEach((pixel, columnIndex) => {
      if (pixel === '1') rects.push(`<rect x="${characterIndex * pitch + columnIndex * cell}" y="${rowIndex * cell}" width="${cell}" height="${cell}"/>`);
    }));
  });
  return `<g fill="${color}" transform="translate(${-width / 2} ${-(cell * 7) / 2})">${rects.join('')}</g>`;
}

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
    const label = polar(207, mid);
    const opacity = remainingNames.includes(item.name) ? 1 : 0.23;
    const textColor = ['#ffffff', '#fff468', '#aad372', '#3fc7eb', '#00ff98'].includes(item.color) ? '#15202b' : '#ffffff';
    return `<path d="M ${CENTER} ${CENTER} L ${a.x} ${a.y} A ${RADIUS} ${RADIUS} 0 0 1 ${b.x} ${b.y} Z" fill="${item.color}" fill-opacity="${opacity}" stroke="#111827" stroke-width="3"/>
      <g transform="translate(${label.x} ${label.y}) rotate(${(mid * 180 / Math.PI) + 90})" opacity="${opacity}">${pixelText(item.name.toUpperCase(), 2.4, 1.3, textColor)}</g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".55"/></filter></defs>
    <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS + 16}" fill="#101722"/>
    <g filter="url(#shadow)">${paths}</g>
    <path d="M ${CENTER - 19} 33 L ${CENTER + 19} 33 L ${CENTER} 91 Z" fill="#f8fafc" stroke="#111827" stroke-width="5"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="47" fill="#111827" stroke="#f8fafc" stroke-width="6"/>
    <g transform="translate(${CENTER} ${CENTER})">${pixelText('WB', 4, 2, '#fff')}</g>
    <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="none" stroke="#f8fafc" stroke-width="7"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
