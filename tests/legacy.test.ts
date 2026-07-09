import { describe, it, expect } from 'vitest';
import {
  PRESTIGE_MIN_TOTAL, prestigeEligible, legacyXpMult, legacySellMult,
  legacyStars, legacyRank, legacyBonusText,
} from '../src/data/legacy.ts';

describe('Legacy — eligibility', () => {
  it('needs the minimum total level to start a new chapter', () => {
    expect(prestigeEligible(PRESTIGE_MIN_TOTAL - 1)).toBe(false);
    expect(prestigeEligible(PRESTIGE_MIN_TOTAL)).toBe(true);
    expect(prestigeEligible(0)).toBe(false);
  });
});

describe('Legacy — bonuses scale with chapters', () => {
  it('no bonus at legacy 0, rising with each chapter', () => {
    expect(legacyXpMult(0)).toBe(1);
    expect(legacySellMult(0)).toBe(1);
    expect(legacyXpMult(1)).toBeCloseTo(1.15, 5);
    expect(legacyXpMult(3)).toBeCloseTo(1.45, 5);
    expect(legacySellMult(2)).toBeCloseTo(1.16, 5);
    expect(legacyXpMult(1)).toBeGreaterThan(legacyXpMult(0));
    expect(legacySellMult(5)).toBeGreaterThan(legacySellMult(1));
  });

  it('handles undefined/negative gracefully', () => {
    expect(legacyXpMult(undefined as any)).toBe(1);
    expect(legacySellMult(-3)).toBe(1);
    expect(legacyStars(-2)).toBe(0);
  });

  it('stars cap at 9', () => {
    expect(legacyStars(3)).toBe(3);
    expect(legacyStars(50)).toBe(9);
  });
});

describe('Legacy — rank labels', () => {
  it('names each legacy level, with a top title beyond the list', () => {
    expect(legacyRank(0)).toBe('');
    expect(legacyRank(1)).toBe('Valley Elder');
    expect(legacyRank(5)).toBe('Valley Legend');
    expect(legacyRank(20)).toBe('Timeless Founder');
  });

  it('bonus text reflects the numbers', () => {
    expect(legacyBonusText(0)).toContain('+0%');
    expect(legacyBonusText(1)).toContain('+15%');
    expect(legacyBonusText(1)).toContain('+8%');
  });
});
