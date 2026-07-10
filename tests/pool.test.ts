import { describe, it, expect } from 'vitest';
import {
  POOL, POCKETS, ballGroup, isStripe, rackBalls, allStopped, anyMoving,
  stepBalls, shootCue, remaining,
} from '../src/data/pool.ts';

describe('8-ball pool — rack & groups', () => {
  it('classifies ball groups', () => {
    expect(ballGroup(0)).toBe('cue');
    expect(ballGroup(8)).toBe('eight');
    expect(ballGroup(3)).toBe('solid');
    expect(ballGroup(11)).toBe('stripe');
    expect(isStripe(9)).toBe(true);
    expect(isStripe(7)).toBe(false);
  });
  it('racks 16 balls: cue + 7 solids + 7 stripes + the 8', () => {
    const b = rackBalls();
    expect(b.length).toBe(16);
    expect(b.filter(x => ballGroup(x.n) === 'cue').length).toBe(1);
    expect(b.filter(x => ballGroup(x.n) === 'solid').length).toBe(7);
    expect(b.filter(x => ballGroup(x.n) === 'stripe').length).toBe(7);
    expect(b.filter(x => ballGroup(x.n) === 'eight').length).toBe(1);
    expect(new Set(b.map(x => x.n)).size).toBe(16);          // all distinct
  });
  it('all balls sit inside the felt', () => {
    for (const x of rackBalls()){
      expect(x.x).toBeGreaterThan(POOL.R - 1);
      expect(x.x).toBeLessThan(POOL.W - POOL.R + 1);
      expect(x.y).toBeGreaterThan(POOL.R - 1);
      expect(x.y).toBeLessThan(POOL.H - POOL.R + 1);
    }
  });
});

describe('8-ball pool — physics', () => {
  it('friction brings a rolling ball to rest', () => {
    const balls = [{ n: 0, x: 100, y: 150, vx: 8, vy: 0, potted: false }];
    expect(anyMoving(balls)).toBe(true);
    for (let i = 0; i < 2000 && anyMoving(balls); i++) stepBalls(balls);
    expect(allStopped(balls)).toBe(true);
    expect(balls[0].x).toBeGreaterThan(100);                 // it travelled forward
  });
  it('a ball bounces off a cushion (velocity reverses)', () => {
    const balls = [{ n: 0, x: POOL.W - POOL.R - 2, y: 150, vx: 6, vy: 0, potted: false }];
    for (let i = 0; i < 5; i++) stepBalls(balls);
    expect(balls[0].vx).toBeLessThan(0);                     // now heading back
  });
  it('a ball rolling into a pocket is potted', () => {
    const balls = [{ n: 3, x: 40, y: 40, vx: -6, vy: -6, potted: false }];
    let pottedSeen = false;
    for (let i = 0; i < 40 && !pottedSeen; i++){ const e = stepBalls(balls); if (e.potted.includes(3)) pottedSeen = true; }
    expect(pottedSeen).toBe(true);
    expect(balls[0].potted).toBe(true);
  });
  it('a moving cue transfers momentum to a resting ball and reports firstHit', () => {
    const balls = [
      { n: 0, x: 100, y: 150, vx: 6, vy: 0, potted: false },
      { n: 1, x: 100 + POOL.R * 2 + 1, y: 150, vx: 0, vy: 0, potted: false },
    ];
    let firstHit = null;
    for (let i = 0; i < 30; i++){ const e = stepBalls(balls); if (e.firstHit != null && firstHit == null) firstHit = e.firstHit; }
    expect(firstHit).toBe(1);
    expect(balls[1].vx).toBeGreaterThan(0);                  // object ball driven forward
  });
  it('shootCue launches at the given angle with clamped power', () => {
    const balls = rackBalls();
    shootCue(balls, 0, 1);
    const cue = balls.find(b => b.n === 0);
    expect(cue.vx).toBeCloseTo(POOL.MAXV);
    expect(cue.vy).toBeCloseTo(0);
    shootCue(balls, 0, 5);                                   // over-power clamps to 1
    expect(cue.vx).toBeCloseTo(POOL.MAXV);
  });
  it('remaining counts un-potted balls of a group', () => {
    const balls = rackBalls();
    expect(remaining(balls, 'solid')).toBe(7);
    balls.find(b => b.n === 3).potted = true;
    expect(remaining(balls, 'solid')).toBe(6);
    expect(remaining(balls, 'eight')).toBe(1);
  });
});

describe('8-ball pool — table', () => {
  it('has six pockets', () => { expect(POCKETS.length).toBe(6); });
});
