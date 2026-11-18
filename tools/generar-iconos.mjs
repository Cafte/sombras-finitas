// Genera los íconos PNG de la PWA sin dependencias (zlib + CRC propio).
// Uso: node tools/generar-iconos.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTabla = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTabla[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(tipo, datos) {
  const t = Buffer.from(tipo), l = Buffer.alloc(4), c = Buffer.alloc(4);
  l.writeUInt32BE(datos.length); c.writeUInt32BE(crc(Buffer.concat([t, datos])));
  return Buffer.concat([l, t, datos, c]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Dibujo en coordenadas 512x512 (mismo diseño que icono.svg)
const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const BG = hex('#120a0d'), ORO = hex('#d9a94a'), PAN = hex('#27181f'), ROJO = hex('#b4232c'), ROJO2 = hex('#e5545c');
const enPoligono = (x, y, P) => { let d = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d; } return d; };
const cuerpo = []; for (let t = 0; t <= 1; t += 0.05) { const x = (1 - t) ** 2 * 206 + 2 * t * (1 - t) * 276 + t * t * 346, y = (1 - t) ** 2 * 322 + 2 * t * (1 - t) * 212 + t * t * 322; cuerpo.push([x, y]); }
const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

function color(x, y, esc, maskable) {
  // esc: escala del contenido (maskable deja zona segura)
  x = (x - 256) / esc + 256; y = (y - 256) / esc + 256;
  const d = dist(x, y, 276, 256);
  if (d < 34 + 0 && dist(x, y, 276, 222) < 34) return ROJO;
  if (dist(x, y, 276, 222) < 34) return ROJO;
  if (enPoligono(x, y, cuerpo) && y > 222) return ROJO;
  if (y > 238 && y < 274 && x > 40 && x < 108 && Math.abs(y - 256) < 9) return ROJO2;
  if (Math.abs(d - 150) < 8 || Math.abs(d - 120) < 8) return ORO;
  if (d < 120) return PAN;
  return null;
}

function dibujar(n, maskable) {
  const buf = Buffer.alloc(n * n * 4);
  const esc = maskable ? 0.72 : 1, S = 3;
  const r = 104 * n / 512;
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    let R = 0, G = 0, B = 0, A = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const X = ((px + (sx + .5) / S) / n) * 512, Y = ((py + (sy + .5) / S) / n) * 512;
      // esquina redondeada (solo para íconos "any")
      let dentro = true;
      if (!maskable) { const cx = Math.min(Math.max(X, 104), 408), cy = Math.min(Math.max(Y, 104), 408); dentro = dist(X, Y, cx, cy) <= 104; }
      if (!dentro) continue;
      const c = color(X, Y, esc, maskable) ?? BG;
      R += c[0]; G += c[1]; B += c[2]; A += 255;
    }
    const k = S * S, i = (py * n + px) * 4;
    const a = A / k;
    buf[i] = a ? R / (A / 255) : 0; buf[i + 1] = a ? G / (A / 255) : 0; buf[i + 2] = a ? B / (A / 255) : 0; buf[i + 3] = a;
  }
  return png(n, n, buf);
}

writeFileSync(new URL('../icons/icono-192.png', import.meta.url), dibujar(192, false));
writeFileSync(new URL('../icons/icono-512.png', import.meta.url), dibujar(512, false));
writeFileSync(new URL('../icons/icono-maskable-512.png', import.meta.url), dibujar(512, true));
console.log('Íconos generados');
