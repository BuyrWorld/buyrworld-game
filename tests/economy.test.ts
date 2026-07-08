import { describe, it, expect } from 'vitest';
import {
  ECON, baseDemand, saleDrop, applySalePressure, recoverPressure,
  driftToward, nudgeDrift, trendArrow, clampD, clampP,
  MACRO_EPOCH, MACRO_PHASE_DAYS, MACRO_SEQUENCE, MACRO_PHASES,
  macroPhaseId, macroPhase, macroDemand, msToNextPhase,
} from '../src/data/economy.ts';
import { DAY_DURATION_MS } from '../src/world/daynight.ts';

const PERIOD = MACRO_PHASE_DAYS * DAY_DURATION_MS;

const NO_NOISE = () => 0.5; // makes driftToward's jitter term zero

describe('LE1 living economy — supply/demand + mean reversion', () => {
  it('cheaper/bulkier goods have deeper markets than pricey ones', () => {
    expect(baseDemand(2)).toBeGreaterThan(baseDemand(100));
    for (const v of [1, 5, 20, 80, 500]) {
      const b = baseDemand(v);
      expect(b).toBeGreaterThanOrEqual(8);
      expect(b).toBeLessThanOrEqual(60);
    }
  });

  it('selling softens the price, and dumping more softens it more', () => {
    const p1 = applySalePressure(1.0, 20, 5);
    const p2 = applySalePressure(1.0, 200, 5);
    expect(p1).toBeLessThan(1.0);
    expect(p2).toBeLessThan(p1);
    expect(saleDrop(40, 5)).toBeCloseTo(2 * saleDrop(20, 5), 6);
  });

  it('pressure never floors below the clamp no matter how much you dump', () => {
    let p = 1.0;
    for (let i = 0; i < 100; i++) p = applySalePressure(p, 500, 2);
    expect(p).toBeGreaterThanOrEqual(ECON.P_MIN);
    expect(p).toBe(ECON.P_MIN); // fully saturated bottoms out, not below
  });

  it('pressure heals back toward 1.0 over time and never overshoots', () => {
    const dumped = applySalePressure(1.0, 300, 5); // well below 1
    expect(recoverPressure(dumped, 0)).toBe(dumped);
    const a = recoverPressure(dumped, 5);
    const b = recoverPressure(dumped, 20);
    expect(a).toBeGreaterThan(dumped);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(1.0);            // recovering from below never passes 1.0
    expect(recoverPressure(dumped, 500)).toBeCloseTo(1.0, 2); // eventually home
    expect(recoverPressure(1.0, 100)).toBe(1.0);   // already neutral stays put
  });

  it('drift mean-reverts toward equilibrium and converges (no runaway)', () => {
    // one deterministic step is exactly the reversion fraction
    expect(driftToward(1.0, 0.7, NO_NOISE)).toBeCloseTo(1.0 + (0.7 - 1.0) * ECON.D_REVERT, 6);
    // repeated application from either extreme converges to eq, always in-clamp
    for (const start of [ECON.D_MIN, ECON.D_MAX, 1.4, 0.6]) {
      let d = start;
      for (let i = 0; i < 200; i++) {
        d = driftToward(d, 0.9, NO_NOISE);
        expect(d).toBeGreaterThanOrEqual(ECON.D_MIN);
        expect(d).toBeLessThanOrEqual(ECON.D_MAX);
      }
      expect(d).toBeCloseTo(0.9, 3);
    }
  });

  it('even with noise, drift stays hard-clamped over a long random walk', () => {
    let d = 1.0;
    let rng = 1; const prng = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 5000; i++) {
      d = driftToward(d, 1.0, prng);
      expect(d).toBeGreaterThanOrEqual(ECON.D_MIN);
      expect(d).toBeLessThanOrEqual(ECON.D_MAX);
    }
  });

  it('a sale nudges the quoted price immediately, within clamps', () => {
    expect(nudgeDrift(1.0, 0.8)).toBeCloseTo(1.0 + (0.8 - 1.0) * ECON.SALE_NUDGE, 6);
    expect(nudgeDrift(1.5, ECON.D_MIN)).toBeGreaterThanOrEqual(ECON.D_MIN);
    expect(clampD(99)).toBe(ECON.D_MAX);
    expect(clampP(-99)).toBe(ECON.P_MIN);
  });

  it('trend glyph reflects price level', () => {
    expect(trendArrow(1.2)).toBe('↑');
    expect(trendArrow(0.7)).toBe('↓');
    expect(trendArrow(1.0)).toBe('→');
  });
});

describe('LE2 macro business cycle', () => {
  it('cycles through the sequence deterministically and wraps', () => {
    expect(MACRO_SEQUENCE.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < MACRO_SEQUENCE.length; i++) {
      expect(macroPhaseId(MACRO_EPOCH + i * PERIOD)).toBe(MACRO_SEQUENCE[i]);
    }
    expect(macroPhaseId(MACRO_EPOCH + MACRO_SEQUENCE.length * PERIOD)).toBe(MACRO_SEQUENCE[0]);
  });

  it('boom lifts demand, downturn softens it, steady is neutral (all bounded)', () => {
    expect(MACRO_PHASES.boom.demand).toBeGreaterThan(1);
    expect(MACRO_PHASES.downturn.demand).toBeLessThan(1);
    expect(MACRO_PHASES.steady.demand).toBe(1);
    for (const id of MACRO_SEQUENCE) {
      const d = MACRO_PHASES[id].demand;
      expect(d).toBeGreaterThan(0.6);
      expect(d).toBeLessThan(1.5);
    }
  });

  it('msToNextPhase stays within (0, period] and is deterministic', () => {
    expect(msToNextPhase(MACRO_EPOCH + 1)).toBe(PERIOD - 1);
    for (const now of [MACRO_EPOCH + 123, MACRO_EPOCH + PERIOD * 3 + 55]) {
      const ms = msToNextPhase(now);
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(PERIOD);
    }
  });

  it('never produces an unknown phase, even before the epoch', () => {
    for (const now of [MACRO_EPOCH - PERIOD * 3 - 7, MACRO_EPOCH - 1, Date.now()]) {
      expect(MACRO_SEQUENCE).toContain(macroPhaseId(now));
    }
  });

  it('macroDemand matches the current phase', () => {
    const now = MACRO_EPOCH + PERIOD + 10; // second phase = boom
    expect(macroPhase(now).id).toBe('boom');
    expect(macroDemand(now)).toBe(MACRO_PHASES.boom.demand);
  });
});
