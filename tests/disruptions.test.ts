import { describe, it, expect } from 'vitest';
import {
  BATCH_MODES, batchDef, DISRUPTIONS, disruptionDef, disruptionFor, disruptionMods, inspect,
  type DisruptionId,
} from '../src/data/disruptions.ts';

describe('batch modes', () => {
  it('offers standard / fast / careful with real trade-offs', () => {
    expect(BATCH_MODES.map(b => b.id)).toEqual(['standard', 'fast', 'careful']);
    // fast is quicker but riskier; careful is slower but cleaner
    expect(batchDef('fast').timeMult).toBeLessThan(1);
    expect(batchDef('fast').defectAdd).toBeGreaterThan(0);
    expect(batchDef('careful').timeMult).toBeGreaterThan(1);
    expect(batchDef('careful').defectAdd).toBeLessThan(0);
    expect(batchDef('standard').defectAdd).toBe(0);
  });
});

describe('disruptions — seeded, one per order, all five reachable', () => {
  it('there are exactly five disruption types', () => {
    expect(DISRUPTIONS.map(d => d.id).sort()).toEqual(
      ['defective_materials', 'expedite_request', 'machine_slowdown', 'partial_shortage', 'supplier_delay']);
    for (const d of DISRUPTIONS) { expect(d.responses.length).toBeGreaterThanOrEqual(2); expect(d.blurb.length).toBeGreaterThan(8); }
  });
  it('the picker is deterministic and covers every type across seeds', () => {
    expect(disruptionFor(123)).toBe(disruptionFor(123));
    const seen = new Set<DisruptionId>();
    for (let s = 0; s < 300; s++) seen.add(disruptionFor(s));
    expect(seen.size).toBe(5);   // every disruption is reachable
  });
  it('resolves a def for a chosen id', () => {
    expect(disruptionDef('machine_slowdown')!.stage).toBe('production');
    expect(disruptionDef(null)).toBeNull();
  });
});

describe('disruption modifiers — bounded (never unwinnable)', () => {
  it('each type maps to a distinct, bounded effect', () => {
    expect(disruptionMods('supplier_delay').leadAddMin).toBe(4);
    expect(disruptionMods('defective_materials').incomingDefectAdd).toBe(0.30);
    expect(disruptionMods('machine_slowdown').productionTimeMult).toBe(2);
    expect(disruptionMods('expedite_request').deadlineMult).toBeLessThan(1);
    expect(disruptionMods('partial_shortage').forceShortfallFrac).toBe(0.25);
    // no modifier is catastrophic — defects never force a total loss, shortfall < half
    for (const d of DISRUPTIONS) {
      const m = disruptionMods(d.id);
      expect(m.incomingDefectAdd).toBeLessThanOrEqual(0.5);
      expect(m.forceShortfallFrac).toBeLessThan(0.5);
      expect(m.deadlineMult).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('quality inspection', () => {
  it('reports sample size, passed, defective and a 0..100 quality score', () => {
    const i = inspect(12, 3);
    expect(i.sampleSize).toBe(3);              // ~a quarter of 12
    expect(i.qualityScore).toBe(75);           // 9/12 good
    expect(i.passed + i.defective).toBe(i.sampleSize);
  });
  it('a clean batch scores 100 with no defective sample', () => {
    const i = inspect(12, 0);
    expect(i.qualityScore).toBe(100);
    expect(i.defective).toBe(0);
  });
  it('an empty batch is safe (no divide-by-zero)', () => {
    expect(inspect(0, 0)).toEqual({ sampleSize: 1, passed: 1, defective: 0, qualityScore: 100 });
  });
});
