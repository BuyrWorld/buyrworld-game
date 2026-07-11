import { describe, it, expect } from 'vitest';
import {
  GRID, FURNITURE, furnitureDef, defaultColor, rotatedSize, footprintCells,
  canPlace, PLACE_REASONS, slotToGrid, migratePlacement,
} from '../src/data/furniture.ts';

const opts = (placed: any[] = [], extra: any = {}) => ({ placed, exitCells: [{ x: 3, y: 3 }, { x: 4, y: 3 }], spawnCells: [{ x: 4, y: 3 }], ...extra });

describe('Furniture — metadata (central, proportional)', () => {
  it('every item has a footprint, scale, colours and rotation flag', () => {
    for (const id in FURNITURE) {
      const d = FURNITURE[id];
      expect(d.fw).toBeGreaterThan(0);
      expect(d.fd).toBeGreaterThan(0);
      expect(d.scale).toBeGreaterThan(0);
      expect(d.colors.length).toBeGreaterThan(0);
      expect(typeof d.rotates).toBe('boolean');
    }
    expect(defaultColor('furn_chair')).toBe(FURNITURE.furn_chair.colors[0]);
    expect(furnitureDef('nope')).toBeNull();
  });
  it('footprints are proportional to the character: chair 1×1, sofa spans 3, bed 2×2', () => {
    expect([FURNITURE.furn_chair.fw, FURNITURE.furn_chair.fd]).toEqual([1, 1]);
    expect(FURNITURE.furn_sofa.fw).toBeGreaterThanOrEqual(3);   // 2+ character widths
    expect([FURNITURE.furn_bed.fw, FURNITURE.furn_bed.fd]).toEqual([2, 2]);
  });
});

describe('Furniture — footprint & rotation', () => {
  it('rotatedSize swaps w/d at 90°/270° only', () => {
    expect(rotatedSize(2, 1, 0)).toEqual({ w: 2, d: 1 });
    expect(rotatedSize(2, 1, 90)).toEqual({ w: 1, d: 2 });
    expect(rotatedSize(2, 1, 180)).toEqual({ w: 2, d: 1 });
    expect(rotatedSize(2, 1, 270)).toEqual({ w: 1, d: 2 });
  });
  it('footprintCells covers exactly the occupied cells', () => {
    expect(footprintCells('furn_table', 2, 1, 0)).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }]);
    expect(footprintCells('furn_table', 2, 1, 90).length).toBe(2);
  });
});

describe('Furniture — placement validation', () => {
  it('accepts a clear valid square', () => {
    expect(canPlace('furn_chair', 1, 1, 0, opts()).ok).toBe(true);
  });
  it('rejects placements outside the room', () => {
    expect(canPlace('furn_table', GRID.cols - 1, 0, 0, opts()).reason).toBe('outside');
    expect(canPlace('furn_chair', -1, 0, 0, opts()).reason).toBe('outside');
  });
  it('rejects overlapping other furniture', () => {
    const placed = [{ id: 'furn_bed', gx: 1, gy: 1, rot: 0 }];
    expect(canPlace('furn_chair', 1, 1, 0, opts(placed)).reason).toBe('blocked');
    expect(canPlace('furn_chair', 5, 1, 0, opts(placed)).ok).toBe(true);   // elsewhere is fine
  });
  it('protects the exit and the player spawn', () => {
    expect(canPlace('furn_chair', 3, 3, 0, opts()).reason).toBe('exit');
    expect(canPlace('furn_chair', 4, 3, 0, opts()).reason).toBe('exit');   // exit takes priority
    expect(canPlace('furn_chair', 4, 3, 0, opts([], { exitCells: [] })).reason).toBe('spawn');
  });
  it('wall items must sit against the back wall (row 0)', () => {
    expect(canPlace('furn_tv', 2, 1, 0, opts()).reason).toBe('wall');
    expect(canPlace('furn_tv', 2, 0, 0, opts()).ok).toBe(true);
  });
  it('every reason has plain-language text (no colour-only cues)', () => {
    for (const r in PLACE_REASONS) expect(PLACE_REASONS[r].length).toBeGreaterThan(3);
  });
});

describe('Furniture — old-save migration', () => {
  it('maps the 9 text slots into valid grid cells and keeps items', () => {
    for (let slot = 0; slot < 9; slot++) {
      const g = slotToGrid(slot);
      expect(g.gx).toBeGreaterThanOrEqual(0);
      expect(g.gy).toBeGreaterThanOrEqual(0);
    }
    const m = migratePlacement({ id: 'furn_chair', slot: 0 }, [], opts());
    expect(m).not.toBeNull();
    expect(m!.rot).toBe(0);
    expect(m!.color).toBe(defaultColor('furn_chair'));
  });
  it('falls back to a free cell when the mapped slot is taken (never deletes)', () => {
    const g0 = slotToGrid(0);
    const placed = [{ id: 'furn_bed', gx: g0.gx, gy: g0.gy, rot: 0 }];
    const m = migratePlacement({ id: 'furn_chair', slot: 0 }, placed, opts(placed));
    expect(m).not.toBeNull();   // relocated, not lost
  });
});
