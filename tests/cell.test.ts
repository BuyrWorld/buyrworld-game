import { describe, it, expect } from 'vitest';
import {
  CELL_MS_BASE, CELL_MS_STOLEN_EXTRA, cellDuration, remainingMs, isServed,
  PRISONER_STATES, prisonerState, CELL_LESSONS, lessonFor,
  CELL_ACTIVITIES, activityById, activityCut, allActivitiesDone, maxTotalCut,
} from '../src/data/cell.ts';

describe('Cell — sentence timing', () => {
  it('is short and never exceeds ~3 real minutes', () => {
    expect(cellDuration(false)).toBe(CELL_MS_BASE);
    expect(cellDuration(true)).toBe(CELL_MS_BASE + CELL_MS_STOLEN_EXTRA);
    expect(cellDuration(true)).toBeLessThanOrEqual(180000);   // under the 3-minute cap
    expect(cellDuration(true)).toBeGreaterThan(cellDuration(false)); // stolen goods = longer
  });

  it('remaining time clamps to zero (no negative timer exploit)', () => {
    expect(remainingMs(1000, 500)).toBe(500);
    expect(remainingMs(1000, 5000)).toBe(0);
    expect(remainingMs(0, 5000)).toBe(0);
    expect(isServed(1000, 2000)).toBe(true);
    expect(isServed(1000, 500)).toBe(false);
  });
});

describe('Cell — prisoner behaviour', () => {
  it('cycles through several believable states (never frozen)', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 70; s++) seen.add(prisonerState(s));
    expect(seen.size).toBeGreaterThanOrEqual(4);            // multiple distinct behaviours
    for (const st of seen) expect(PRISONER_STATES).toContain(st as any);
  });
});

describe('Cell — crime-specific lessons', () => {
  it('has a distinct lesson for every supported offence category', () => {
    for (const cat of ['trespassing', 'theft', 'burglary', 'antisocial', 'drunk', 'financial']) {
      expect(CELL_LESSONS[cat]).toBeTruthy();
      expect(lessonFor(cat).lines.length).toBeGreaterThan(0);
      expect(lessonFor(cat).name).toBeTruthy();
    }
  });
  it('falls back to a default lesson for an unknown offence', () => {
    expect(lessonFor('nonsense')).toBe(CELL_LESSONS.default);
  });
});

describe('Cell — activities (safeguards)', () => {
  it('has at least four optional activities, each shaving real time', () => {
    expect(CELL_ACTIVITIES.length).toBeGreaterThanOrEqual(4);
    for (const a of CELL_ACTIVITIES) expect(a.cutMs).toBeGreaterThan(0);
  });

  it('each activity applies its cut only once (idempotent → no farming)', () => {
    const id = CELL_ACTIVITIES[0].id;
    expect(activityCut(id, [])).toBe(CELL_ACTIVITIES[0].cutMs);
    expect(activityCut(id, [id])).toBe(0);           // already done
    expect(activityCut('unknown', [])).toBe(0);       // unknown activity
    expect(activityById('unknown')).toBeNull();
  });

  it('all activities combined can never zero the sentence', () => {
    expect(maxTotalCut()).toBeLessThan(CELL_MS_BASE);   // even doing everything leaves time on the clock
    expect(allActivitiesDone(CELL_ACTIVITIES.map(a => a.id))).toBe(true);
    expect(allActivitiesDone([])).toBe(false);
  });
});
