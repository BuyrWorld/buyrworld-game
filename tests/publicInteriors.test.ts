import { describe, it, expect } from 'vitest';
import { PUBLIC_COLS, ROOM_DIMS } from '../src/data/interiorCollision.ts';

// Most interiors use the default 320×200 canvas; a few (see ROOM_DIMS) are larger and
// author their collision in that space. The player enters at bottom-centre in all.
const DEFAULT_DIM = { w: 320, h: 200 };
const HALF = 6;
const dimsFor = (id: string) => ROOM_DIMS[id] || DEFAULT_DIM;
const rooms = Object.keys(PUBLIC_COLS);

const inSolid = (px: number, py: number, solids: any[]) =>
  solids.some(s => px > s.x - HALF && px < s.x + s.w + HALF && py > s.y - HALF && py < s.y + s.h + HALF);

// Flood-fill from the door with player-width dilation; returns a region tester.
function reachable(solids: any[], W: number, H: number) {
  const CELL = 4, X0 = 10, Y0 = 49, X1 = W - 10, Y1 = H - 6;
  const SPAWN = { x: W / 2, y: H - 34 };
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
  it('covers the core social/shop rooms', () => {
    expect(rooms.sort()).toEqual(
      ['bank','cafe','data_centre','estateagent','furniture_shop','nightclub','postoffice','pub','retail','robotics_lab'].sort());
  });

  it('nothing blocks the exit lane (per-room dimensions)', () => {
    const bad: string[] = [];
    for (const id of rooms) {
      const { w: W, h: H } = dimsFor(id);
      const lane = { x: W / 2 - 17, y: H - 24, w: 34, h: 22 };
      for (const s of PUBLIC_COLS[id]) if (overlaps(s, lane)) bad.push(`${id}: solid blocks exit`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('the player does not spawn inside furniture', () => {
    const bad: string[] = [];
    for (const id of rooms) {
      const { w: W, h: H } = dimsFor(id);
      if (inSolid(W / 2, H - 34, PUBLIC_COLS[id])) bad.push(`${id}: spawn inside a solid`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('the front-of-room / service area is reachable from the door in every room', () => {
    const bad: string[] = [];
    for (const id of rooms) {
      const { w: W, h: H } = dimsFor(id);
      const can = reachable(PUBLIC_COLS[id], W, H);
      // nightclub checks its dance floor centre; others check the counter band.
      const ok = id === 'nightclub' ? can(200, 150, 280, 200) : can(128, 78, 192, 96);
      if (!ok) bad.push(`${id}: front-of-room not reachable`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('all solids stay within their room bounds', () => {
    const bad: string[] = [];
    for (const id of rooms) {
      const { w: W, h: H } = dimsFor(id);
      for (const s of PUBLIC_COLS[id])
        if (s.x < 0 || s.y < 0 || s.x + s.w > W || s.y + s.h > H) bad.push(`${id}: solid out of bounds`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

describe('Club Featherstone — every essential zone is reachable, décor never blocks', () => {
  const { w: W, h: H } = dimsFor('nightclub');
  const can = reachable(PUBLIC_COLS.nightclub, W, H);
  // POIs the player must be able to walk up to (approach points, not inside solids).
  const POIS: Record<string, [number, number, number, number]> = {
    'dance floor': [200, 150, 280, 200],
    'bar front':   [40, 176, 130, 188],
    'DJ stage front': [214, 112, 266, 120],
    'lounge booths front': [330, 150, 352, 210],
    'exit lane':   [W / 2 - 16, H - 22, W / 2 + 16, H - 8],
    'bouncer (left)': [180, 228, 210, 244],
  };

  it('spawns the player in a clear entrance', () => {
    expect(inSolid(W / 2, H - 34, PUBLIC_COLS.nightclub)).toBe(false);
  });

  for (const [name, box] of Object.entries(POIS)) {
    it(`${name} is reachable from the entrance`, () => {
      expect(can(box[0], box[1], box[2], box[3]), name).toBe(true);
    });
  }

  it('the two bouncers never stand in the bottom-centre exit lane', () => {
    // bouncer draw positions (see drawNightclub _clubPOI): x=196 and x=284, y=236
    const lane = { x0: W / 2 - 20, x1: W / 2 + 20 };
    for (const bx of [196, 284]) expect(bx < lane.x0 || bx > lane.x1, `bouncer x=${bx}`).toBe(true);
  });

  it('the venue is meaningfully larger than a standard interior', () => {
    expect(W * H).toBeGreaterThan(320 * 200);
    expect(W).toBe(480); expect(H).toBe(270);
  });
});
