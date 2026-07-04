import { describe, it, expect } from 'vitest';
import { DAY_DURATION_MS, gameHour, dayFraction, isNight, nightAlpha, lampGlow, skyTint } from '../src/world/daynight';

describe('gameHour', () => {
  it('is 0 at the start of a cycle', () => {
    expect(gameHour(0)).toBe(0);
  });
  it('is 12 at the halfway point', () => {
    expect(gameHour(DAY_DURATION_MS / 2)).toBe(12);
  });
  it('is always in [0, 24)', () => {
    for (let h = 0; h < 24; h++) {
      const result = gameHour(h / 24 * DAY_DURATION_MS);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
    }
  });
});

describe('dayFraction', () => {
  it('is 0 at midnight', () => {
    expect(dayFraction(0)).toBeCloseTo(0, 5);
  });
  it('is 1 at noon', () => {
    expect(dayFraction(DAY_DURATION_MS / 2)).toBeCloseTo(1, 5);
  });
  it('is always in [0, 1]', () => {
    for (let h = 0; h < 24; h++) {
      const f = dayFraction(h / 24 * DAY_DURATION_MS);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
  it('is symmetric around noon', () => {
    const morning = dayFraction(9 / 24 * DAY_DURATION_MS);
    const afternoon = dayFraction(15 / 24 * DAY_DURATION_MS);
    expect(morning).toBeCloseTo(afternoon, 5);
  });
});

describe('isNight', () => {
  it('is true at midnight (hour 0)', () => {
    expect(isNight(0)).toBe(true);
  });
  it('is true just before dawn (hour 5)', () => {
    expect(isNight(5 / 24 * DAY_DURATION_MS)).toBe(true);
  });
  it('is false during the day (hour 12)', () => {
    expect(isNight(DAY_DURATION_MS / 2)).toBe(false);
  });
  it('is false in the afternoon (hour 15)', () => {
    expect(isNight(15 / 24 * DAY_DURATION_MS)).toBe(false);
  });
  it('is true at hour 20', () => {
    expect(isNight(20 / 24 * DAY_DURATION_MS)).toBe(true);
  });
  it('is true at hour 22', () => {
    expect(isNight(22 / 24 * DAY_DURATION_MS)).toBe(true);
  });
});

describe('nightAlpha', () => {
  it('is 0 at noon', () => {
    expect(nightAlpha(DAY_DURATION_MS / 2)).toBeCloseTo(0, 5);
  });
  it('is > 0 at midnight', () => {
    expect(nightAlpha(0)).toBeGreaterThan(0);
  });
  it('is always in [0, 1]', () => {
    for (let h = 0; h < 24; h++) {
      const a = nightAlpha(h / 24 * DAY_DURATION_MS);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});

describe('lampGlow', () => {
  it('is 0 at noon (lamps off)', () => {
    expect(lampGlow(DAY_DURATION_MS / 2)).toBe(0);
  });
  it('is > 0 at midnight (lamps on)', () => {
    expect(lampGlow(0)).toBeGreaterThan(0);
  });
  it('is always in [0, 1]', () => {
    for (let h = 0; h < 24; h++) {
      const g = lampGlow(h / 24 * DAY_DURATION_MS);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });
});

describe('skyTint', () => {
  it('returns a comma-separated RGB string', () => {
    const tint = skyTint(0);
    expect(tint).toMatch(/^\d+,\d+,\d+$/);
  });
  it('returns night indigo at midnight', () => {
    expect(skyTint(0)).toBe('10,15,50');
  });
  it('returns warm colour at sunrise (hour 6)', () => {
    const tint = skyTint(6 / 24 * DAY_DURATION_MS);
    expect(tint).not.toBe('10,15,50');
  });
  it('returns warm colour at sunset (hour 18)', () => {
    const tint = skyTint(18 / 24 * DAY_DURATION_MS);
    expect(tint).not.toBe('10,15,50');
  });
  it('returns night indigo at midday', () => {
    expect(skyTint(DAY_DURATION_MS / 2)).toBe('10,15,50');
  });
});
