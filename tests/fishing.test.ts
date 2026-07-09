import { describe, it, expect } from 'vitest';
import { FISH, fishById, catchWeights, rollCatch, catchChance } from '../src/data/fishing.ts';
import { ITEMS } from '../src/data/items.ts';

describe('Fishing — data integrity', () => {
  it('every fish is a real item with sane fields', () => {
    for (const f of FISH) {
      expect(ITEMS[f.id], f.id).toBeTruthy();
      expect(f.baseWeight, f.id).toBeGreaterThan(0);
      expect(f.xp, f.id).toBeGreaterThan(0);
      expect(f.rarity, f.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('rarer fish are worth more XP than common ones', () => {
    expect(fishById('tuna')!.xp).toBeGreaterThan(fishById('sardine')!.xp);
    expect(fishById('salmon')!.xp).toBeGreaterThan(fishById('bass')!.xp);
  });
});

describe('Fishing — odds improve with a better rod', () => {
  it('rare fish gain weight with rod tier; common sardine does not', () => {
    const wLow = catchWeights(0);
    const wHigh = catchWeights(4);
    const tunaLow = wLow.find(x => x.id === 'tuna')!.w;
    const tunaHigh = wHigh.find(x => x.id === 'tuna')!.w;
    const sardLow = wLow.find(x => x.id === 'sardine')!.w;
    const sardHigh = wHigh.find(x => x.id === 'sardine')!.w;
    expect(tunaHigh).toBeGreaterThan(tunaLow);
    expect(sardHigh).toBe(sardLow);          // sardine weight is flat
  });

  it('catchChance for prized fish rises from a low base as the rod improves', () => {
    const tuna0 = catchChance('tuna', 0);
    const tuna4 = catchChance('tuna', 4);
    expect(tuna0).toBeLessThan(0.03);        // ~1% with a wooden rod
    expect(tuna4).toBeGreaterThan(tuna0);
    // common fish stay the most likely single outcome even with the best rod
    expect(catchChance('sardine', 4)).toBeGreaterThan(catchChance('tuna', 4));
  });

  it('all catch chances at a tier sum to ~1', () => {
    for (const rt of [0, 2, 4]) {
      const sum = FISH.reduce((a, f) => a + catchChance(f.id, rt), 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });
});

describe('Fishing — rollCatch', () => {
  it('is deterministic and returns valid fish for the whole [0,1) range', () => {
    for (const r of [0, 0.2, 0.5, 0.8, 0.999]) {
      const id = rollCatch(2, () => r);
      expect(FISH.map(f => f.id)).toContain(id);
    }
  });

  it('rng at 0 yields the first (most common) fish', () => {
    expect(rollCatch(0, () => 0)).toBe('sardine');
  });

  it('over many rolls, a wooden rod lands far more common than prized fish', () => {
    let common = 0, prized = 0, seed = 12345;
    const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 4000; i++) {
      const id = rollCatch(0, rng);
      if (id === 'sardine' || id === 'mackerel') common++;
      if (id === 'salmon' || id === 'tuna') prized++;
    }
    expect(common).toBeGreaterThan(prized * 5);
  });
});
