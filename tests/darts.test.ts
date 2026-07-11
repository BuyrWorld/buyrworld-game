import { describe, it, expect } from 'vitest';
import {
  DART_SECTORS, DART_RINGS, sectorIndexAt, sectorNumberAt, scoreAt, aimPointFor,
  DART_DIFFICULTIES, difficultyById, DARTS_START, dartOutcome, botTarget,
  playerSwayAmp, swayOffset, releaseScatter,
} from '../src/data/darts.ts';

describe('Darts — skill-based throw model', () => {
  it('sway shrinks with wins (skill), grows when drunk, and is calmed by aim-assist', () => {
    expect(playerSwayAmp(10)).toBeLessThan(playerSwayAmp(0));                 // skill steadies
    expect(playerSwayAmp(5, { drunk: true })).toBeGreaterThan(playerSwayAmp(5)); // drink shakes
    expect(playerSwayAmp(5, { assist: true })).toBeLessThan(playerSwayAmp(5));   // assist calms
    expect(playerSwayAmp(999)).toBeGreaterThanOrEqual(0.015);                 // never zero (a floor)
  });

  it('sway offset stays within the amplitude envelope', () => {
    const amp = 0.1;
    for (const t of [0, 0.3, 1.1, 2.7, 5.5, 9.9]) {
      const o = swayOffset(t, amp);
      expect(Math.abs(o.dx)).toBeLessThanOrEqual(amp + 1e-9);
      expect(Math.abs(o.dy)).toBeLessThanOrEqual(amp + 1e-9);
    }
  });

  it('release scatter also rewards skill/assist and is small', () => {
    expect(releaseScatter(0)).toBeLessThan(0.05);
    expect(releaseScatter(15)).toBeLessThan(releaseScatter(0));
    expect(releaseScatter(5, { assist: true })).toBeLessThan(releaseScatter(5));
    expect(releaseScatter(5, { drunk: true })).toBeGreaterThan(releaseScatter(5));
  });

  it('NPC difficulty scatter tightens from Rookie to Ringer', () => {
    const scatters = DART_DIFFICULTIES.map(d => d.scatter);
    for (let i = 1; i < scatters.length; i++) expect(scatters[i]).toBeLessThan(scatters[i - 1]);
  });
});

describe('Darts — board', () => {
  it('has the 20 standard sectors starting at the top', () => {
    expect(DART_SECTORS.length).toBe(20);
    expect(new Set(DART_SECTORS).size).toBe(20);
    expect(DART_SECTORS[0]).toBe(20);
    expect(sectorNumberAt(0, -1)).toBe(20);   // straight up
  });
  it('scores centre, rings and misses correctly', () => {
    expect(scoreAt(0, 0, 1).score).toBe(50);          // inner bull
    expect(scoreAt(0.08, 0, 1).score).toBe(25);       // outer bull
    expect(scoreAt(0, -0.34, 1).score).toBe(20);      // 20 single (top)
    expect(scoreAt(0, 0, 1).ring).toBe('bull');
    expect(scoreAt(2, 2, 1).score).toBe(0);           // off the board
  });
  it('aimPointFor round-trips through scoreAt (treble 20, double 5, single 1)', () => {
    const t20 = aimPointFor(20, 'treble', 1);
    expect(scoreAt(t20.x, t20.y, 1).score).toBe(60);
    const d5 = aimPointFor(5, 'double', 1);
    expect(scoreAt(d5.x, d5.y, 1).score).toBe(10);
    const s1 = aimPointFor(1, 'single', 1);
    expect(scoreAt(s1.x, s1.y, 1).score).toBe(1);
    const bull = aimPointFor(0, 'bull', 1);
    expect(scoreAt(bull.x, bull.y, 1).score).toBe(50);
  });
});

describe('Darts — game logic', () => {
  it('301 countdown: continue, bust and exact-zero win', () => {
    expect(DARTS_START).toBe(301);
    expect(dartOutcome(100, 60)).toEqual({ remaining: 40 });
    expect(dartOutcome(40, 60).bust).toBe(true);        // overshoot
    expect(dartOutcome(40, 40)).toEqual({ win: true, remaining: 0 });
  });
  it('difficulties get sharper (less scatter) and pay more', () => {
    for (let i = 1; i < DART_DIFFICULTIES.length; i++) {
      expect(DART_DIFFICULTIES[i].scatter).toBeLessThan(DART_DIFFICULTIES[i - 1].scatter);
      expect(DART_DIFFICULTIES[i].reward).toBeGreaterThan(DART_DIFFICULTIES[i - 1].reward);
    }
    expect(difficultyById('sharp').n).toBe('Sharp');
    expect(difficultyById('nope').id).toBe('rookie');   // fallback
  });
  it('bot aims to finish when it can, else scores big', () => {
    expect(botTarget(18)).toEqual({ number: 18, ring: 'single' });   // checkout on a single
    expect(botTarget(40)).toEqual({ number: 20, ring: 'double' });   // double 20 to finish
    expect(botTarget(180)).toEqual({ number: 20, ring: 'treble' });  // go for treble 20
    expect(botTarget(45)).toEqual({ number: 15, ring: 'treble' });   // treble 15 = 45, exact
    expect(botTarget(100)).toEqual({ number: 20, ring: 'treble' });  // treble 20, leaves 40
  });
  it('exact-zero wins, bust/continue at the wire', () => {
    expect(dartOutcome(2, 1)).toEqual({ remaining: 1 });   // continue
    expect(dartOutcome(1, 1)).toEqual({ win: true, remaining: 0 });
    expect(dartOutcome(1, 20).bust).toBe(true);            // overshoot on the last point
    expect(dartOutcome(1, 2).bust).toBe(true);
  });
});
