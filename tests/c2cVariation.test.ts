import { describe, it, expect } from 'vitest';
import { rollFlagshipOrder, FLAGSHIP_ORDER, FLAGSHIP_VARIANTS } from '../src/data/contractToCash.ts';

describe('flagship per-order variation', () => {
  it('is deterministic — the same seed always yields the same order (reload-safe)', () => {
    expect(rollFlagshipOrder(12345)).toEqual(rollFlagshipOrder(12345));
    expect(rollFlagshipOrder(1)).not.toEqual(rollFlagshipOrder(2));
  });

  it('stays within tuned, always-valid bounds for every seed', () => {
    const clients = new Set<string>();
    for (let seed = 0; seed < 400; seed++){
      const o = rollFlagshipOrder(seed);
      expect(o.qty).toBeGreaterThanOrEqual(8);
      expect(o.qty).toBeLessThanOrEqual(16);
      expect(o.deadlineMin).toBeGreaterThanOrEqual(15);
      expect(o.deadlineMin).toBeLessThanOrEqual(22);
      expect(o.quotedRevenue).toBeGreaterThan(0);
      expect(o.warehouseCap).toBeGreaterThanOrEqual(o.qty);   // the order always fits
      // the mechanical chain is unchanged
      expect(o.productItem).toBe('bracket');
      expect(o.materialItem).toBe('iron_bar');
      expect(o.materialPerUnit).toBe(1);
      expect(FLAGSHIP_VARIANTS.some(v => v.client === o.client)).toBe(true);
      clients.add(o.client);
    }
    // it genuinely varies the client across seeds
    expect(clients.size).toBeGreaterThan(1);
  });

  it('leaves the canonical FLAGSHIP_ORDER untouched (tests + base mode rely on it)', () => {
    expect(FLAGSHIP_ORDER.client).toBe('Featherstone Rail Yard');
    expect(FLAGSHIP_ORDER.qty).toBe(12);
    expect(FLAGSHIP_ORDER.quotedRevenue).toBe(1200);
    expect(FLAGSHIP_ORDER.deadlineMin).toBe(18);
  });
});
