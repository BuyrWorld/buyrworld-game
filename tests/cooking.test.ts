import { describe, it, expect } from 'vitest';
import {
  RECIPES, recipeById, recipeUnlocked, canCook, maxCookable, buffDurationMs, availableRecipes,
} from '../src/data/cooking.ts';
import { ITEMS } from '../src/data/items.ts';

describe('Cooking — data integrity', () => {
  it('every recipe is well-formed', () => {
    for (const r of RECIPES) {
      expect(r.id && r.ic && r.name && r.desc, r.id).toBeTruthy();
      expect(Object.keys(r.in).length, `${r.id} has ingredients`).toBeGreaterThan(0);
      expect(r.unlock, r.id).toBeGreaterThanOrEqual(0);
      expect(['speed', 'xp', 'sell']).toContain(r.buff.kind);
      expect(r.buff.mins, r.id).toBeGreaterThan(0);
    }
  });

  it('recipe ids and meal outputs are unique', () => {
    expect(new Set(RECIPES.map(r => r.id)).size).toBe(RECIPES.length);
    expect(new Set(RECIPES.map(r => r.out)).size).toBe(RECIPES.length);
  });

  it('every ingredient and meal output is a real item', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.out], `meal ${r.out}`).toBeTruthy();
      for (const id of Object.keys(r.in)) expect(ITEMS[id], `ingredient ${id}`).toBeTruthy();
    }
  });

  it('every meal sells at a premium over its raw ingredient value (adds value)', () => {
    for (const r of RECIPES) {
      const ingredientValue = Object.entries(r.in).reduce((a, [id, q]) => a + ITEMS[id].v * q, 0);
      expect(ITEMS[r.out].v, `${r.out} premium`).toBeGreaterThan(ingredientValue);
    }
  });

  it('speed buffs are < 1 (faster); xp/sell buffs are > 1 (bonus)', () => {
    for (const r of RECIPES) {
      if (r.buff.kind === 'speed') expect(r.buff.mult, r.id).toBeLessThan(1);
      else expect(r.buff.mult, r.id).toBeGreaterThan(1);
    }
  });
});

describe('Cooking — logic', () => {
  const tart = recipeById('berry_tart')!;   // in: berries 5, wild_herb 1; unlock 0

  it('recipeUnlocked respects the total-level gate', () => {
    const feast = recipeById('celebration_feast')!;   // unlock 60
    expect(recipeUnlocked(tart, 0)).toBe(true);
    expect(recipeUnlocked(feast, 59)).toBe(false);
    expect(recipeUnlocked(feast, 60)).toBe(true);
  });

  it('canCook only when every ingredient is stocked', () => {
    expect(canCook(tart, { berries: 5, wild_herb: 1 })).toBe(true);
    expect(canCook(tart, { berries: 4, wild_herb: 1 })).toBe(false);
    expect(canCook(tart, { berries: 99 })).toBe(false);   // missing herb
    expect(canCook(tart, {})).toBe(false);
  });

  it('maxCookable is bounded by the scarcest ingredient', () => {
    expect(maxCookable(tart, { berries: 20, wild_herb: 1 })).toBe(1);   // herb-limited
    expect(maxCookable(tart, { berries: 20, wild_herb: 4 })).toBe(4);   // berry-limited (20/5)
    expect(maxCookable(tart, { berries: 0, wild_herb: 9 })).toBe(0);
  });

  it('buffDurationMs converts minutes to ms', () => {
    expect(buffDurationMs(tart)).toBe(tart.buff.mins * 60 * 1000);
  });

  it('availableRecipes grows with total level and stays in menu order', () => {
    const atStart = availableRecipes(0);
    const atMax = availableRecipes(999);
    expect(atStart.length).toBeGreaterThan(0);
    expect(atMax.length).toBe(RECIPES.length);
    expect(atStart.length).toBeLessThan(atMax.length);
    expect(atMax.map(r => r.id)).toEqual(RECIPES.map(r => r.id));
  });
});
