import { describe, it, expect } from 'vitest';
import { HOME_INTERIORS, BED_CONFIG, buildLayout, homeCollisionRects } from '../src/data/homeInteriors.ts';

// Interior canvas is 320x200 (INT_W/INT_H in main.ts).
const W = 320, H = 200;
const homes = Object.keys(HOME_INTERIORS);

// Player half-width used by the interior collision push-out in main.ts.
const HALF = 6;

// Flood-fill walkability: a cell is walkable only if a HALF-inflated box around
// its centre clears every solid — this models the real player footprint, so a gap
// narrower than the player reads as blocked.
function reachable(solids: {x:number;y:number;w:number;h:number}[]) {
  const CELL = 4;
  const X0 = 10, Y0 = 49, X1 = W - 10, Y1 = H - 6; // interior walkable bounds
  const cols = Math.ceil((X1 - X0) / CELL), rows = Math.ceil((Y1 - Y0) / CELL);
  const solid = (px: number, py: number) =>
    solids.some(s => px > s.x - HALF && px < s.x + s.w + HALF && py > s.y - HALF && py < s.y + s.h + HALF);
  const idx = (c: number, r: number) => r * cols + c;
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const px = X0 + c * CELL + CELL / 2, py = Y0 + r * CELL + CELL / 2;
    blocked[idx(c, r)] = solid(px, py) ? 1 : 0;
  }
  // start at the door (bottom centre)
  const sc = Math.floor((W / 2 - X0) / CELL), sr = Math.floor((H - 12 - Y0) / CELL);
  const seen = new Uint8Array(cols * rows);
  const stack = [[sc, sr]];
  seen[idx(sc, sr)] = 1;
  while (stack.length) {
    const [c, r] = stack.pop()!;
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = idx(nc, nr);
      if (seen[ni] || blocked[ni]) continue;
      seen[ni] = 1; stack.push([nc, nr]);
    }
  }
  // does any reachable free cell fall inside region [rx0,ry0]-[rx1,ry1]?
  return (rx0: number, ry0: number, rx1: number, ry1: number) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!seen[idx(c, r)]) continue;
      const px = X0 + c * CELL + CELL / 2, py = Y0 + r * CELL + CELL / 2;
      if (px >= rx0 && px <= rx1 && py >= ry0 && py <= ry1) return true;
    }
    return false;
  };
}

const overlaps = (a: any, b: any) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('HX3 home interiors — zones, walls & circulation', () => {
  it('covers all 17 villager homes', () => {
    expect(homes.length).toBe(17);
  });

  it('every home has the core zones (kitchen, dining, living, sleeping, entrance)', () => {
    const bad: string[] = [];
    for (const id of homes) {
      const L = buildLayout(HOME_INTERIORS[id], id, W, H);
      const keys = new Set(L.placements.map((p: any) => p.k));
      for (const need of ['kitchen_run', 'living_set', 'bedside', 'entry_mat']) {
        if (!keys.has(need)) bad.push(`${id}: missing ${need}`);
      }
      if (!keys.has('dining_set') && !keys.has('dining_big')) bad.push(`${id}: missing dining`);
      // a rug + a kitchen floor patch = at least 3 zone floors
      if (L.floors.length < 3) bad.push(`${id}: too few zone floors`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('nothing blocks the door / exit mat lane', () => {
    const lane = { x: 144, y: 176, w: 34, h: 22 };
    const bad: string[] = [];
    for (const id of homes) {
      for (const s of homeCollisionRects(id, W, H)) {
        if (overlaps(s, lane)) bad.push(`${id}: a solid blocks the exit lane`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('the kitchen and living zones are reachable from the door in every home', () => {
    const bad: string[] = [];
    for (const id of homes) {
      const can = reachable(homeCollisionRects(id, W, H));
      if (!can(46, 82, 116, 100)) bad.push(`${id}: kitchen zone not reachable`);
      if (!can(150, 152, 210, 180)) bad.push(`${id}: living zone not reachable`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('the bed is reachable in homes without children (crowded family bedrooms exempt)', () => {
    const bad: string[] = [];
    for (const id of homes) {
      if ((BED_CONFIG[id]?.k ?? 0) > 0) continue;
      const bW = BED_CONFIG[id]?.d ? 72 : 50, bX = W - bW - 10;
      const can = reachable(homeCollisionRects(id, W, H));
      if (!can(bX - 2, 100, bX + bW, 130)) bad.push(`${id}: bed not reachable`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('no two collision solids overlap (structural furniture never collides)', () => {
    const bad: string[] = [];
    for (const id of homes) {
      const s = homeCollisionRects(id, W, H);
      for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
        const a = s[i], b = s[j];
        const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ix > 2 && iy > 2) bad.push(`${id}: solids overlap @(${a.x},${a.y})×(${b.x},${b.y})`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('all collision solids stay within the room bounds', () => {
    const bad: string[] = [];
    for (const id of homes) {
      for (const s of homeCollisionRects(id, W, H)) {
        if (s.x < 0 || s.y < 44 || s.x + s.w > W || s.y + s.h > H) bad.push(`${id}: solid out of bounds`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
