import { describe, it, expect } from 'vitest';
import {
  FLAGSHIP_ORDER, SUPPLIER_OFFERS, offerById, DELIVERY_OPTIONS, deliveryById,
  requiredMaterial, suggestedOrderQty, plannedMargin, expectedRolls, computeOrderResult,
  type OrderPlan, type OrderRolls,
} from '../src/data/contractToCash.ts';

const order = FLAGSHIP_ORDER;
const budget = offerById('budget')!;
const standard = offerById('standard')!;
const premium = offerById('premium')!;
const plan = (offer: any, extra: Partial<OrderPlan> = {}): OrderPlan => ({
  offerId: offer.id, orderQty: suggestedOrderQty(order, offer), deliveryId: 'van', ...extra,
});

describe('Contract-to-Cash — the authored order + offers', () => {
  it('presents no more than three supplier offers (req 1)', () => {
    expect(SUPPLIER_OFFERS.length).toBeLessThanOrEqual(3);
    expect(SUPPLIER_OFFERS.length).toBe(3);
  });
  it('each offer exposes every decision lever the player weighs', () => {
    for (const o of SUPPLIER_OFFERS) {
      for (const k of ['unitPrice', 'leadMin', 'reliability', 'expectedQuality', 'moq', 'transportCost'] as const) {
        expect(typeof o[k]).toBe('number');
      }
      expect(['prepaid', 'on_delivery', 'net_15']).toContain(o.paymentTerms);
    }
  });
  it('the order needs one material unit per finished unit', () => {
    expect(requiredMaterial(order)).toBe(order.qty);
    expect(suggestedOrderQty(order, standard)).toBeGreaterThanOrEqual(order.qty);
    expect(suggestedOrderQty(order, standard)).toBeLessThanOrEqual(order.warehouseCap);
  });
});

describe('Contract-to-Cash — planned margin before accepting (req 3)', () => {
  it('shows a positive planned margin for a sensible standard-supplier plan', () => {
    const pm = plannedMargin(order, standard, plan(standard));
    expect(pm.revenue).toBe(order.quotedRevenue);
    expect(pm.totalCost).toBe(pm.materialCost + pm.logisticsCost + pm.expectedQualityCost);
    expect(pm.margin).toBe(pm.revenue - pm.totalCost);
    expect(pm.margin).toBeGreaterThan(0);
    expect(pm.onTimeExpected).toBe(true);
    expect(pm.capacityOk).toBe(true);
    expect(pm.moqOk).toBe(true);
    expect(pm.warnings).toEqual([]);
  });
  it('warns when a plan will miss the deadline or blow warehouse capacity', () => {
    const slow = plannedMargin(order, budget, { offerId: 'budget', orderQty: 14, deliveryId: 'van' });
    expect(slow.onTimeExpected).toBe(false);              // budget lead 12 + make 4 + van 5 = 21 > 18
    expect(slow.warnings.some(w => /deadline/i.test(w))).toBe(true);
    const overCap = plannedMargin(order, standard, { offerId: 'standard', orderQty: order.warehouseCap + 5, deliveryId: 'van' });
    expect(overCap.capacityOk).toBe(false);
    expect(overCap.warnings.some(w => /capacity/i.test(w))).toBe(true);
  });
});

describe('Contract-to-Cash — realised outcomes (req 4/5/6/7/10)', () => {
  const clean: OrderRolls = { supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0, makeDefectFrac: 0 };

  it('BEST case: reliable, on-time, flawless → full revenue, healthy profit, top satisfaction', () => {
    const r = computeOrderResult(order, standard, plan(standard), clean);
    expect(r.deliveredToCustomer).toBe(order.qty);
    expect(r.onTime).toBe(true);
    expect(r.actualRevenue).toBe(order.quotedRevenue);   // no penalties
    expect(r.profit).toBeGreaterThan(0);
    expect(r.satisfaction).toBe(100);
    expect(r.reputationDelta).toBe(2);
    expect(r.grade).toBe('excellent');
    // revenue vs cost vs cash vs profit are all distinct + coherent (req 6)
    expect(r.totalCost).toBe(r.materialCost + r.logisticsCost + r.qualityCost);
    expect(r.profit).toBe(r.actualRevenue - r.totalCost);
    expect(r.netCash).toBe(r.cashIn - r.cashOut);
    expect(r.learning).toBe(false);
  });

  it('LATE: a slow supplier that blows the deadline loses the late penalty (req 4)', () => {
    // budget lead 12 + make 4 + van 5 = 21 > 18 → late even if it arrives in full
    const r = computeOrderResult(order, budget, plan(budget), clean);
    expect(r.onTime).toBe(false);
    expect(r.actualRevenue).toBeLessThan(order.quotedRevenue);
    expect(r.satisfaction).toBeLessThan(100);
    expect(r.notes.some(n => /late/i.test(n))).toBe(true);
  });

  it('DEFECTIVE: incoming + finished defects add quality cost and cut contract value (req 4/5)', () => {
    const rolls: OrderRolls = { supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0.25, makeDefectFrac: 0.34 };
    const r = computeOrderResult(order, standard, plan(standard), rolls);
    expect(r.incomingDefects).toBeGreaterThan(0);
    expect(r.finishedDefects).toBeGreaterThan(0);
    expect(r.qualityCost).toBeGreaterThan(0);             // rework/scrap cost
    expect(r.actualRevenue).toBeLessThan(order.quotedRevenue);   // quality reduced the value
    expect(r.satisfaction).toBeLessThan(100);
    expect(r.reputationDelta).toBeLessThanOrEqual(1);
  });

  it('LOSS-MAKING: expensive sourcing + failures can go negative, but safe-recovery floors it (req 8)', () => {
    // premium price + a total supplier failure (big shortfall) + defects → a loss
    const rolls: OrderRolls = { supplierOnTime: false, shortfallFrac: 0.8, incomingDefectFrac: 0.3, makeDefectFrac: 0.3 };
    const r = computeOrderResult(order, premium, { offerId: 'premium', orderQty: 20, deliveryId: 'courier' }, rolls);
    expect(r.profit).toBeLessThan(0);                     // a real loss on a bad decision
    expect(r.learning).toBe(true);                        // framed as a teaching outcome
    // goodwill floor: they still paid SOMETHING for a genuine attempt (not zero)
    expect(r.actualRevenue).toBeGreaterThan(0);
    expect(r.actualRevenue).toBeGreaterThanOrEqual(Math.round(order.quotedRevenue * 0.40));
    // the loss is bounded — never more than what was actually spent
    expect(r.profit).toBeGreaterThan(-r.totalCost);
    expect(r.grade).toBe('poor');
  });

  it('expected rolls give a fair default resolution per supplier', () => {
    expect(expectedRolls(standard).supplierOnTime).toBe(true);
    expect(expectedRolls(budget).supplierOnTime).toBe(false);   // reliability 0.70 < 0.85
    expect(computeOrderResult(order, standard, plan(standard), expectedRolls(standard)).profit).toBeGreaterThan(0);
  });

  it('premium supplier trades margin for near-certain, near-flawless delivery', () => {
    const std = computeOrderResult(order, standard, plan(standard), expectedRolls(standard));
    const prem = computeOrderResult(order, premium, plan(premium), expectedRolls(premium));
    expect(prem.satisfaction).toBeGreaterThanOrEqual(std.satisfaction);   // fewer defects
    expect(prem.materialCost).toBeGreaterThan(std.materialCost);          // but costs more
  });
});
