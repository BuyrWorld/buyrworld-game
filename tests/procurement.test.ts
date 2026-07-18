import { describe, it, expect } from 'vitest';
import {
  quotesFor, planProcurement, supplierOutcome, recordSupplierResult, scoreStats, blankScore,
  INBOUND_MODES, inboundMode, defaultPlan, type ProcPlan,
} from '../src/data/procurement.ts';
import { SUPPLIER_OFFERS, FLAGSHIP_ORDER, offerById } from '../src/data/contractToCash.ts';

const O = FLAGSHIP_ORDER;   // 12 brackets, 1 iron_bar each → need 12
const budget = offerById('budget')!, standard = offerById('standard')!, premium = offerById('premium')!;

describe('supplier quotes (quote generation)', () => {
  it('produces one enriched card per supplier with a best-for tag + plain trade-off', () => {
    const q = quotesFor(SUPPLIER_OFFERS);
    expect(q).toHaveLength(3);
    for (const c of q) { expect(c.tradeoff.length).toBeGreaterThan(8); expect(typeof c.bestFor).toBe('string'); }
    const byId = Object.fromEntries(q.map(c => [c.offer.id, c]));
    expect(byId.budget.bestFor).toBe('Cheapest');
    expect(byId.premium.bestFor).toBe('Most reliable');   // premium is the most reliable
    expect(byId.standard.bestFor).toBe('Greenest');        // the local yard is the green choice
  });
  it('every supplier differs on the eight commercial axes', () => {
    const uniq = (f: (o: any) => any) => new Set(SUPPLIER_OFFERS.map(f)).size;
    for (const axis of ['unitPrice','moq','expectedQuality','leadMin','reliability','paymentTerms','sustainability','capacity'] as const) {
      expect(uniq(o => o[axis])).toBeGreaterThan(1);   // the axis genuinely varies
    }
    // the cheapest is NOT the best on quality/reliability/capacity — cheapest ≠ best
    expect(budget.unitPrice).toBeLessThan(premium.unitPrice);
    expect(budget.reliability).toBeLessThan(standard.reliability);
    expect(budget.capacity).toBeLessThan(standard.capacity);
  });
  it('folds the persistent scorecard into the quote stats', () => {
    let s = blankScore();
    s = recordSupplierResult(s, { onTime: true, short: false, quality: 0.9 });
    s = recordSupplierResult(s, { onTime: false, short: true, quality: 0.7 });
    const q = quotesFor(SUPPLIER_OFFERS, { budget: s });
    const bq = q.find(c => c.offer.id === 'budget')!;
    expect(bq.stats.orders).toBe(2);
    expect(bq.stats.onTimePct).toBe(50);
    expect(bq.stats.avgQualityPct).toBe(80);
  });
});

describe('supplier outcomes (deterministic, reliability matters)', () => {
  it('is deterministic for a given seed', () => {
    expect(supplierOutcome(42, budget, 'standard', 1)).toEqual(supplierOutcome(42, budget, 'standard', 1));
  });
  it('a reliable supplier is on time far more often than a risky one', () => {
    let budgetOnTime = 0, premiumOnTime = 0;
    for (let seed = 0; seed < 400; seed++) {
      if (supplierOutcome(seed, budget, 'standard', 3).onTime) budgetOnTime++;
      if (supplierOutcome(seed, premium, 'standard', 3).onTime) premiumOnTime++;
    }
    expect(premiumOnTime).toBeGreaterThan(budgetOnTime);       // reliability drives outcomes
    expect(premiumOnTime).toBeGreaterThan(360);                // ~98%
    expect(budgetOnTime).toBeLessThan(320);                    // ~70%
  });
  it('expedited freight is a little more reliable than standard', () => {
    let std = 0, exp = 0;
    for (let seed = 0; seed < 400; seed++) {
      if (supplierOutcome(seed, budget, 'standard', 5).onTime) std++;
      if (supplierOutcome(seed, budget, 'expedited', 5).onTime) exp++;
    }
    expect(exp).toBeGreaterThanOrEqual(std);
  });
});

describe('sourcing plans — gather / buy / split / expedite', () => {
  it('buy-all from one supplier covers the order and prices it', () => {
    const p = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 0, lines: [{ offerId: 'standard', qty: 12 }], mode: 'standard' });
    expect(p.buyQty).toBe(12);
    expect(p.covered).toBe(true);
    expect(p.materialCost).toBe(12 * 48);
    expect(p.logisticsCost).toBe(55);
  });

  it('gathering your own stock reduces what you buy (real inbound, not magic)', () => {
    // you already hold 5 bars → buy only the remaining 7
    const p = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 5, lines: [{ offerId: 'standard', qty: 7 }], mode: 'standard' }, { available: 5 });
    expect(p.gatherQty).toBe(5);
    expect(p.buyQty).toBe(7);
    expect(p.sourced).toBe(12);
    expect(p.covered).toBe(true);
    expect(p.materialCost).toBe(7 * 48);        // only pay for the 7 bought
  });
  it('gather is capped at what you actually hold', () => {
    const p = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 20, lines: [], mode: 'standard' }, { available: 3 });
    expect(p.gatherQty).toBe(3);                 // can't gather more than you own
    expect(p.covered).toBe(false);               // and the order isn't covered
    expect(p.warnings.some(w => /Short by/.test(w))).toBe(true);
  });

  it('a split across two suppliers sums cost, takes the worst lead, and blends quality', () => {
    const p = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 0, lines: [{ offerId: 'budget', qty: 14 }, { offerId: 'premium', qty: 0 }], mode: 'standard' });
    // budget alone (14) covers 12 with surplus
    expect(p.buyQty).toBe(14);
    const split = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 0, lines: [{ offerId: 'budget', qty: 6 }, { offerId: 'premium', qty: 6 }], mode: 'standard' });
    expect(split.materialCost).toBe(6 * 34 + 6 * 62);          // both lines
    expect(split.logisticsCost).toBe(40 + 70);                 // two inbound legs
    expect(split.worstLeadMin).toBe(12);                       // budget's slow lead dominates
    expect(split.lines).toHaveLength(2);
    // MOQ is enforced per line: 6 is below budget's MOQ of 14
    expect(split.moqOk).toBe(false);
    expect(split.warnings.some(w => /minimum order/.test(w))).toBe(true);
  });

  it('capacity is enforced per line', () => {
    const p = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 0, lines: [{ offerId: 'budget', qty: 30 }], mode: 'standard' });
    expect(p.capacityOk).toBe(false);            // budget capacity is 16
    expect(p.warnings.some(w => /over capacity/.test(w))).toBe(true);
  });

  it('expedited inbound halves the lead and raises freight cost', () => {
    const std = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 0, lines: [{ offerId: 'standard', qty: 12 }], mode: 'standard' });
    const exp = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 0, lines: [{ offerId: 'standard', qty: 12 }], mode: 'expedited' });
    expect(exp.worstLeadMin).toBeLessThan(std.worstLeadMin);
    expect(exp.logisticsCost).toBeGreaterThan(std.logisticsCost);
    expect(exp.materialCost).toBe(std.materialCost);           // materials unchanged
  });

  it('the economy nudges unit prices without changing the structure', () => {
    const base = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 0, lines: [{ offerId: 'standard', qty: 12 }], mode: 'standard' });
    const hot = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 0, lines: [{ offerId: 'standard', qty: 12 }], mode: 'standard' }, { demandMult: 1.15 });
    expect(hot.materialCost).toBeGreaterThan(base.materialCost);
    expect(hot.lines[0].unitPrice).toBe(Math.round(48 * 1.15));
  });
});

describe('financial reconciliation + margin estimate', () => {
  it('totalCost = material + logistics + quality, and margin = revenue − totalCost', () => {
    const p = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 0, lines: [{ offerId: 'standard', qty: 12 }], mode: 'standard' });
    expect(p.totalCost).toBe(p.materialCost + p.logisticsCost + p.qualityCost);
    expect(p.margin).toBe(p.revenue - p.totalCost);
    expect(p.marginPct).toBeCloseTo(p.margin / p.revenue, 6);
  });
  it('committed cost is only the cash spent at PO (materials + inbound), not future rework', () => {
    const p = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 0, lines: [{ offerId: 'standard', qty: 12 }], mode: 'standard' });
    expect(p.committedCost).toBe(p.materialCost + p.logisticsCost);
    expect(p.committedCost).toBeLessThanOrEqual(p.totalCost);
  });
  it('three strategies give measurably different margin AND risk', () => {
    const cheap   = planProcurement(O, SUPPLIER_OFFERS, defaultPlan(O, budget));    // budget: cheap, risky
    const premiumP = planProcurement(O, SUPPLIER_OFFERS, defaultPlan(O, premium));  // premium: dear, safe
    const gatherMix = planProcurement(O, SUPPLIER_OFFERS, { gatherQty: 6, lines: [{ offerId: 'standard', qty: 6 }], mode: 'standard' }, { available: 6 });
    // margins differ
    const margins = [cheap.margin, premiumP.margin, gatherMix.margin];
    expect(new Set(margins).size).toBe(3);
    // cheap is the cheapest materials but the highest risk
    expect(cheap.materialCost).toBeLessThan(premiumP.materialCost);
    expect(cheap.risk).toBe('high');
    expect(premiumP.risk).toBe('low');
    // the gather-mix spends the least cash (you owned half the bars)
    expect(gatherMix.materialCost).toBeLessThan(cheap.materialCost);
  });
});

describe('scorecard', () => {
  it('accumulates orders, on-time and quality into readable stats', () => {
    let s = blankScore();
    for (const r of [{ onTime: true, short: false, quality: 1.0 }, { onTime: true, short: false, quality: 0.8 }, { onTime: false, short: true, quality: 0.6 }])
      s = recordSupplierResult(s, r);
    const st = scoreStats(s);
    expect(st.orders).toBe(3);
    expect(st.onTimePct).toBe(67);
    expect(st.avgQualityPct).toBe(80);
  });
  it('an empty scorecard reads as no history', () => {
    expect(scoreStats(null)).toEqual({ orders: 0, onTimePct: null, avgQualityPct: null });
  });
});
