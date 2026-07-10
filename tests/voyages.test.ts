import { describe, it, expect } from 'vitest';
import {
  VOYAGE_DESTINATIONS, MAX_VOYAGES, voyageById, voyageDurationMs,
  voyageProgress, voyageReady, voyageNetCoins,
} from '../src/data/voyages.ts';
import { ITEMS } from '../src/data/items.ts';

describe('Voyages — data integrity', () => {
  it('every voyage is well-formed and profitable, cargo is real items', () => {
    for (const v of VOYAGE_DESTINATIONS) {
      expect(v.id && v.name && v.ic).toBeTruthy();
      expect(v.mins).toBeGreaterThan(0);
      expect(v.cost).toBeGreaterThan(0);
      expect(voyageNetCoins(v)).toBeGreaterThan(0);   // worth the charter
      for (const id of Object.keys(v.items)) expect(ITEMS[id], id).toBeTruthy();
    }
  });

  it('longer voyages cost more and pay more', () => {
    for (let i = 1; i < VOYAGE_DESTINATIONS.length; i++) {
      expect(VOYAGE_DESTINATIONS[i].mins).toBeGreaterThan(VOYAGE_DESTINATIONS[i - 1].mins);
      expect(VOYAGE_DESTINATIONS[i].coins).toBeGreaterThan(VOYAGE_DESTINATIONS[i - 1].coins);
    }
    expect(MAX_VOYAGES).toBeGreaterThanOrEqual(1);
  });

  it('voyageById finds them; unknown is undefined', () => {
    expect(voyageById('coast')?.name).toBe('Coastal Run');
    expect(voyageById('nope')).toBeUndefined();
  });
});

describe('Voyages — progress & readiness', () => {
  it('progress clamps 0..1 across the window', () => {
    expect(voyageProgress(1000, 2000, 1000)).toBe(0);
    expect(voyageProgress(1000, 2000, 1500)).toBeCloseTo(0.5, 5);
    expect(voyageProgress(1000, 2000, 2000)).toBe(1);
    expect(voyageProgress(1000, 2000, 5000)).toBe(1);   // overdue caps at 1
  });

  it('voyageReady flips at the return time', () => {
    expect(voyageReady(2000, 1999)).toBe(false);
    expect(voyageReady(2000, 2000)).toBe(true);
    expect(voyageReady(2000, 3000)).toBe(true);
  });

  it('duration converts minutes to ms', () => {
    expect(voyageDurationMs(VOYAGE_DESTINATIONS[0])).toBe(VOYAGE_DESTINATIONS[0].mins * 60000);
  });
});
