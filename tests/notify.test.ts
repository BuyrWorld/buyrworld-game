import { describe, it, expect } from 'vitest';
import {
  NOTIFY_CATEGORIES, notifyPriority, PRIORITY_RANK, NOTIFY_DURATION, notifyDuration,
  isManaged, nextIndex, sameGroup, groupedText, LOG_FILTERS, logMatchesFilter,
  TUTORIAL_REWARDS, tutorialCoinTotal, tutorialTotalInRange, TUTORIAL_COIN_MIN,
  TUTORIAL_COIN_MAX, NEXT_ACTIONS, UNLOCK_SCHEDULE,
} from '../src/data/notify.ts';

describe('Notify — priority categories', () => {
  it('classifies examples into critical / important / routine', () => {
    expect(notifyPriority('district_unlocked')).toBe('critical');
    expect(notifyPriority('arrest')).toBe('critical');
    expect(notifyPriority('skill_level')).toBe('important');
    expect(notifyPriority('furniture')).toBe('important');
    expect(notifyPriority('gather')).toBe('routine');
    expect(notifyPriority('clean')).toBe('routine');
    expect(notifyPriority('unknown')).toBe('routine');   // safe default
  });
  it('critical persists longer than important than routine, and never vanishes instantly', () => {
    expect(NOTIFY_DURATION.critical).toBeGreaterThan(NOTIFY_DURATION.important);
    expect(NOTIFY_DURATION.important).toBeGreaterThan(NOTIFY_DURATION.routine);
    expect(notifyDuration('critical')).toBeGreaterThanOrEqual(5000);
    expect(isManaged('routine')).toBe(false);
    expect(isManaged('critical')).toBe(true);
  });
});

describe('Notify — queue ordering', () => {
  it('shows the highest priority first, then in insertion order (FIFO)', () => {
    const q = [
      { msg: 'a', priority: 'routine' as const, seq: 1 },
      { msg: 'b', priority: 'critical' as const, seq: 2 },
      { msg: 'c', priority: 'important' as const, seq: 3 },
    ];
    expect(nextIndex(q)).toBe(1);   // the critical one
    const q2 = [
      { msg: 'x', priority: 'important' as const, seq: 5 },
      { msg: 'y', priority: 'important' as const, seq: 2 },
    ];
    expect(nextIndex(q2)).toBe(1);  // earliest of equal priority
    expect(nextIndex([])).toBe(-1);
  });
});

describe('Notify — activity-log grouping', () => {
  it('collapses repeated identical entries into ×N', () => {
    let g: any = { base: 'Mined Iron Ore', count: 1, cat: 'gather' };
    expect(sameGroup(g, 'Mined Iron Ore')).toBe(true);
    g.count = 6;
    expect(groupedText(g)).toBe('Mined Iron Ore ×6');
    expect(groupedText({ base: 'Smelted Iron Bar', count: 1, cat: 'produce' })).toBe('Smelted Iron Bar');
    expect(sameGroup(g, 'Smelted Iron Bar')).toBe(false);   // unlike actions never merge
    expect(sameGroup(null, 'anything')).toBe(false);
  });
  it('has the required log filters and maps categories', () => {
    expect(LOG_FILTERS).toContain('Work');
    expect(LOG_FILTERS).toContain('Law');
    expect(logMatchesFilter('gather', 'Work')).toBe(true);
    expect(logMatchesFilter('arrest', 'Law')).toBe(true);
    expect(logMatchesFilter('gather', 'Law')).toBe(false);
    expect(logMatchesFilter('anything', 'All')).toBe(true);
  });
});

describe('Notify — tutorial reward budget', () => {
  it('totals within the intended 400–650 range', () => {
    expect(tutorialCoinTotal(true)).toBeGreaterThanOrEqual(TUTORIAL_COIN_MIN);
    expect(tutorialCoinTotal(true)).toBeLessThanOrEqual(TUTORIAL_COIN_MAX);
    expect(tutorialTotalInRange()).toBe(true);
  });
  it('no single objective pays an outsized coin reward', () => {
    for (const k of ['mine', 'smelt', 'make', 'deliver'] as const) {
      expect(TUTORIAL_REWARDS[k]).toBeLessThanOrEqual(100);
    }
  });
  it('recommends exactly three next actions and a staged unlock schedule (not one burst)', () => {
    expect(NEXT_ACTIONS.length).toBe(3);
    expect(UNLOCK_SCHEDULE.immediate).toContain('woodcutting');
    expect(UNLOCK_SCHEDULE.afterSummary).toContain('trade');
    expect(UNLOCK_SCHEDULE.contextual.length).toBeGreaterThan(0);
  });
});
