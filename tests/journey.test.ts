import { describe, it, expect } from 'vitest';
import {
  JOURNEY, stageComplete, stageProgress, currentStageIndex, currentStage,
  canClaim, earnedTitle, isJourneyComplete,
} from '../src/data/journey.ts';

// A ctx that satisfies every stage's objective.
const FULL_CTX = {
  actions: 999, steelworksLvl: 99, trades: 999, contracts: 999, gardenHarvests: 999,
  friends: 17, totalLevel: 999, beautification: 99, automatons: 9, gridTier: 4,
};
const EMPTY_CTX: Record<string, number> = {};

describe('Founder\'s Journey — data integrity', () => {
  it('every stage is well-formed with a positive target and coin reward', () => {
    for (const s of JOURNEY) {
      expect(s.id, 'id').toBeTruthy();
      expect(s.ic && s.title && s.desc, s.id).toBeTruthy();
      expect(s.metric, s.id).toBeTruthy();
      expect(s.target, s.id).toBeGreaterThan(0);
      expect(s.reward.coins, s.id).toBeGreaterThan(0);
    }
  });

  it('stage ids and titles are unique', () => {
    const ids = JOURNEY.map(s => s.id);
    const titles = JOURNEY.map(s => s.reward.title);
    expect(new Set(ids).size).toBe(JOURNEY.length);
    expect(new Set(titles).size).toBe(JOURNEY.length);   // every stage grants a distinct title
  });

  it('coin rewards trend upward across the chain (a real progression)', () => {
    expect(JOURNEY[0].reward.coins).toBeLessThan(JOURNEY[JOURNEY.length - 1].reward.coins);
  });
});

describe('Founder\'s Journey — objective logic', () => {
  it('stageComplete respects the metric target', () => {
    const forge = JOURNEY.find(s => s.id === 'first_forge')!;   // steelworksLvl >= 3
    expect(stageComplete(forge, { steelworksLvl: 2 })).toBe(false);
    expect(stageComplete(forge, { steelworksLvl: 3 })).toBe(true);
    expect(stageComplete(forge, EMPTY_CTX)).toBe(false);        // missing metric treated as 0
  });

  it('stageProgress clamps to [0,target] and reports pct', () => {
    const supplier = JOURNEY.find(s => s.id === 'supplier')!;   // contracts target 10
    expect(stageProgress(supplier, { contracts: 0 })).toEqual({ cur: 0, max: 10, pct: 0 });
    expect(stageProgress(supplier, { contracts: 4 })).toEqual({ cur: 4, max: 10, pct: 40 });
    expect(stageProgress(supplier, { contracts: 99 })).toEqual({ cur: 10, max: 10, pct: 100 });
  });
});

describe('Founder\'s Journey — ordered progression', () => {
  it('current stage walks the chain as stages are claimed in order', () => {
    expect(currentStageIndex([])).toBe(0);
    expect(currentStage([])!.id).toBe(JOURNEY[0].id);
    expect(currentStageIndex([JOURNEY[0].id])).toBe(1);
    expect(currentStageIndex([JOURNEY[0].id, JOURNEY[1].id])).toBe(2);
  });

  it('a gap in claimed ids still points at the first unclaimed stage', () => {
    // Even if a later id is somehow present, order is driven by the first unclaimed.
    expect(currentStageIndex([JOURNEY[2].id])).toBe(0);
  });

  it('currentStageIndex is JOURNEY.length and currentStage null when all claimed', () => {
    const all = JOURNEY.map(s => s.id);
    expect(currentStageIndex(all)).toBe(JOURNEY.length);
    expect(currentStage(all)).toBeNull();
    expect(isJourneyComplete(all)).toBe(true);
  });

  it('canClaim only when the current stage objective is met', () => {
    expect(canClaim([], EMPTY_CTX)).toBe(false);      // stage 0 needs 10 actions
    expect(canClaim([], { actions: 10 })).toBe(true);
    expect(canClaim(JOURNEY.map(s => s.id), FULL_CTX)).toBe(false);  // nothing left to claim
  });
});

describe('Founder\'s Journey — titles', () => {
  it('earnedTitle returns the latest claimed stage\'s title', () => {
    expect(earnedTitle([])).toBeNull();
    expect(earnedTitle([JOURNEY[0].id])).toBe(JOURNEY[0].reward.title);
    expect(earnedTitle(JOURNEY.slice(0, 4).map(s => s.id))).toBe(JOURNEY[3].reward.title);
    expect(earnedTitle(JOURNEY.map(s => s.id))).toBe(JOURNEY[JOURNEY.length - 1].reward.title);
  });
});
