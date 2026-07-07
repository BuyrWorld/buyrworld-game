import { describe, it, expect } from 'vitest';
import { HOME_INTERIORS } from '../src/data/homeInteriors.ts';

// Interior canvas is 320x200 (INT_W/INT_H in main.ts).
const W = 320, H = 200;

// Bed config per home (d = double, k = children's beds) — mirrors _bConf in main.ts.
const BEDS: Record<string, [number, number]> = {
  home_01: [1, 0], home_02: [1, 0], home_03: [1, 2], home_04: [1, 0], home_05: [0, 0],
  home_06: [1, 1], home_07: [1, 0], home_08: [0, 0], home_09: [1, 0], home_10: [1, 0],
  home_11: [0, 0], home_12: [1, 2], home_13: [1, 1], home_14: [1, 1], home_15: [1, 0],
  home_16: [0, 0], home_17: [0, 0],
};

// Left-wall tall units grow from their anchor down to the floor (H-14).
const TALL = new Set(['wardrobe', 'filing_cabinet', 'display_case', 'metal_shelf', 'sea_cabinet', 'egg_dresser']);

// Drawn footprint per prop key, relative to its anchor: [ox, oy, w, h].
// Values trace the rects/emoji extents in _homeProp() (generous where emoji overhang).
const FP: Record<string, [number, number, number, number]> = {
  'tile:bookshelf': [0, 0, 32, 64], 'tile:plant': [0, 0, 32, 64], 'tile:fireplace': [0, 0, 64, 64],
  'tile:table': [0, 0, 64, 64], 'tile:cabinet': [0, 0, 32, 64], 'tile:sofa': [0, 0, 96, 32],
  tool_chest: [0, 0, 30, 16], kitchen_counter: [0, -8, 96, 24], workbench: [0, -8, 90, 24],
  tea_shelf: [0, -9, 56, 14], framed_certs: [0, 0, 46, 15], wall_photos: [0, 0, 52, 17],
  tool_hooks: [-4, -6, 64, 21], axe_wall: [-2, -6, 58, 21], hanging_net: [-10, -10, 72, 22],
  nav_chart: [0, 0, 44, 28], route_board: [0, 0, 34, 28], pinned_manifests: [0, 0, 50, 20],
  bunting: [0, 0, 112, 9], rosettes: [-2, -6, 30, 25], herb_bunches: [0, -6, 48, 12], knife_rack: [0, 0, 44, 18],
  armchair: [-3, -6, 26, 26], single_chair: [-3, -6, 26, 26], reading_chair: [-3, -6, 26, 26], rocking_chair: [-3, -6, 26, 28],
  writing_desk: [0, -2, 42, 20], tea_table: [0, -8, 24, 16], cake_stand: [0, -4, 16, 18],
  kids_toys: [0, -6, 43, 12], toy_lorry: [0, 0, 24, 17], crate_stack: [0, 0, 34, 30],
  timber_stack: [-1, 0, 44, 18], wood_crafts: [0, -6, 40, 12], gears_project: [0, -6, 40, 16],
  kettle_stove: [0, -8, 26, 18], kettle_mug: [0, -6, 26, 12], ember_apron: [0, -3, 36, 23], boots: [0, 6, 18, 10],
  preserve_shelf: [0, -9, 50, 14], medal_case: [0, 0, 34, 16], stacked_files: [0, -6, 18, 15],
  tackle_box: [0, -4, 22, 18], bucket: [0, 0, 14, 14], oilskins: [0, -3, 14, 25], flower_jar: [0, -6, 14, 18],
  flower_pots: [0, -10, 28, 20], feed_sacks: [0, 0, 28, 20], animal_basket: [-2, 0, 28, 15],
  sea_chest: [0, 0, 30, 20], model_boat: [0, -6, 20, 19], lantern: [0, 0, 14, 16], scales: [0, 0, 20, 13], ice_box: [0, 0, 26, 20],
};

type Box = { x0: number; y0: number; x1: number; y1: number };
const propBox = (k: string, fx: number, fy: number): Box => {
  const ax = Math.round(fx * W), ay = Math.round(fy * H);
  if (TALL.has(k)) return { x0: ax, y0: ay, x1: ax + 26, y1: H - 14 };
  const fp = FP[k];
  if (!fp) throw new Error(`no footprint for prop "${k}"`);
  return { x0: ax + fp[0], y0: ay + fp[1], x1: ax + fp[0] + fp[2], y1: ay + fp[1] + fp[3] };
};

// Overlap area with a small tolerance (props may visually touch by a pixel or two).
const overlapArea = (a: Box, b: Box, tol = 2): number => {
  const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return (ix > tol && iy > tol) ? (ix - tol) * (iy - tol) : 0;
};

const bedBoxes = (home: string): Box[] => {
  const [d, k] = BEDS[home] || [0, 0];
  const bW = d ? 72 : 50, bX = W - bW - 10;
  const boxes: Box[] = [{ x0: bX, y0: 50, x1: bX + bW, y1: 96 }];
  for (let ci = 0; ci < k; ci++) {
    const cbX = W - (ci + 1) * 46 - 10;
    boxes.push({ x0: cbX, y0: 102, x1: cbX + 40, y1: 130 });
  }
  return boxes;
};
// Door/exit lane: keep the vertical walk path from the bottom-centre door clear.
const DOOR_LANE: Box = { x0: 140, y0: 120, x1: 180, y1: 200 };

describe('HX2 home interiors — walkability & no furniture overlaps', () => {
  const homes = Object.keys(HOME_INTERIORS);

  it('covers all 17 villager homes', () => {
    expect(homes.length).toBe(17);
  });

  it('every prop key has a known footprint', () => {
    for (const [home, t] of Object.entries(HOME_INTERIORS)) {
      for (const p of t.props) {
        expect(() => propBox(p.k, p.fx, p.fy), `${home}/${p.k}`).not.toThrow();
      }
    }
  });

  it('no prop overlaps a bed, a child bed, or the door lane', () => {
    const bad: string[] = [];
    for (const home of homes) {
      const beds = bedBoxes(home);
      for (const p of HOME_INTERIORS[home].props) {
        const box = propBox(p.k, p.fx, p.fy);
        beds.forEach((bed, i) => {
          if (overlapArea(box, bed) > 0) bad.push(`${home}: ${p.k} overlaps ${i === 0 ? 'bed' : 'child-bed'}`);
        });
        if (overlapArea(box, DOOR_LANE) > 0) bad.push(`${home}: ${p.k} blocks door lane`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('no two props significantly overlap each other', () => {
    const bad: string[] = [];
    for (const home of homes) {
      const props = HOME_INTERIORS[home].props;
      for (let i = 0; i < props.length; i++) {
        for (let j = i + 1; j < props.length; j++) {
          const area = overlapArea(propBox(props[i].k, props[i].fx, props[i].fy),
                                   propBox(props[j].k, props[j].fx, props[j].fy));
          if (area > 120) bad.push(`${home}: ${props[i].k} × ${props[j].k} overlap ~${Math.round(area)}px²`);
        }
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('every prop stays within the room bounds', () => {
    const bad: string[] = [];
    for (const home of homes) {
      for (const p of HOME_INTERIORS[home].props) {
        const b = propBox(p.k, p.fx, p.fy);
        // wall décor legitimately sits high on the wall band (y >= 0); only flag off-canvas.
        if (b.x0 < 0 || b.x1 > W || b.y0 < -1 || b.y1 > H + 2) bad.push(`${home}: ${p.k} out of bounds`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
