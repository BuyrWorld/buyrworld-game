import { describe, it, expect } from 'vitest';
import {
  ECON, baseDemand, saleDrop, applySalePressure, recoverPressure,
  driftToward, nudgeDrift, trendArrow, clampD, clampP,
} from '../src/data/economy.ts';

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
