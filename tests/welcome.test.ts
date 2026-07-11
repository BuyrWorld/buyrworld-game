import { describe, it, expect } from 'vitest';
import {
  WELCOME_BEATS, beatComplete, welcomeProgress, currentBeatIndex,
  nextBeat, allWelcomeDone, welcomeTopLevel,
} from '../src/data/welcome.ts';

const allIds = WELCOME_BEATS.map(b => b.id);

describe('Welcome ladder — structure', () => {
  it('has at least 6 beats (locks in the "≥6 wow beats in 30 min" goal)', () => {
    expect(WELCOME_BEATS.length).toBeGreaterThanOrEqual(6);
  });

  it('every beat has a unique id, a positive target and a positive coin reward', () => {
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const b of WELCOME_BEATS) {
      expect(b.target).toBeGreaterThan(0);
      expect(b.reward.coins).toBeGreaterThan(0);
      expect(b.metric).toBeTruthy();
    }
  });

  it('any item rewards carry a positive quantity', () => {
    for (const b of WELCOME_BEATS) if (b.reward.item) expect(b.reward.qty || 1).toBeGreaterThan(0);
  });

  it('totalLevel beats are ordered (an early ladder, not a late-game wall)', () => {
    const lvls = WELCOME_BEATS.filter(b => b.metric === 'totalLevel').map(b => b.target);
    const sorted = [...lvls].sort((a, b) => a - b);
    expect(lvls).toEqual(sorted);
    expect(welcomeTopLevel()).toBe(Math.max(...lvls));
    expect(welcomeTopLevel()).toBeLessThanOrEqual(30);   // reachable inside a first session
  });
});

describe('Welcome ladder — completion logic', () => {
  it('beatComplete respects the metric target', () => {
    const b = WELCOME_BEATS[0];
    expect(beatComplete(b, { [b.metric]: b.target - 1 })).toBe(false);
    expect(beatComplete(b, { [b.metric]: b.target })).toBe(true);
    expect(beatComplete(b, {})).toBe(false);
  });

  it('welcomeProgress clamps to [0, target] and reports a percentage', () => {
    const b = WELCOME_BEATS[0];
    expect(welcomeProgress(b, { [b.metric]: 0 })).toEqual({ cur: 0, max: b.target, pct: 0 });
    expect(welcomeProgress(b, { [b.metric]: b.target * 5 })).toEqual({ cur: b.target, max: b.target, pct: 100 });
  });

  it('currentBeatIndex walks the ladder in order', () => {
    expect(currentBeatIndex([])).toBe(0);
    expect(currentBeatIndex([allIds[0]])).toBe(1);
    expect(currentBeatIndex(allIds)).toBe(WELCOME_BEATS.length);
  });

  it('nextBeat returns the first unclaimed beat, then null when done', () => {
    expect(nextBeat([])).toBe(WELCOME_BEATS[0]);
    expect(nextBeat(allIds.slice(0, 2))).toBe(WELCOME_BEATS[2]);
    expect(nextBeat(allIds)).toBeNull();
  });

  it('allWelcomeDone is true only once every beat is claimed', () => {
    expect(allWelcomeDone([])).toBe(false);
    expect(allWelcomeDone(allIds.slice(0, -1))).toBe(false);
    expect(allWelcomeDone(allIds)).toBe(true);
  });
});
