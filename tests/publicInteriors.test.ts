import { describe, it, expect } from 'vitest';
import { PUBLIC_COLS } from '../src/data/interiorCollision.ts';

// Interior canvas is 320x200; the player enters at bottom-centre.
const W = 320, H = 200, HALF = 6;
const SPAWN = { x: W / 2, y: H - 34 };            // IP spawn on entering an interior
const rooms = Object.keys(PUBLIC_COLS);

const inSolid = (px: number, py: number, solids: any[]) =>
  solids.some(s => px > s.x - HALF && px < s.x + s.w + HALF && py > s.y - HALF && py < s.y + s.h + HALF);

// Flood-fill from the door with player-width dilation; returns a region tester.
function reachable(solids: any[]) {
  const CELL = 4, X0 = 10, Y0 = 49, X1 = W - 10, Y1 = H - 6;
  const cols = Math.ceil((X1 - X0) / CELL), rows = Math.ceil((Y1 - Y0) / CELL);
  const idx = (c: number, r: number) => r * cols + c;
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const px = X0 + c * CELL + 2, py = Y0 + r * CELL + 2;
    blocked[idx(c, r)] = inSolid(px, py, solids) ? 1 : 0;
  }
  const sc = Math.floor((SPAWN.x - X0) / CELL), sr = Math.floor((SPAWN.y - Y0) / CELL);
  const seen = new Uint8Array(cols * rows);
  const stack = [[sc, sr]]; seen[idx(sc, sr)] = 1;
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
  return (rx0: number, ry0: number, rx1: number, ry1: number) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!seen[idx(c, r)]) continue;
      const px = X0 + c * CELL + 2, py = Y0 + r * CELL + 2;
      if (px >= rx0 && px <= rx1 && py >= ry0 && py <= ry1) return true;
    }
    return false;
  };
}

const overlaps = (a: any, b: any) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('HX4 public interiors — collision walkability', () => {
  it('covers the 7 core social/shop rooms', () => {
    expect(rooms.sort()).toEqual(
      ['bank','cafe','estateagent','furniture_shop','postoffice','pub','retail'].sort());
  });

  it('nothing blocks the exit lane', () => {
    const lane = { x: 144, y: 176, w: 34, h: 22 };
    const bad: string[] = [];
    for (const id of rooms) for (const s of PUBLIC_COLS[id])
      if (overlaps(s, lane)) bad.push(`${id}: solid blocks exit`);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('the player does not spawn inside furniture', () => {
    const bad: string[] = [];
    for (const id of rooms)
      if (inSolid(SPAWN.x, SPAWN.y, PUBLIC_COLS[id])) bad.push(`${id}: spawn inside a solid`);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('the service counter is reachable from the door in every room', () => {
    const bad: string[] = [];
    for (const id of rooms) {
      const can = reachable(PUBLIC_COLS[id]);
      if (!can(128, 78, 192, 96)) bad.push(`${id}: counter/front-of-room not reachable`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('all solids stay within the room bounds', () => {
    const bad: string[] = [];
    for (const id of rooms) for (const s of PUBLIC_COLS[id])
      if (s.x < 0 || s.y < 0 || s.x + s.w > W || s.y + s.h > H) bad.push(`${id}: solid out of bounds`);
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
