import { describe, it, expect } from 'vitest';
import { EXIT_BAND, inExitRegion, validReturn, isInteriorTab } from '../src/data/interiors.ts';

describe('interiors — exit region', () => {
  it('the exit band is a forgiving region, not a 1-2px sliver', () => {
    expect(EXIT_BAND).toBeGreaterThanOrEqual(12);
  });
  it('is true only in the bottom band of the canvas', () => {
    const H = 200;
    expect(inExitRegion(H - 34, H)).toBe(false);   // the entry point is above the band
    expect(inExitRegion(H - EXIT_BAND, H)).toBe(true);
    expect(inExitRegion(H - 4, H)).toBe(true);
    expect(inExitRegion(100, H)).toBe(false);
  });
  it('scales with the canvas height (e.g. the larger mine)', () => {
    expect(inExitRegion(288 - 5, 288)).toBe(true);
    expect(inExitRegion(288 - 40, 288)).toBe(false);
  });
});

describe('interiors — return-coordinate validation (req 8)', () => {
  const W = 3216, H = 1416;   // ~ VCOLS*TILE, VROWS*TILE
  it('accepts a well-formed return', () => {
    expect(validReturn({ district: 'village', x: 100, y: 200, objId: 'furnace' }, W, H))
      .toEqual({ district: 'village', x: 100, y: 200, objId: 'furnace' });
  });
  it('defaults the district and null objId', () => {
    expect(validReturn({ x: 10, y: 20 }, W, H)).toEqual({ district: 'village', x: 10, y: 20, objId: null });
  });
  it('REJECTS missing / non-object / wrong-shape records', () => {
    for (const bad of [null, undefined, 42, 'x', {}, { x: 1 }, { y: 1 }]) {
      expect(validReturn(bad as any, W, H)).toBeNull();
    }
  });
  it('REJECTS non-finite or out-of-bounds coordinates (corrupt save)', () => {
    expect(validReturn({ x: NaN, y: 10 }, W, H)).toBeNull();
    expect(validReturn({ x: Infinity, y: 10 }, W, H)).toBeNull();
    expect(validReturn({ x: -5, y: 10 }, W, H)).toBeNull();
    expect(validReturn({ x: 10, y: H + 1 }, W, H)).toBeNull();
    expect(validReturn({ x: W + 1, y: 10 }, W, H)).toBeNull();
  });
});

describe('interiors — interior-tab detection', () => {
  const tabs = new Set(['myhome', 'home', 'trade', 'village']);
  it('village is never an interior', () => { expect(isInteriorTab('village', tabs)).toBe(false); });
  it('recognised interiors are interiors', () => {
    expect(isInteriorTab('myhome', tabs)).toBe(true);
    expect(isInteriorTab('home', tabs)).toBe(true);
  });
  it('unknown tabs are not interiors', () => { expect(isInteriorTab('nowhere', tabs)).toBe(false); });
});
