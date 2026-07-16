import { describe, it, expect } from 'vitest';
import {
  TUTORIAL_ALLOWED_CATEGORIES, shouldDeferDuringTutorial, ambientBlockedDuringTutorial,
  NEXT_STEPS, nextStepById, recommendNextStep, recommendReason,
  UNLOCK_GROUPS, UNLOCK_GROUP_MAX, unlockGroupsWithinLimit, nextUnlockGroup,
  summariseDeferred,
} from '../src/data/pacing.ts';

describe('pacing — notification gating during the tutorial (req 1)', () => {
  it('holds back award, unlock, journal, relationship, skill and furniture notices while the tutorial runs', () => {
    for (const cat of ['award', 'system_unlock', 'journal_first', 'relationship', 'skill_level', 'furniture']) {
      expect(shouldDeferDuringTutorial(cat, true)).toBe(true);
    }
  });
  it('lets Frosty\'s own step guidance and genuine safety events through', () => {
    for (const cat of ['tutorial_step', 'save_problem', 'arrest', 'court', 'contract_failed']) {
      expect(shouldDeferDuringTutorial(cat, true)).toBe(false);
      expect(TUTORIAL_ALLOWED_CATEGORIES.has(cat)).toBe(true);
    }
  });
  it('defers NOTHING once the tutorial is over', () => {
    for (const cat of ['award', 'system_unlock', 'tutorial_step']) {
      expect(shouldDeferDuringTutorial(cat, false)).toBe(false);
    }
  });
  it('blocks ambient spawners only while the tutorial is active', () => {
    expect(ambientBlockedDuringTutorial(true)).toBe(true);
    expect(ambientBlockedDuringTutorial(false)).toBe(false);
  });
});

describe('pacing — Choose Your Next Step (req 4/5)', () => {
  it('offers exactly the three required paths', () => {
    expect(NEXT_STEPS.map(s => s.id)).toEqual(['production', 'contract', 'explore']);
    for (const s of NEXT_STEPS) { expect(s.title.length).toBeGreaterThan(0); expect(s.tab.length).toBeGreaterThan(0); }
  });
  it('recommends selling when finished Brackets are on hand', () => {
    expect(recommendNextStep({ brackets: 3, bars: 0, ore: 0, coins: 500, contractsDone: 1 })).toBe('contract');
  });
  it('recommends production when there are materials but few finished goods', () => {
    expect(recommendNextStep({ brackets: 0, bars: 2, ore: 0, coins: 500, contractsDone: 1 })).toBe('production');
    expect(recommendNextStep({ brackets: 1, bars: 0, ore: 4, coins: 500, contractsDone: 1 })).toBe('production');
  });
  it('recommends exploring when empty-handed but experienced', () => {
    expect(recommendNextStep({ brackets: 0, bars: 0, ore: 0, coins: 500, contractsDone: 1 })).toBe('explore');
  });
  it('falls back to production for a fresh, empty founder', () => {
    expect(recommendNextStep({ brackets: 0, bars: 0, ore: 0, coins: 0, contractsDone: 0 })).toBe('production');
  });
  it('every recommendation resolves to a real step with a reason', () => {
    for (const c of [
      { brackets: 3, bars: 0, ore: 0, coins: 0, contractsDone: 1 },
      { brackets: 0, bars: 1, ore: 0, coins: 0, contractsDone: 0 },
      { brackets: 0, bars: 0, ore: 0, coins: 0, contractsDone: 1 },
    ]) {
      const id = recommendNextStep(c);
      expect(nextStepById(id).id).toBe(id);
      expect(recommendReason(id, c).length).toBeGreaterThan(0);
    }
  });
});

describe('pacing — staged feature unlocks (req 6/7)', () => {
  it('never introduces more than the group limit at once', () => {
    expect(unlockGroupsWithinLimit()).toBe(true);
    for (const g of UNLOCK_GROUPS) expect(g.length).toBeLessThanOrEqual(UNLOCK_GROUP_MAX);
  });
  it('every feature has an explanation, one action, and a target', () => {
    for (const g of UNLOCK_GROUPS) for (const f of g) {
      expect(f.blurb.length).toBeGreaterThan(0);
      expect(f.actionLabel.length).toBeGreaterThan(0);
      expect(f.tab.length).toBeGreaterThan(0);
    }
  });
  it('serves groups one at a time and stops when all are shown', () => {
    const first = nextUnlockGroup([]);
    expect(first).not.toBeNull();
    expect(first!.map(f => f.id)).toEqual(UNLOCK_GROUPS[0].map(f => f.id));
    // after the first group, the next call returns the second group
    const afterFirst = nextUnlockGroup(UNLOCK_GROUPS[0].map(f => f.id));
    expect(afterFirst!.map(f => f.id)).toEqual(UNLOCK_GROUPS[1].map(f => f.id));
    // once every feature is shown, there is nothing left to introduce
    const allIds = UNLOCK_GROUPS.flat().map(f => f.id);
    expect(nextUnlockGroup(allIds)).toBeNull();
  });
  it('only surfaces the not-yet-shown members of a partially-shown group', () => {
    const g0 = UNLOCK_GROUPS[0];
    const partial = nextUnlockGroup([g0[0].id]);
    expect(partial!.map(f => f.id)).toEqual(g0.slice(1).map(f => f.id));
  });
});

describe('pacing — deferred notices combine into one summary (req 2)', () => {
  it('dedupes and counts repeated messages', () => {
    const out = summariseDeferred([{ msg: 'A' }, { msg: 'B' }, { msg: 'A' }, { msg: 'A' }]);
    expect(out).toEqual([{ msg: 'A', count: 3 }, { msg: 'B', count: 1 }]);
  });
  it('empty in, empty out', () => {
    expect(summariseDeferred([])).toEqual([]);
  });
});
