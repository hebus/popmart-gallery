// Génère les icônes de l'appli (PWA) sans dépendance : node scripts/make-icons.mjs
// Dessin géométrique simple (tête ronde, deux oreilles, deux yeux) ; à remplacer plus tard par un vrai logo.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const INK = [0x1d, 0x1b, 0x19], CREAM = [0xfa, 0xf7, 0xf2], RED = [0xe6, 0x00, 0x12];

// Formes en coordonnées normalisées [0,1], dessinées dans l'ordre (tout reste dans la zone sûre « maskable » : rayon 0,4 autour du centre)
const SHAPES = [
  { cx: 0.34, cy: 0.30, r: 0.09, color: CREAM },
  { cx: 0.66, cy: 0.30, r: 0.09, color: CREAM },
  { cx: 0.5, cy: 0.54, r: 0.26, color: CREAM },
  { cx: 0.43, cy: 0.52, r: 0.032, color: INK },
  { cx: 0.57, cy: 0.52, r: 0.032, color: INK },
  { cx: 0.5, cy: 0.62, r: 0.022, color: RED },
];

// fond : plein (maskable, apple-touch) ou carré arrondi à coins transparents (icônes « any »)
function render(size, rounded) {
  const px = Buffer.alloc(size * size * 4);
  const SS = 4, radius = 0.22;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = (x + (sx + 0.5) / SS) / size, v = (y + (sy + 0.5) / SS) / size;
      let inside = true;
      if (rounded) {
        const dx = Math.max(Math.abs(u - 0.5) - (0.5 - radius), 0), dy = Math.max(Math.abs(v - 0.5) - (0.5 - radius), 0);
        inside = dx * dx + dy * dy <= radius * radius;
      }
      if (!inside) continue;
      let c = INK;
      for (const s of SHAPES) if ((u - s.cx) ** 2 + (v - s.cy) ** 2 <= s.r * s.r) c = s.color;
      r += c[0]; g += c[1]; b += c[2]; a += 255;
    }
    const n = SS * SS, i = (y * size + x) * 4;
    px[i] = a ? Math.round(r / (a / 255)) : 0;
    px[i + 1] = a ? Math.round(g / (a / 255)) : 0;
    px[i + 2] = a ? Math.round(b / (a / 255)) : 0;
    px[i + 3] = Math.round(a / n);
  }
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
  ['icon-maskable-512.png', 512, false],
  ['apple-touch-icon.png', 180, false],
];
for (const [name, size, rounded] of files) { writeFileSync(join(OUT, name), png(size, render(size, rounded))); console.log('écrit', name, size + 'x' + size); }

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${Math.round(512 * 0.22)}" fill="${hex(INK)}"/>`
  + SHAPES.map((s) => `<circle cx="${+(s.cx * 512).toFixed(1)}" cy="${+(s.cy * 512).toFixed(1)}" r="${+(s.r * 512).toFixed(1)}" fill="${hex(s.color)}"/>`).join('') + '</svg>\n';
writeFileSync(join(OUT, 'icon.svg'), svg);
console.log('écrit icon.svg');
