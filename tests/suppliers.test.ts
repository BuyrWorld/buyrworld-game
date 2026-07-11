import { describe, it, expect } from 'vitest';
import {
  SUPPLIERS, supplierById, suppliersFor, supplierQuote, rollDelivery,
  reliabilityLabel, reliabilityStars,
} from '../src/data/suppliers.ts';

const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

describe('Suppliers — registry', () => {
  it('has unique ids and sane fields', () => {
    const ids = SUPPLIERS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SUPPLIERS) {
      expect(s.items.length).toBeGreaterThan(0);
      expect(s.priceMult).toBeGreaterThan(0);
      expect(s.leadMin).toBeGreaterThan(0);
      expect(s.reliability).toBeGreaterThan(0);
      expect(s.reliability).toBeLessThanOrEqual(1);
      expect(s.moq).toBeGreaterThanOrEqual(1);
    }
  });

  it('offers a genuine trade-off spread (a cheap-slow and a pricey-fast option exist)', () => {
    const cheapest = SUPPLIERS.reduce((a, b) => b.priceMult < a.priceMult ? b : a);
    const fastest  = SUPPLIERS.reduce((a, b) => b.leadMin  < a.leadMin  ? b : a);
    expect(cheapest.leadMin).toBeGreaterThan(fastest.leadMin);   // the cheap one is slower
    expect(fastest.priceMult).toBeGreaterThan(cheapest.priceMult); // the fast one costs more
  });

  it('suppliersFor gates by item coverage and total level', () => {
    const rapid = supplierById('rapid')!;
    expect(suppliersFor('rare_earth', rapid.unlockLvl - 1)).not.toContain(rapid); // locked below gate
    expect(suppliersFor('rare_earth', rapid.unlockLvl)).toContain(rapid);          // unlocked at gate
    expect(suppliersFor('nonexistent_item', 999)).toHaveLength(0);
  });
});

describe('Suppliers — quoting', () => {
  const foundry = supplierById('foundry')!;
  const coastal = supplierById('coastal')!;

  it('prices at a fixed multiple of item value and enforces MOQ', () => {
    const q = supplierQuote(foundry, foundry.moq, 100);
    expect(q.listUnit).toBe(Math.round(100 * foundry.priceMult));
    expect(q.total).toBe(q.unit * foundry.moq);
    expect(q.moqOk).toBe(true);
    expect(supplierQuote(foundry, foundry.moq - 1, 100).moqOk).toBe(false);
  });

  it('applies a bulk discount only at/above the break', () => {
    const below = supplierQuote(coastal, coastal.bulkBreak - 1, 100);
    const at    = supplierQuote(coastal, coastal.bulkBreak, 100);
    expect(below.discounted).toBe(false);
    expect(at.discounted).toBe(true);
    expect(at.unit).toBeLessThan(below.unit);
  });

  it('etaMin reflects the supplier lead time', () => {
    expect(supplierQuote(foundry, foundry.moq, 100).etaMin).toBe(foundry.leadMin);
  });
});

describe('Suppliers — delivery outcomes', () => {
  const cutprice = supplierById('cutprice')!;   // reliability 0.72

  it('delivers in full when the reliability roll succeeds', () => {
    const out = rollDelivery(cutprice, 10, seq(0.1));    // 0.1 <= 0.72 → success
    expect(out.onTime).toBe(true);
    expect(out.delivered).toBe(10);
    expect(out.shortfall).toBe(0);
  });

  it('short-ships (but never zero) when the roll fails', () => {
    const out = rollDelivery(cutprice, 10, seq(0.99, 0.0)); // fail, then min fraction 0.55
    expect(out.onTime).toBe(false);
    expect(out.delivered).toBeGreaterThanOrEqual(1);
    expect(out.delivered).toBeLessThan(10);
    expect(out.delivered + out.shortfall).toBe(10);
  });

  it('is deterministic under a seeded rng', () => {
    expect(rollDelivery(cutprice, 8, seq(0.9, 0.3))).toEqual(rollDelivery(cutprice, 8, seq(0.9, 0.3)));
  });
});

describe('Suppliers — reliability display', () => {
  it('labels and stars climb with reliability', () => {
    expect(reliabilityLabel(0.98)).toBe('Rock-solid');
    expect(reliabilityLabel(0.90)).toBe('Reliable');
    expect(reliabilityLabel(0.78)).toBe('Fair');
    expect(reliabilityLabel(0.60)).toBe('Flaky');
    expect(reliabilityStars(0.98)).toBeGreaterThan(reliabilityStars(0.60));
  });
});
