import { describe, it, expect } from 'vitest';
import {
  WAREHOUSE_TIERS, warehouseTierDef, warehouseCap, nextWarehouseTier,
  warehouseFillPct, organisedSpeedFactor, tierForUsage, fillLabel,
} from '../src/data/warehouse.ts';

describe('Warehouse — tiers', () => {
  it('caps and costs both rise with tier', () => {
    for (let i = 1; i < WAREHOUSE_TIERS.length; i++) {
      expect(WAREHOUSE_TIERS[i].cap).toBeGreaterThan(WAREHOUSE_TIERS[i - 1].cap);
      expect(WAREHOUSE_TIERS[i].cost).toBeGreaterThan(WAREHOUSE_TIERS[i - 1].cost);
    }
    expect(WAREHOUSE_TIERS[0].cost).toBe(0);
    expect(nextWarehouseTier(WAREHOUSE_TIERS.length - 1)).toBeNull();
    expect(warehouseTierDef(99)).toBe(WAREHOUSE_TIERS[WAREHOUSE_TIERS.length - 1]);
    expect(warehouseCap(0)).toBe(WAREHOUSE_TIERS[0].cap);
  });
});

describe('Warehouse — organised speed factor (positive-only)', () => {
  it('is a speed-up (<1) when lean and exactly 1.0 when full or over', () => {
    const cap = 1000;
    expect(organisedSpeedFactor(0, cap)).toBeLessThan(1);      // empty = fastest
    expect(organisedSpeedFactor(cap, cap)).toBe(1);            // full = neutral
    expect(organisedSpeedFactor(cap * 3, cap)).toBe(1);        // over = neutral, never a penalty
    expect(organisedSpeedFactor(500, 0)).toBe(1);              // no cap = neutral
  });

  it('never returns a penalty (always <= 1) and eases toward 1.0 as it fills', () => {
    const cap = 1000;
    expect(organisedSpeedFactor(0, cap)).toBeLessThanOrEqual(organisedSpeedFactor(500, cap));
    expect(organisedSpeedFactor(500, cap)).toBeLessThanOrEqual(organisedSpeedFactor(900, cap));
    for (const used of [0, 250, 500, 999, 1000, 5000]) {
      expect(organisedSpeedFactor(used, cap)).toBeLessThanOrEqual(1);
    }
  });
});

describe('Warehouse — fill display', () => {
  it('fill percentage and labels track usage', () => {
    expect(warehouseFillPct(0, 1000)).toBe(0);
    expect(warehouseFillPct(500, 1000)).toBe(50);
    expect(warehouseFillPct(1500, 1000)).toBe(150);   // can exceed 100 (display clamps elsewhere)
    expect(warehouseFillPct(10, 0)).toBe(0);
    expect(fillLabel(0)).toBe('Plenty of space');
    expect(fillLabel(100)).toBe('Full');
  });
});

describe('Warehouse — grandfathering existing saves', () => {
  it('tierForUsage picks the smallest tier whose cap covers current stock', () => {
    expect(tierForUsage(0)).toBe(0);
    expect(tierForUsage(WAREHOUSE_TIERS[0].cap)).toBe(0);          // exactly at cap 0 still fits tier 0
    expect(tierForUsage(WAREHOUSE_TIERS[0].cap + 1)).toBe(1);      // just over → tier 1
    expect(warehouseCap(tierForUsage(1500))).toBeGreaterThanOrEqual(1500);
    expect(tierForUsage(9_999_999)).toBe(WAREHOUSE_TIERS.length - 1); // huge hoard clamps to max
  });
});
