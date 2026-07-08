import { describe, it, expect } from 'vitest';
import { SWING_SKILLS, SWING_FRAC, SWING_COOLDOWN_MS, swingClicks, isSwingSkill } from '../src/data/swing.ts';

describe('M12 active swing — idle-protecting math', () => {
  it('only raw-gathering skills can swing', () => {
    expect([...SWING_SKILLS].sort()).toEqual(['foraging', 'mining', 'woodcutting']);
    expect(isSwingSkill('mining')).toBe(true);
    expect(isSwingSkill('manufacturing')).toBe(false); // processing skills never swing
    expect(isSwingSkill('trading')).toBe(false);
  });

  it('a single swing never completes an action from empty (frac < 1)', () => {
    expect(SWING_FRAC).toHaveLength(5); // wood → diamond
    for (const f of SWING_FRAC) {
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('higher tool tier adds more progress (fewer clicks per resource)', () => {
    for (let i = 1; i < SWING_FRAC.length; i++) {
      expect(SWING_FRAC[i]).toBeGreaterThan(SWING_FRAC[i - 1]);
    }
    // clicks-per-resource is non-increasing, and wood needs strictly more than diamond
    for (let i = 1; i < SWING_FRAC.length; i++) {
      expect(swingClicks(i)).toBeLessThanOrEqual(swingClicks(i - 1));
    }
    expect(swingClicks(0)).toBeGreaterThan(swingClicks(4));
  });

  it('always needs at least two clicks, even at the top tier', () => {
    for (let t = 0; t < SWING_FRAC.length; t++) expect(swingClicks(t)).toBeGreaterThanOrEqual(2);
  });

  it('has a real anti-autoclicker cooldown', () => {
    expect(SWING_COOLDOWN_MS).toBeGreaterThan(0);
    expect(1000 / SWING_COOLDOWN_MS).toBeLessThan(20); // caps at < 20 swings/sec
  });
});
