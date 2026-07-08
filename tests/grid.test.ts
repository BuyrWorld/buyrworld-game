import { describe, it, expect } from 'vitest';
import { GRID_TIERS, GRID_MAX_TIER, gridTier, gridBonus, gridNext } from '../src/data/grid.ts';
import ITEMS from '../src/data/items.json';

describe('Energy power-grid tiers', () => {
  it('tier 0 is off-grid with no bonus and no cost', () => {
    expect(GRID_TIERS[0].speedBonus).toBe(0);
    expect(GRID_TIERS[0].cost).toBeNull();
  });

  it('each tier boosts efficiency more than the last, and stays a sane bonus', () => {
    for (let i = 1; i < GRID_TIERS.length; i++) {
      expect(GRID_TIERS[i].speedBonus).toBeGreaterThan(GRID_TIERS[i - 1].speedBonus);
      expect(GRID_TIERS[i].speedBonus).toBeLessThan(0.5); // never an absurd global boost
      expect(GRID_TIERS[i].cost!.coins).toBeGreaterThan(GRID_TIERS[i - 1].cost?.coins ?? 0);
    }
  });

  it('every upgrade-cost item exists in the item registry', () => {
    for (const t of GRID_TIERS) if (t.cost) for (const id of Object.keys(t.cost.items)) {
      expect((ITEMS as any)[id], `${t.name} → ${id}`).toBeTruthy();
    }
  });

  it('gridBonus clamps out-of-range tiers', () => {
    expect(gridBonus(0)).toBe(0);
    expect(gridBonus(-5)).toBe(0);
    expect(gridBonus(999)).toBe(GRID_TIERS[GRID_MAX_TIER].speedBonus);
    expect(gridBonus(GRID_MAX_TIER)).toBe(GRID_TIERS[GRID_MAX_TIER].speedBonus);
  });

  it('gridNext walks the tiers and stops at the top', () => {
    expect(gridNext(0)?.tier).toBe(1);
    expect(gridNext(GRID_MAX_TIER)).toBeNull();
  });

  it('the maxed grid is a meaningful but bounded endgame boost', () => {
    const top = gridTier(GRID_MAX_TIER).speedBonus;
    expect(top).toBeGreaterThanOrEqual(0.1);
    expect(top).toBeLessThanOrEqual(0.25);
  });
});
