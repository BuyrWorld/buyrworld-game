import { describe, it, expect } from 'vitest';
import { itemCategory, categoryLabel, isPlaceableItem, isTradeFurniture, CATEGORY_LABELS, TRADE_FURNITURE } from '../src/data/itemTax.ts';
import { ITEMS } from '../src/data/items.ts';
import { FURNITURE } from '../src/data/furniture.ts';

describe('item taxonomy', () => {
  it('classifies each of the five explicit categories', () => {
    expect(itemCategory('iron_ore')).toBe('raw');          // mined
    expect(itemCategory('salmon')).toBe('raw');            // caught
    expect(itemCategory('carrot')).toBe('raw');            // farmed
    expect(itemCategory('steel_bar')).toBe('commodity');   // processed
    expect(itemCategory('gearbox')).toBe('commodity');     // manufactured
    expect(itemCategory('fish_stew')).toBe('consumable');  // food
    expect(itemCategory('lamp')).toBe('furniture');        // Finn's Table Lamp
    expect(itemCategory('furn_chair')).toBe('furniture');  // shop furniture
  });

  it("Finn's five homeware items are all placeable furniture (no longer confusing commodities)", () => {
    for (const id of TRADE_FURNITURE) {
      expect(itemCategory(id), id).toBe('furniture');
      expect(isPlaceableItem(id), id).toBe(true);
      expect(isTradeFurniture(id), id).toBe(true);         // stocked from the warehouse
    }
  });

  it('every real item resolves to a known category with a label', () => {
    for (const id of Object.keys(ITEMS)) {
      const cat = itemCategory(id);
      expect(CATEGORY_LABELS[cat], id).toBeTruthy();
      expect(categoryLabel(id), id).toBe(CATEGORY_LABELS[cat]);
    }
  });

  it('every trade-furniture item has a matching placement definition', () => {
    for (const id of TRADE_FURNITURE) {
      expect(FURNITURE[id], `FURNITURE def for ${id}`).toBeTruthy();
      expect(ITEMS[id], `ITEMS entry for ${id}`).toBeTruthy();   // still a tradeable homeware
    }
  });

  it('raw and commodity items are never placeable', () => {
    expect(isPlaceableItem('iron_ore')).toBe(false);
    expect(isPlaceableItem('steel_bar')).toBe(false);
    expect(isPlaceableItem('fish_stew')).toBe(false);
  });

  it('unknown ids fall back to trade commodity, not furniture', () => {
    expect(itemCategory('totally_made_up')).toBe('commodity');
    expect(isPlaceableItem('totally_made_up')).toBe(false);
  });
});
