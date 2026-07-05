import { describe, it, expect } from 'vitest';
import { DAY_DURATION_MS, BOOT_MS, BOOT_HOUR, gameHour, dayFraction, isNight, nightAlpha, lampGlow, skyTint } from '../src/world/daynight';

/** Return a real timestamp that produces the given game hour. */
function atGameHour(h: number): number {
  const delta = ((h - BOOT_HOUR) % 24 + 24) % 24;
  return BOOT_MS + (delta / 24) * DAY_DURATION_MS;
}

describe('gameHour', () => {
  it('equals BOOT_HOUR at session start', () => {
    expect(gameHour(BOOT_MS)).toBeCloseTo(BOOT_HOUR, 5);
  });
  it('advances 12 h after half a DAY_DURATION', () => {
    const h1 = gameHour(BOOT_MS);
    const h2 = gameHour(BOOT_MS + DAY_DURATION_MS / 2);
    expect(((h2 - h1 + 24) % 24)).toBeCloseTo(12, 5);
  });
  it('is always in [0, 24)', () => {
    for (let i = 0; i < 24; i++) {
      const result = gameHour(BOOT_MS + i / 24 * DAY_DURATION_MS);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
    }
  });
});

describe('dayFraction', () => {
  it('is close to 1 at noon', () => {
    expect(dayFraction(atGameHour(12))).toBeGreaterThan(0.99);
  });
  it('is close to 0 at midnight', () => {
    expect(dayFraction(atGameHour(0))).toBeLessThan(0.01);
  });
  it('is always in [0, 1]', () => {
    for (let i = 0; i < 24; i++) {
      const f = dayFraction(BOOT_MS + i / 24 * DAY_DURATION_MS);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
  it('is symmetric around noon (h=9 and h=15)', () => {
    const morning   = dayFraction(atGameHour(9));
    const afternoon = dayFraction(atGameHour(15));
    expect(morning).toBeCloseTo(afternoon, 5);
  });
});

describe('isNight', () => {
  it('is true at midnight (hour 0)', () => {
    expect(isNight(atGameHour(0))).toBe(true);
  });
  it('is true just before dawn (hour 5)', () => {
    expect(isNight(atGameHour(5))).toBe(true);
  });
  it('is false during the day (hour 12)', () => {
    expect(isNight(atGameHour(12))).toBe(false);
  });
  it('is false in the afternoon (hour 15)', () => {
    expect(isNight(atGameHour(15))).toBe(false);
  });
  it('is true at hour 20', () => {
    expect(isNight(atGameHour(20))).toBe(true);
  });
  it('is true at hour 22', () => {
    expect(isNight(atGameHour(22))).toBe(true);
  });
});

describe('nightAlpha', () => {
  it('is 0 at noon', () => {
    expect(nightAlpha(atGameHour(12))).toBeCloseTo(0, 5);
  });
  it('is > 0 at midnight', () => {
    expect(nightAlpha(atGameHour(0))).toBeGreaterThan(0);
  });
  it('is always in [0, 1]', () => {
    for (let i = 0; i < 24; i++) {
      const a = nightAlpha(BOOT_MS + i / 24 * DAY_DURATION_MS);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});

describe('lampGlow', () => {
  it('is 0 at noon (lamps off)', () => {
    expect(lampGlow(atGameHour(12))).toBe(0);
  });
  it('is > 0 at midnight (lamps on)', () => {
    expect(lampGlow(atGameHour(0))).toBeGreaterThan(0);
  });
  it('is always in [0, 1]', () => {
    for (let i = 0; i < 24; i++) {
      const g = lampGlow(BOOT_MS + i / 24 * DAY_DURATION_MS);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });
});

describe('skyTint', () => {
  it('returns a comma-separated RGB string', () => {
    expect(skyTint(BOOT_MS)).toMatch(/^\d+,\d+,\d+$/);
  });
  it('returns night indigo at midnight', () => {
    expect(skyTint(atGameHour(0))).toBe('10,15,50');
  });
  it('returns warm colour at sunrise (hour 6)', () => {
    expect(skyTint(atGameHour(6))).not.toBe('10,15,50');
  });
  it('returns warm colour at sunset (hour 18)', () => {
    expect(skyTint(atGameHour(18))).not.toBe('10,15,50');
  });
  it('returns night indigo at midday (not sunrise/sunset window)', () => {
    expect(skyTint(atGameHour(12))).toBe('10,15,50');
  });
});
