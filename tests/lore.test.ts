import { describe, it, expect } from 'vitest';
import { LORE, loreById, loreFound, isLoreComplete } from '../src/data/lore.ts';

describe('Valley Lore', () => {
  it('stones are well-formed with unique ids', () => {
    expect(new Set(LORE.map(l => l.id)).size).toBe(LORE.length);
    for (const l of LORE) {
      expect(l.ic && l.title && l.hint && l.text).toBeTruthy();
      expect(l.text.length).toBeGreaterThan(30);
    }
  });
  it('loreById finds a stone', () => {
    expect(loreById('founding')!.title).toBe('The Founding Stone');
    expect(loreById('nope')).toBeUndefined();
  });
  it('found count and completion track the discovered map', () => {
    expect(loreFound({})).toBe(0);
    expect(loreFound({ founding: 1, seam: 1 })).toBe(2);
    expect(isLoreComplete({})).toBe(false);
    const all = Object.fromEntries(LORE.map(l => [l.id, 1]));
    expect(loreFound(all)).toBe(LORE.length);
    expect(isLoreComplete(all)).toBe(true);
  });
});
