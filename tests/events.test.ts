import { describe, it, expect } from 'vitest';
import { VILLAGE_EVENTS, todaysEvent, isEvent, marketDayActive, merchantActive, fairActive } from '../src/data/events.ts';

describe('Village events — data', () => {
  it('every event is well-formed', () => {
    for (const e of Object.values(VILLAGE_EVENTS)) {
      expect(e.id && e.ic && e.name && e.blurb).toBeTruthy();
    }
  });
});

describe('Village events — weekly rotation', () => {
  it('maps day-of-week to the right event (fair/merchant/quiet/merchant/market)', () => {
    // dow: 0 fair, 1 quiet, 2 merchant, 3 quiet, 4 merchant, 5 quiet, 6 market
    expect(todaysEvent(0)?.id).toBe('fair');
    expect(todaysEvent(1)).toBeNull();
    expect(todaysEvent(2)?.id).toBe('merchant');
    expect(todaysEvent(3)).toBeNull();
    expect(todaysEvent(4)?.id).toBe('merchant');
    expect(todaysEvent(5)).toBeNull();
    expect(todaysEvent(6)?.id).toBe('market_day');
    expect(todaysEvent(7)?.id).toBe('fair');   // wraps
  });

  it('handles negative day seeds', () => {
    expect(todaysEvent(-1)?.id).toBe(todaysEvent(6)?.id);
    expect(todaysEvent(-7)?.id).toBe(todaysEvent(0)?.id);
  });

  it('the helper predicates agree with todaysEvent', () => {
    expect(fairActive(0)).toBe(true);
    expect(merchantActive(2)).toBe(true);
    expect(marketDayActive(6)).toBe(true);
    expect(marketDayActive(1)).toBe(false);
    expect(isEvent(2, 'merchant')).toBe(true);
    expect(isEvent(2, 'fair')).toBe(false);
  });
});
