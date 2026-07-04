import { describe, it, expect } from 'vitest';
import { XP_TABLE, levelFromXp } from '../src/engine/xp';

describe('XP_TABLE', () => {
  it('has 101 entries (indices 0–100)', () => {
    expect(XP_TABLE.length).toBe(101);
  });

  it('index 0 and 1 are both 0', () => {
    expect(XP_TABLE[0]).toBe(0);
    expect(XP_TABLE[1]).toBe(0);
  });

  it('is strictly increasing from index 2 onward', () => {
    for (let i = 2; i < XP_TABLE.length; i++) {
      expect(XP_TABLE[i]).toBeGreaterThan(XP_TABLE[i - 1]);
    }
  });

  it('level 99 entry is a large positive number', () => {
    expect(XP_TABLE[99]).toBeGreaterThan(10_000_000);
  });

  it('all entries are integers', () => {
    for (const v of XP_TABLE) {
      expect(v).toBe(Math.floor(v));
    }
  });
});

describe('levelFromXp', () => {
  it('returns 1 at 0 XP', () => {
    expect(levelFromXp(0)).toBe(1);
  });

  it('returns 1 just below XP_TABLE[2]', () => {
    expect(levelFromXp(XP_TABLE[2] - 1)).toBe(1);
  });

  it('returns the correct level at every table boundary', () => {
    for (let lvl = 2; lvl <= 99; lvl++) {
      expect(levelFromXp(XP_TABLE[lvl])).toBe(lvl);
    }
  });

  it('never returns more than 99', () => {
    expect(levelFromXp(999_999_999)).toBe(99);
  });

  it('returns 99 for XP equal to XP_TABLE[99]', () => {
    expect(levelFromXp(XP_TABLE[99])).toBe(99);
  });

  it('returns 10 for exactly XP_TABLE[10]', () => {
    expect(levelFromXp(XP_TABLE[10])).toBe(10);
  });

  it('returns 50 for exactly XP_TABLE[50]', () => {
    expect(levelFromXp(XP_TABLE[50])).toBe(50);
  });
});
