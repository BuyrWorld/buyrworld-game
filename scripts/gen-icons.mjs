#!/usr/bin/env node
// Generates BuyrWorld PWA / favicon / Apple-touch / Electron app icons by resizing
// the source artwork at build/app-icon.png. Self-contained: pure Node + zlib (no
// image libraries). PNG decode → high-quality area (box) downscale → PNG encode.
// Maskable variants add safe padding so masks never clip the badge.
//   Run: node scripts/gen-icons.mjs
import zlib from 'zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'build', 'app-icon.png');
const ICONS_DIR = join(ROOT, 'public', 'icons');
mkdirSync(ICONS_DIR, { recursive: true });

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
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;   // 8-bit RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- PNG decoder (8-bit, colour types 2/RGB and 6/RGBA, non-interlaced) → RGBA ----
function decodePNG(buf){
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, colorType = 6, bitDepth = 8; const idat = [];
  while (off < buf.length){
    const len = buf.readUInt32BE(off); const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR'){ w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; if (data[12] !== 0) throw new Error('interlaced PNG not supported'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`unsupported PNG (depth ${bitDepth}, colour ${colorType})`);
  const channels = colorType === 6 ? 4 : 3, bpp = channels, stride = w * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const cur = Buffer.alloc(stride); const prev = Buffer.alloc(stride); const out = Buffer.alloc(w * h * 4);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  let p = 0;
  for (let y = 0; y < h; y++){
    const filter = raw[p++];
    for (let i = 0; i < stride; i++){
      const x = raw[p++];
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v;
      switch (filter){ case 0: v = x; break; case 1: v = x + a; break; case 2: v = x + b; break; case 3: v = x + ((a + b) >> 1); break; case 4: v = x + paeth(a, b, c); break; default: throw new Error('bad filter ' + filter); }
      cur[i] = v & 0xff;
    }
    for (let x = 0; x < w; x++){
      const si = x * channels, di = (y * w + x) * 4;
      out[di] = cur[si]; out[di + 1] = cur[si + 1]; out[di + 2] = cur[si + 2];
      out[di + 3] = channels === 4 ? cur[si + 3] : 255;
    }
    cur.copy(prev);
  }
  return { w, h, rgba: out };
}

// ---- high-quality area (box) resample with fractional edge weights ----
function resize(src, sw, sh, dw, dh){
  const acc = new Float64Array(dw * dh * 4);
  const sxr = sw / dw, syr = sh / dh;
  for (let dy = 0; dy < dh; dy++){
    const y0 = dy * syr, y1 = (dy + 1) * syr;
    for (let dx = 0; dx < dw; dx++){
      const x0 = dx * sxr, x1 = (dx + 1) * sxr;
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++){
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++){
          const wx = Math.min(x1, xx + 1) - Math.max(x0, xx);
          const w = wx * wy; if (w <= 0) continue;
          const i = (yy * sw + xx) * 4;
          r += src[i] * w; g += src[i + 1] * w; b += src[i + 2] * w; a += src[i + 3] * w; wsum += w;
        }
      }
      const di = (dy * dw + dx) * 4;
      acc[di] = r / wsum; acc[di + 1] = g / wsum; acc[di + 2] = b / wsum; acc[di + 3] = a / wsum;
    }
  }
  const out = Buffer.alloc(dw * dh * 4);
  for (let i = 0; i < acc.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(acc[i])));
  return out;
}

// Composite a smaller RGBA image centred onto a solid-colour square (for maskable padding).
function padOnto(size, inner, innerRgba, bg){
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++){ out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 255; }
  const o = Math.round((size - inner) / 2);
  for (let y = 0; y < inner; y++) for (let x = 0; x < inner; x++){
    const s = (y * inner + x) * 4, d = ((y + o) * size + (x + o)) * 4;
    const a = innerRgba[s + 3] / 255, ib = 1 - a;
    out[d]     = Math.round(innerRgba[s]     * a + out[d]     * ib);
    out[d + 1] = Math.round(innerRgba[s + 1] * a + out[d + 1] * ib);
    out[d + 2] = Math.round(innerRgba[s + 2] * a + out[d + 2] * ib);
    out[d + 3] = 255;
  }
  return out;
}

// Sample an average background colour from the source corners (for maskable fill).
function cornerColour(src, sw, sh){
  let r = 0, g = 0, b = 0, n = 0; const k = Math.max(4, Math.floor(Math.min(sw, sh) * 0.02));
  const add = (x, y) => { const i = (y * sw + x) * 4; r += src[i]; g += src[i + 1]; b += src[i + 2]; n++; };
  for (let y = 0; y < k; y++) for (let x = 0; x < k; x++){ add(x, y); add(sw - 1 - x, y); add(x, sh - 1 - y); add(sw - 1 - x, sh - 1 - y); }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

// ---- generate ----
const { w: SW, h: SH, rgba: SRC_RGBA } = decodePNG(readFileSync(SRC));
const bg = cornerColour(SRC_RGBA, SW, SH);
console.log(`source ${SW}x${SH}, maskable bg rgb(${bg.join(',')})`);

const ANY_SIZES = [16, 32, 48, 64, 72, 96, 128, 144, 180, 192, 256, 384, 512];
for (const s of ANY_SIZES){
  writeFileSync(join(ICONS_DIR, `icon-${s}.png`), encodePNG(s, s, resize(SRC_RGBA, SW, SH, s, s)));
}
// Maskable 192 & 512 — badge scaled to 78% inside a solid-colour safe field.
for (const s of [192, 512]){
  const inner = Math.round(s * 0.78);
  const innerRgba = resize(SRC_RGBA, SW, SH, inner, inner);
  writeFileSync(join(ICONS_DIR, `icon-${s}-maskable.png`), encodePNG(s, s, padOnto(s, inner, innerRgba, bg)));
}
// Root Apple-touch icon (iOS default location) — 180, on a solid field (iOS ignores alpha).
const at = Math.round(180 * 0.94);
writeFileSync(join(ROOT, 'public', 'apple-touch-icon.png'), encodePNG(180, 180, padOnto(180, at, resize(SRC_RGBA, SW, SH, at, at), bg)));
// Electron desktop app icon (build/icon.png) — 512.
writeFileSync(join(ROOT, 'build', 'icon.png'), encodePNG(512, 512, resize(SRC_RGBA, SW, SH, 512, 512)));

console.log(`Wrote ${ANY_SIZES.length} icons + 2 maskable to public/icons/, public/apple-touch-icon.png (180), build/icon.png (512).`);
