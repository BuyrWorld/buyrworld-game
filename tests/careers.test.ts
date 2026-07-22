import { describe, it, expect } from 'vitest';
import {
  CAREERS, CAREER_RANK_THRESHOLDS, CAREER_MAX_RANK, careerById,
  careerScore, careerRank, rankTitle, careerXpPct, nextRankAt, careerProgress,
} from '../src/data/careers.ts';

describe('M22 career paths', () => {
  it('has four careers covering all ten skills exactly once', () => {
    expect(CAREERS.map(c => c.id)).toEqual(['buyer', 'engineer', 'artisan', 'prospector']);
    const all = CAREERS.flatMap(c => c.skills);
    expect(all.length).toBe(new Set(all).size);           // no skill in two lanes
    expect(new Set(all)).toEqual(new Set([
      'trading', 'logistics', 'steelworks', 'manufacturing',
      'crafting', 'foraging', 'farming', 'mining', 'woodcutting', 'fishing',
    ]));
  });

  it('each career has 6 rank titles (0..5)', () => {
    for (const c of CAREERS) {
      expect(c.ranks.length).toBe(CAREER_MAX_RANK + 1);
      expect(c.ranks[0]).toBe('Unranked');
    }
  });

  it('careerScore averages the lane skill levels (floored)', () => {
    const eng = careerById('engineer')!;   // steelworks + manufacturing
    expect(careerScore(eng, () => 0)).toBe(0);
    expect(careerScore(eng, (s) => (s === 'steelworks' ? 20 : 10))).toBe(15);
    expect(careerScore(eng, () => 21)).toBe(21);
    // negatives clamp to 0
    expect(careerScore(eng, () => -5)).toBe(0);
    const art = careerById('artisan')!;     // 3 skills
    expect(careerScore(art, (s) => (s === 'crafting' ? 30 : 0))).toBe(10);   // floor(30/3)
  });

  it('careerRank maps score to 0..5 at the thresholds', () => {
    expect(careerRank(0)).toBe(0);
    expect(careerRank(4)).toBe(0);
    expect(careerRank(5)).toBe(1);
    expect(careerRank(14)).toBe(1);
    expect(careerRank(15)).toBe(2);
    expect(careerRank(25)).toBe(3);
    expect(careerRank(40)).toBe(4);
    expect(careerRank(60)).toBe(5);
    expect(careerRank(9999)).toBe(5);
  });

  it('rankTitle resolves and clamps', () => {
    const b = careerById('buyer')!;
    expect(rankTitle(b, 1)).toBe('Junior Buyer');
    expect(rankTitle(b, 5)).toBe('Head of Procurement');
    expect(rankTitle(b, 99)).toBe('Head of Procurement');
    expect(rankTitle(b, 0)).toBe('Unranked');
  });

  it('careerXpPct scales +4% per rank (rank 5 = +20%)', () => {
    expect(careerXpPct(0)).toBe(0);
    expect(careerXpPct(1)).toBeCloseTo(0.04, 5);
    expect(careerXpPct(5)).toBeCloseTo(0.20, 5);
    expect(careerXpPct(99)).toBeCloseTo(0.20, 5);   // clamped
  });

  it('nextRankAt + careerProgress report progression toward the next rank', () => {
    expect(nextRankAt(0)).toBe(5);
    expect(nextRankAt(4)).toBe(60);
    expect(nextRankAt(5)).toBeNull();               // maxed
    expect(careerProgress(0)).toBe(0);
    expect(careerProgress(10)).toBeCloseTo(0.5, 5); // halfway 5→15 (rank 1)
    expect(careerProgress(5)).toBe(0);              // just reached rank 1
    expect(careerProgress(9999)).toBe(1);           // maxed
  });

  it('careerById resolves and misses cleanly', () => {
    expect(careerById('prospector')!.ic).toBe('⛏️');
    expect(careerById('nope')).toBeNull();
  });
});
