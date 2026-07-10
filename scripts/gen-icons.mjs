#!/usr/bin/env node
// Generates BuyrWorld PWA app icons as real PNGs — no image libraries, just the
// built-in zlib. Draws a cosy valley (sky + hill + sun) with a supply parcel and
// a green sprout: "build a supply chain in a cosy pixel valley". Run: node scripts/gen-icons.mjs
import zlib from 'zlib';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// ---- tiny PNG encoder (RGBA, 8-bit) ----
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf){ let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data){ const t = Buffer.from(type, 'ascii'); const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const cd = Buffer.concat([t, data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cd), 0); return Buffer.concat([len, cd, crc]); }
function encodePNG(w, h, rgba){
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++){ raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- drawing (supersampled 2× then box-downscaled for smooth edges) ----
const lerp = (a, b, t) => a + (b - a) * t;
function draw(size){
  const S = size * 2;               // supersample
  const buf = Buffer.alloc(S * S * 4);
  const put = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4, ia = a / 255, ib = 1 - ia;
    buf[i]   = Math.round(r * ia + buf[i]   * ib);
    buf[i+1] = Math.round(g * ia + buf[i+1] * ib);
    buf[i+2] = Math.round(b * ia + buf[i+2] * ib);
    buf[i+3] = Math.max(buf[i+3], a);
  };
  const rect = (x0, y0, x1, y1, c) => { for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) put(x, y, c[0], c[1], c[2], c[3] ?? 255); };
  const disc = (cx, cy, rad, c) => { for (let y = Math.round(cy-rad); y <= cy+rad; y++) for (let x = Math.round(cx-rad); x <= cx+rad; x++){ const d = Math.hypot(x-cx, y-cy); if (d <= rad) put(x, y, c[0], c[1], c[2], c[3] ?? 255); } };
  const u = v => v * S;             // fraction → supersampled px

  // sky gradient (top valley-blue → soft green horizon)
  for (let y = 0; y < S; y++){
    const t = y / S;
    const r = lerp(150, 191, t), g = lerp(214, 214, t), b = lerp(238, 150, t);
    for (let x = 0; x < S; x++) put(x, y, r, g, b, 255);
  }
  // warm sun, upper-left
  disc(u(0.30), u(0.28), u(0.11), [255, 224, 130, 235]);
  disc(u(0.30), u(0.28), u(0.15), [255, 224, 130, 70]);
  // rolling hills (two green arcs)
  for (let x = 0; x < S; x++){
    const h1 = u(0.66) + Math.sin(x / S * Math.PI * 1.1) * u(0.05);
    for (let y = Math.round(h1); y < S; y++) put(x, y, 90, 168, 74, 255);
    const h2 = u(0.74) + Math.sin(x / S * Math.PI * 1.6 + 1) * u(0.04);
    for (let y = Math.round(h2); y < S; y++) put(x, y, 70, 146, 58, 255);
  }
  // ---- supply parcel (centred, in the maskable safe zone) ----
  const bx0 = u(0.34), bx1 = u(0.66), by0 = u(0.50), by1 = u(0.76);
  rect(bx0 - u(0.005), by1, bx1 + u(0.005), by1 + u(0.012), [0, 0, 0, 45]);   // shadow
  rect(bx0, by0, bx1, by1, [176, 122, 62, 255]);                              // box front
  rect(bx0, by0, bx1, by0 + u(0.025), [150, 100, 48, 255]);                    // top edge shade
  rect(bx0, by0, bx0 + u(0.02), by1, [196, 142, 78, 255]);                     // lit left edge
  // packing tape (cross)
  rect((bx0 + bx1) / 2 - u(0.018), by0, (bx0 + bx1) / 2 + u(0.018), by1, [232, 216, 176, 255]);
  rect(bx0, (by0 + by1) / 2 - u(0.018), bx1, (by0 + by1) / 2 + u(0.018), [232, 216, 176, 255]);
  // ---- green sprout growing from the parcel ----
  const sx = (bx0 + bx1) / 2, sy = by0;
  rect(sx - u(0.012), sy - u(0.10), sx + u(0.012), sy, [74, 150, 58, 255]);    // stem
  disc(sx - u(0.045), sy - u(0.085), u(0.045), [96, 190, 84, 255]);            // left leaf
  disc(sx + u(0.045), sy - u(0.11),  u(0.045), [110, 206, 96, 255]);           // right leaf
  disc(sx - u(0.045), sy - u(0.085), u(0.018), [140, 224, 120, 255]);
  disc(sx + u(0.045), sy - u(0.11),  u(0.018), [150, 234, 130, 255]);

  // box-downscale 2×→1×
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++){ const i = ((y*2+dy)*S + (x*2+dx)) * 4; r += buf[i]; g += buf[i+1]; b += buf[i+2]; a += buf[i+3]; }
    const o = (y * size + x) * 4; out[o] = r/4; out[o+1] = g/4; out[o+2] = b/4; out[o+3] = a/4;
  }
  return out;
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]){
  writeFileSync(join(OUT, name), encodePNG(size, size, draw(size)));
  console.log('wrote', name, size + 'px');
}
