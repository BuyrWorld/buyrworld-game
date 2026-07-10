import { describe, it, expect } from 'vitest';
import {
  FARM_CROPS, MAX_PLOTS, cropById, cropsForLevel, farmPlotBonus, plotsUnlocked,
  waterReductionMs, fertilisedYield, WATER_FRACTION, FERTILISE_MULT,
} from '../src/data/farming.ts';

describe('Farming — crops', () => {
  it('crops are well-formed with unique ids and non-decreasing level gates', () => {
    expect(new Set(FARM_CROPS.map(c => c.id)).size).toBe(FARM_CROPS.length);
    let prev = 0;
    for (const c of FARM_CROPS) {
      expect(c.n && c.ic && c.desc).toBeTruthy();
      expect(c.lvl).toBeGreaterThanOrEqual(1);
      expect(c.seedCost).toBeGreaterThan(0);
      expect(c.ms).toBeGreaterThan(0);
      expect(c.xp).toBeGreaterThan(0);
      expect(Object.keys(c.out).length).toBeGreaterThan(0);
      expect(c.lvl).toBeGreaterThanOrEqual(prev);
      prev = c.lvl;
    }
  });
  it('cropById + cropsForLevel gate by farming level', () => {
    expect(cropById('carrot_row').ic).toBe('🥕');
    expect(cropById('nope')).toBeUndefined();
    expect(cropsForLevel(1).every(c => c.lvl <= 1)).toBe(true);
    expect(cropsForLevel(1).length).toBe(2);                 // the two level-1 crops
    expect(cropsForLevel(99).length).toBe(FARM_CROPS.length);
  });
});

describe('Farming — plots', () => {
  it('plot bonus unlocks at levels 15 and 30', () => {
    expect(farmPlotBonus(1)).toBe(0);
    expect(farmPlotBonus(15)).toBe(1);
    expect(farmPlotBonus(30)).toBe(2);
  });
  it('plotsUnlocked combines cottage tier and farming bonus, capped', () => {
    expect(plotsUnlocked(0, 1)).toBe(0);
    expect(plotsUnlocked(2, 1)).toBe(2);
    expect(plotsUnlocked(4, 1)).toBe(4);
    expect(plotsUnlocked(4, 15)).toBe(5);
    expect(plotsUnlocked(4, 30)).toBe(6);
    expect(plotsUnlocked(4, 99)).toBe(MAX_PLOTS);            // never exceeds the cap
  });
});

describe('Farming — water & fertiliser', () => {
  it('watering shaves a fraction off grow time', () => {
    const c = cropById('mushroom_log');
    expect(waterReductionMs(c)).toBe(Math.round(c.ms * WATER_FRACTION));
    expect(waterReductionMs(null)).toBe(0);
  });
  it('fertiliser multiplies each yield', () => {
    const y = fertilisedYield({ berries: 6, wild_herb: 2 });
    expect(y.berries).toBe(Math.round(6 * FERTILISE_MULT));
    expect(y.wild_herb).toBe(Math.round(2 * FERTILISE_MULT));
  });
});
