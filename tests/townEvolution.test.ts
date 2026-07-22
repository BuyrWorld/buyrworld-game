import { describe, it, expect } from 'vitest';
import {
  TOWN_TIERS, townTierIndex, townTier, townTierById, nextTownTier,
  tierUnlocks, townHasDecor, townProgress,
} from '../src/data/townEvolution.ts';

describe('M24 town evolution — net-worth tiers', () => {
  it('has ascending, well-formed tiers starting at 0', () => {
    expect(TOWN_TIERS[0].at).toBe(0);
    let lastAt = -1, lastUnlocks = 0;
    TOWN_TIERS.forEach((t, i) => {
      expect(t.idx).toBe(i);
      expect(t.id && t.name && t.blurb).toBeTruthy();
      expect(t.at).toBeGreaterThan(lastAt);                    // thresholds strictly increase
      expect(t.unlocks.length).toBeGreaterThanOrEqual(lastUnlocks);  // unlocks accumulate
      lastAt = t.at; lastUnlocks = t.unlocks.length;
    });
  });

  it('maps net worth to the highest tier whose threshold is met', () => {
    expect(townTierIndex(0)).toBe(0);
    expect(townTierIndex(4999)).toBe(0);
    expect(townTierIndex(5000)).toBe(1);
    expect(townTierIndex(25000)).toBe(2);
    expect(townTierIndex(99999)).toBe(2);
    expect(townTierIndex(100000)).toBe(3);
    expect(townTierIndex(1e9)).toBe(TOWN_TIERS.length - 1);
    expect(townTier(30000).id).toBe('market_town');
  });

  it('clamps and never goes out of range for junk input', () => {
    for (const nw of [-5000, -1, NaN as any, undefined as any]) {
      const i = townTierIndex(nw);
      expect(i).toBe(0);
    }
  });

  it('nextTownTier returns the following tier, null at the top', () => {
    expect(nextTownTier(0)!.id).toBe('village');
    expect(nextTownTier(25000)!.id).toBe('bustling_town');
    expect(nextTownTier(1e9)).toBeNull();
  });

  it('unlocks accumulate up the ladder', () => {
    expect(tierUnlocks(0)).toEqual([]);
    expect(tierUnlocks(5000)).toContain('bunting');
    expect(tierUnlocks(25000)).toEqual(['bunting', 'extra_stalls']);
    expect(tierUnlocks(400000)).toContain('street_lamps');
    expect(townHasDecor(0, 'bunting')).toBe(false);
    expect(townHasDecor(5000, 'bunting')).toBe(true);
    expect(townHasDecor(5000, 'banners')).toBe(false);
    expect(townHasDecor(100000, 'banners')).toBe(true);
  });

  it('townProgress reports fraction toward the next tier (1 at the top)', () => {
    expect(townProgress(0)).toBe(0);
    expect(townProgress(2500)).toBeCloseTo(0.5, 5);        // halfway 0→5000
    expect(townProgress(5000)).toBe(0);                     // just reached village → 0 toward next
    expect(townProgress(1e9)).toBe(1);                      // maxed out
    const p = townProgress(15000);                          // between 5000 and 25000
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it('townTierById resolves known ids', () => {
    expect(townTierById('boomtown')!.idx).toBe(4);
    expect(townTierById('nope')).toBeNull();
  });
});
