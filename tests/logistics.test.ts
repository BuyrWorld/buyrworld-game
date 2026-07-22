import { describe, it, expect } from 'vitest';
import {
  LOGISTICS_METHODS, DEFAULT_LOGISTICS, logisticsMethod,
  resolveShipment, quotedPayout, expectedPayout,
} from '../src/data/logistics.ts';

describe('M20 logistics — delivery methods', () => {
  it('has the three methods with sane cost/risk shapes', () => {
    expect(LOGISTICS_METHODS.map(m => m.id)).toEqual(['express', 'standard', 'freight']);
    const ex = logisticsMethod('express'), st = logisticsMethod('standard'), fr = logisticsMethod('freight');
    expect(ex.risk).toBe(0);                         // Express is guaranteed
    expect(ex.payMult).toBeLessThan(1);              // …at a courier's cut
    expect(fr.payMult).toBeGreaterThan(1);           // Freight pays a bonus on success
    expect(fr.risk).toBeGreaterThan(st.risk);        // …but is the riskiest
    expect(st.risk).toBeGreaterThan(ex.risk);
    for (const m of LOGISTICS_METHODS) {
      expect(m.mishapMult).toBeLessThanOrEqual(m.payMult);   // a mishap never pays more than success
      expect(m.mishapMult).toBeGreaterThan(0);
    }
  });

  it('unknown method ids fall back to the default (Standard)', () => {
    expect(logisticsMethod('nonsense').id).toBe(DEFAULT_LOGISTICS);
    expect(logisticsMethod(undefined as any).id).toBe(DEFAULT_LOGISTICS);
  });

  it('Express is guaranteed (no rng roll ever mishaps)', () => {
    for (const r of [0, 0.01, 0.5, 0.999]) {
      const s = resolveShipment('express', 1000, () => r);
      expect(s.mishap).toBe(false);
      expect(s.payout).toBe(920);       // 1000 * 0.92
    }
  });

  it('Freight succeeds above its risk threshold and mishaps below it (deterministic)', () => {
    const ok = resolveShipment('freight', 1000, () => 0.99);
    expect(ok.mishap).toBe(false);
    expect(ok.payout).toBe(1120);       // 1000 * 1.12
    expect(ok.note).toBe('');
    const bad = resolveShipment('freight', 1000, () => 0.01);
    expect(bad.mishap).toBe(true);
    expect(bad.payout).toBe(780);       // 1000 * 0.78
    expect(bad.payout).toBeLessThan(bad.basePayout);
    expect(bad.note.length).toBeGreaterThan(0);
  });

  it('quotedPayout shows the success payout for comparison at a glance', () => {
    expect(quotedPayout('express', 1000)).toBe(920);
    expect(quotedPayout('standard', 1000)).toBe(1000);
    expect(quotedPayout('freight', 1000)).toBe(1120);
  });

  it('expected value orders Freight > Standard > Express (risk/reward is real)', () => {
    const ev = (id: string) => expectedPayout(id, 1000);
    expect(ev('freight')).toBeGreaterThan(ev('standard'));
    expect(ev('standard')).toBeGreaterThan(ev('express'));
    // Express is the guaranteed floor; Freight the swingy top.
    expect(resolveShipment('express', 1000, () => 0).payout).toBe(920);
    expect(resolveShipment('freight', 1000, () => 0.99).payout).toBe(1120);
  });

  it('rounds and never returns a negative payout', () => {
    expect(resolveShipment('freight', 0, () => 0.99).payout).toBe(0);
    expect(resolveShipment('standard', 333, () => 0.99).payout).toBe(333);
    expect(resolveShipment('express', 333, () => 0).payout).toBe(Math.round(333 * 0.92));
  });
});
