import { describe, it, expect } from 'vitest';
import {
  createContract, reduce, migrateContract, seededUnit,
  plannedPnl, actualPnl, settlementBreakdown, qualityEarlyBonus, reservedByContract, satisfactionOf, gradeOf,
  C2C_STAGES, DECISION_STAGES, isDecisionStage, C2C_ENGINE_VERSION,
  type C2CContract, type C2CAction, type C2CEffect,
} from '../src/data/c2cEngine.ts';
import { FLAGSHIP_ORDER } from '../src/data/contractToCash.ts';

// ---- In-memory world adapter (stands in for main.ts inventory + wallet) ----
// Applying the reducer's declarative effects here proves the engine keeps the
// real inventory as the source of truth: goods receipt / production / dispatch
// create actual movements, reservations gate double-use, and keyed money moves
// can never double-apply.
interface World { inv: Record<string, number>; reserved: Record<string, number>; coins: number; seen: Record<string, boolean>; rep: Record<string, number>; closed: any[]; c: C2CContract; }
function mkWorld(c: C2CContract, coins = 5000): World {
  return { inv: {}, reserved: {}, coins, seen: {}, rep: {}, closed: [], c };
}
function applyEffect(w: World, e: C2CEffect) {
  switch (e.kind) {
    case 'inv_add': w.inv[e.item] = (w.inv[e.item] || 0) + e.qty; break;
    case 'inv_remove': w.inv[e.item] = Math.max(0, (w.inv[e.item] || 0) - e.qty); break;
    case 'reserve': w.reserved[e.item] = (w.reserved[e.item] || 0) + e.qty; break;
    case 'release': w.reserved[e.item] = Math.max(0, (w.reserved[e.item] || 0) - e.qty); break;
    case 'debit': if (!w.seen[e.key]) { w.coins -= e.amount; w.seen[e.key] = true; } break;
    case 'credit': if (!w.seen[e.key]) { w.coins += e.amount; w.seen[e.key] = true; } break;
    case 'rep': w.rep[e.client] = (w.rep[e.client] || 0) + e.delta; break;
    case 'closed': w.closed.push(e.record); break;
  }
}
function act(w: World, action: C2CAction) {
  const res = reduce(w.c, action);
  if (res.ok) { w.c = res.contract; res.effects.forEach(e => applyEffect(w, e)); }
  return res;
}
// Pump time-driven stages until they stop advancing (a decision stage or a wait).
function pump(w: World, now: number) {
  for (let guard = 0; guard < 60; guard++) {
    const res = reduce(w.c, { type: 'tick', now });
    if (!res.changed) break;
    w.c = res.contract; res.effects.forEach(e => applyEffect(w, e));
  }
}
function force(w: World, rolled: Partial<NonNullable<C2CContract['rolled']>>) {
  w.c.rolled = Object.assign({ supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0, makeDefectFrac: 0, reworkShare: 0.6 }, rolled) as any;
}

// Drive a contract from customer_request up to (but not through) a target stage,
// forcing the outcome rolls. Returns at the target stage.
interface DriveOpts { qty?: number; supplier?: string; delivery?: string; customerTerms?: 'on_delivery' | 'net_15' | 'prepaid'; rolled?: Partial<NonNullable<C2CContract['rolled']>>; deliverNow?: number; }
function fresh(opts: DriveOpts = {}) {
  const c = createContract(FLAGSHIP_ORDER, { id: 'T1', seed: 12345, now: 0, makeQuality: 0.9, customerTerms: opts.customerTerms ?? 'on_delivery' });
  return mkWorld(c);
}

describe('c2c engine — stage list + decision gating', () => {
  it('defines exactly the 17 required stages in order', () => {
    expect(C2C_STAGES).toEqual([
      'customer_request', 'quotation_review', 'supplier_selection', 'purchase_order_raised',
      'supplier_in_progress', 'inbound_transport', 'goods_received', 'goods_in_qc',
      'materials_accepted_or_quarantined', 'production', 'final_qc', 'dispatch_decision',
      'outbound_transport', 'delivered', 'invoiced', 'paid', 'closed',
    ]);
  });
  it('a tick never advances a stage that requires a player decision', () => {
    for (const stage of DECISION_STAGES) {
      const c = createContract(FLAGSHIP_ORDER, { id: 'D', seed: 1, now: 0 });
      c.stage = stage as any;
      const res = reduce(c, { type: 'tick', now: 1e9 });
      expect(res.changed).toBe(false);
      expect(res.contract.stage).toBe(stage);
    }
    expect(isDecisionStage('production')).toBe(true);
    expect(isDecisionStage('goods_received')).toBe(false);
  });
});

describe('c2c engine — happy path', () => {
  it('walks all 17 stages, conserves inventory, releases reservations, pays once', () => {
    const w = fresh();
    expect(act(w, { type: 'accept_request' }).contract.stage).toBe('quotation_review');
    act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    expect(w.c.stage).toBe('purchase_order_raised');
    expect(w.c.po).toMatchObject({ supplier: 'Featherstone Foundry', qty: 12, unitPrice: 48, paymentTerms: 'on_delivery', promisedLeadMin: 6 });
    act(w, { type: 'raise_po', now: 0 });                 // inbound freight paid now (55)
    expect(w.coins).toBe(5000 - 55);
    force(w, { supplierOnTime: true });
    pump(w, 6);                                           // supplier ready → inbound in transit
    pump(w, 7);                                           // arrive → receive → goods-in QC
    expect(w.c.stage).toBe('materials_accepted_or_quarantined');
    expect(w.inv.iron_bar).toBe(12);                      // real inbound inventory movement
    expect(w.reserved.iron_bar).toBe(12);                 // reserved to the order
    expect(w.coins).toBe(5000 - 55 - 12 * 48);            // supplier paid on delivery
    act(w, { type: 'resolve_materials', quarantine: 'hold' });
    act(w, { type: 'run_production' });
    expect(w.inv.iron_bar).toBe(0);                       // consumed
    expect(w.inv.bracket).toBe(12);                       // real finished goods
    pump(w, 7);                                           // final QC → dispatch decision
    expect(w.c.stage).toBe('dispatch_decision');
    expect(w.c.fin).toMatchObject({ good: 12, reworkable: 0, scrapped: 0 });
    act(w, { type: 'dispatch', rework: false, now: 7 });  // outbound van (30)
    expect(w.inv.bracket).toBe(0);                        // shipped out of inventory
    pump(w, 12);                                          // delivered → invoiced
    expect(w.c.stage).toBe('invoiced');
    expect(w.c.onTime).toBe(true);
    act(w, { type: 'send_invoice', now: 12 });
    pump(w, 12);                                          // paid → closed
    expect(w.c.stage).toBe('closed');

    // reservations fully released, inventory net zero
    expect(w.reserved.iron_bar).toBe(0);
    expect(w.reserved.bracket).toBe(0);
    expect(w.inv.iron_bar).toBe(0);
    expect(w.inv.bracket).toBe(0);
    // money: -55 inbound -576 material -30 outbound +1236 revenue (1200 + a 36 = 3%
    // spotless-order quality bonus)
    expect(w.coins).toBe(5000 - 55 - 576 - 30 + 1236);
    // P&L
    const a = actualPnl(w.c);
    expect(a).toMatchObject({ revenue: 1236, materialCost: 576, inboundLogistics: 55, outboundLogistics: 30, penalties: 0 });
    expect(a.grossProfit).toBe(1236 - 576 - 55 - 30);
    expect(a.marginPct).toBeCloseTo(a.grossProfit / a.revenue, 5);
    expect(gradeOf(w.c)).toBe('excellent');
    expect(w.closed).toHaveLength(1);
    expect(w.rep['Featherstone Rail Yard']).toBe(2);
  });
});

describe('c2c engine — settlement breakdown reconciles to the penny', () => {
  // Drive a clean order to close and prove every displayed line adds up.
  function driveClose(w: World) {
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    force(w, { supplierOnTime: true });
    pump(w, 6); pump(w, 7);
    act(w, { type: 'resolve_materials', quarantine: 'hold' });
    act(w, { type: 'run_production' });
    pump(w, 7);
    act(w, { type: 'dispatch', rework: false, now: 7 });
    pump(w, 12);
    act(w, { type: 'send_invoice', now: 12 });
    pump(w, 12);
  }

  it('revenue lines sum to net, cost lines sum to total, and profit == cash delta', () => {
    const w = fresh();
    const c0 = w.coins;
    driveClose(w);
    expect(w.c.stage).toBe('closed');
    const s = settlementBreakdown(w.c);
    // revenue lines sum to net exactly (contract + adjustments + goodwill residual)
    const r = s.revenue;
    expect(r.contract + r.qualityAdj + r.timingAdj + r.shortfallAdj + r.goodwillAdj).toBe(r.net);
    // cost lines sum to the cost total exactly
    const k = s.costs;
    expect(k.materials + k.inboundFreight + k.expediting + k.manufacturing + k.rework + k.scrap + k.outbound).toBe(k.total);
    // the headline identity: revenue − costs == gross profit == actualPnl == real cash movement
    expect(s.grossProfit).toBe(r.net - k.total);
    expect(s.grossProfit).toBe(actualPnl(w.c).grossProfit);
    expect(w.coins - c0).toBe(s.grossProfit);
    expect(s.cashDelta).toBe(w.coins - c0);
    // a spotless run earns the quality bonus and nothing was short/late
    expect(s.inFull).toBe(true);
    expect(s.qualityScore).toBeGreaterThanOrEqual(98);
    expect(qualityEarlyBonus(w.c)).toBeGreaterThan(0);
  });

  it('rejecting the delivery pays nothing, keeps the stock, and still reconciles', () => {
    const w = fresh();
    const c0 = w.coins;
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    force(w, { supplierOnTime: true });
    pump(w, 6); pump(w, 7);
    act(w, { type: 'resolve_materials', quarantine: 'hold' });
    act(w, { type: 'run_production' });
    pump(w, 7);
    expect(w.c.stage).toBe('dispatch_decision');
    const made = w.inv.bracket;                       // finished goods on hand
    act(w, { type: 'dispatch', rework: false, reject: true, now: 7 });   // REJECT
    pump(w, 20);
    act(w, { type: 'send_invoice', now: 20 });
    pump(w, 40);
    expect(w.c.stage).toBe('closed');
    expect(w.c.customerRejected).toBe(true);
    expect(w.c.fin.deliveredToCustomer).toBe(0);       // nothing shipped
    expect(w.inv.bracket).toBe(made);                  // player KEEPS the finished stock
    expect(w.reserved.bracket || 0).toBe(0);           // but the reservation is released
    const a = actualPnl(w.c);
    expect(w.c.cash.revenue).toBe(0);                  // no cash revenue banked
    expect(a.outboundLogistics).toBe(0);               // no outbound freight paid
    expect(a.grossProfit).toBeLessThan(0);             // a rejected order is a loss (costs only)
    expect(w.coins - c0).toBe(a.grossProfit);          // reconciles exactly (a loss = the costs)
    expect(w.coins - c0).toBe(settlementBreakdown(w.c).grossProfit);
  });

  it('a short, defective, late order still reconciles exactly', () => {
    const w = fresh();
    const c0 = w.coins;
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'budget', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    force(w, { supplierOnTime: false, shortfallFrac: 0.25, incomingDefectFrac: 0.2, makeDefectFrac: 0.2, reworkShare: 0.5 });
    pump(w, receiveAt('budget'));
    act(w, { type: 'resolve_materials', quarantine: 'scrap' });
    act(w, { type: 'run_production' });
    pump(w, receiveAt('budget'));
    // dispatch very late so the late penalty bites
    act(w, { type: 'dispatch', rework: false, now: 400 });
    pump(w, 420);
    act(w, { type: 'send_invoice', now: 420 });
    pump(w, 440);
    expect(w.c.stage).toBe('closed');
    const s = settlementBreakdown(w.c);
    const r = s.revenue, k = s.costs;
    expect(r.contract + r.qualityAdj + r.timingAdj + r.shortfallAdj + r.goodwillAdj).toBe(r.net);
    expect(k.materials + k.inboundFreight + k.expediting + k.manufacturing + k.rework + k.scrap + k.outbound).toBe(k.total);
    expect(s.grossProfit).toBe(r.net - k.total);
    expect(s.grossProfit).toBe(actualPnl(w.c).grossProfit);
    expect(w.coins - c0).toBe(s.grossProfit);   // reconciles even when the order goes badly
  });
});

// Supplier lead times (min) — goods are received at lead + INBOUND_TRANSIT(1).
const LEAD: Record<string, number> = { budget: 12, standard: 6, premium: 3 };
function receiveAt(supplier: string): number { return LEAD[supplier] + 1; }

// Helper: drive to the dispatch decision with a given roll set + qty. Uses the
// supplier's real lead time so the mechanical stages actually advance.
function driveToDispatch(w: World, opts: { qty: number; supplier: string; rolled: Partial<NonNullable<C2CContract['rolled']>>; quarantine?: 'scrap' | 'rework' | 'hold' }) {
  const recv = receiveAt(opts.supplier);
  act(w, { type: 'accept_request' });
  act(w, { type: 'accept_quote' });
  act(w, { type: 'select_supplier', offerId: opts.supplier, qty: opts.qty, deliveryId: 'van' });
  act(w, { type: 'raise_po', now: 0 });
  force(w, opts.rolled);
  pump(w, recv);                                        // supplier → inbound → received → QC → materials
  act(w, { type: 'resolve_materials', quarantine: opts.quarantine ?? 'hold' });
  act(w, { type: 'run_production' });
  pump(w, recv);                                        // final QC → dispatch decision (instant)
}

describe('c2c engine — supplier + receipt outcomes', () => {
  it('late supplier: the supplier stage is time-gated and does not advance early', () => {
    const w = fresh();
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });                 // supplierReadyAt = 0 + 6
    force(w, { supplierOnTime: true });
    pump(w, 3);                                           // too early — supplier still working
    expect(w.c.stage).toBe('supplier_in_progress');
    pump(w, 6);                                           // now it's ready
    expect(w.c.stage).toBe('inbound_transport');
  });

  it('short delivery: a supplier miss ships fewer bars → fewer finished units', () => {
    const w = fresh();
    driveToDispatch(w, { qty: 12, supplier: 'budget', rolled: { supplierOnTime: false, shortfallFrac: 0.5 } });
    expect(w.c.mat.shortfall).toBe(6);
    expect(w.c.mat.delivered).toBe(6);
    expect(w.c.fin.good).toBe(6);                          // only 6 producible
    expect(w.inv.bracket).toBe(6);
  });

  it('poor quality receipt: goods-in QC quarantines defective bars (kept from production)', () => {
    const w = fresh();
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'budget', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    force(w, { supplierOnTime: true, incomingDefectFrac: 0.25 });
    pump(w, receiveAt('budget'));
    expect(w.c.stage).toBe('materials_accepted_or_quarantined');
    expect(w.c.mat.quarantined).toBe(3);
    expect(w.c.mat.accepted).toBe(9);
    // hold the quarantine → production can only use the 9 accepted (quarantined excluded)
    act(w, { type: 'resolve_materials', quarantine: 'hold' });
    act(w, { type: 'run_production' });
    expect(w.c.fin.produced).toBe(9);
  });

  it('rejected batch: scrapping quarantined stock removes it from inventory', () => {
    const w = fresh();
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'budget', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    force(w, { supplierOnTime: true, incomingDefectFrac: 1 });   // entire batch defective
    pump(w, receiveAt('budget'));
    expect(w.c.mat.quarantined).toBe(12);
    expect(w.inv.iron_bar).toBe(12);                             // received (real movement) …
    act(w, { type: 'resolve_materials', quarantine: 'scrap' });  // … then rejected/scrapped
    expect(w.inv.iron_bar).toBe(0);
    expect(w.reserved.iron_bar).toBe(0);
    act(w, { type: 'run_production' });
    expect(w.c.fin.produced).toBe(0);                            // nothing to make
  });
});

describe('c2c engine — production + finished QC', () => {
  it('production defect: final QC splits accepted / reworkable / scrapped', () => {
    const w = fresh();
    driveToDispatch(w, { qty: 12, supplier: 'standard', rolled: { makeDefectFrac: 0.5, reworkShare: 0.5 } });
    // 12 produced, 50% defective = 6; of those 50% reworkable = 3, 3 scrapped
    expect(w.c.fin.produced).toBe(12);
    expect(w.c.fin.scrapped).toBe(3);
    expect(w.c.fin.reworkable).toBe(3);
    expect(w.c.fin.good).toBe(6);
    expect(w.inv.bracket).toBe(9);                          // 3 scrapped left inventory
  });

  it('rework: reworking finished units at dispatch converts reworkable → good', () => {
    const w = fresh();
    driveToDispatch(w, { qty: 12, supplier: 'standard', rolled: { makeDefectFrac: 0.5, reworkShare: 0.5 } });
    const coinsBefore = w.coins;
    act(w, { type: 'dispatch', rework: true, now: 7 });
    expect(w.c.fin.reworked).toBe(3);
    expect(w.c.fin.deliveredToCustomer).toBe(9);            // 6 good + 3 reworked
    expect(w.c.cash.reworkPaid).toBe(3 * FLAGSHIP_ORDER.reworkCostPerUnit);
    expect(w.coins).toBe(coinsBefore - 3 * FLAGSHIP_ORDER.reworkCostPerUnit - 30);  // rework + outbound
  });

  it('partial shipment: dispatch ships only what is good when supply falls short', () => {
    const w = fresh();
    driveToDispatch(w, { qty: 12, supplier: 'budget', rolled: { supplierOnTime: false, shortfallFrac: 0.5 } });
    const recv = receiveAt('budget');
    act(w, { type: 'dispatch', rework: false, now: recv });
    expect(w.c.fin.deliveredToCustomer).toBe(6);
    expect(w.c.fin.deliveredToCustomer).toBeLessThan(FLAGSHIP_ORDER.qty);
    pump(w, recv + 5); act(w, { type: 'send_invoice', now: recv + 5 }); pump(w, recv + 5);
    // paid for 6 of 12 delivered (goodwill floor may apply) — revenue is reduced, positive
    expect(w.c.cash.revenue).toBeGreaterThan(0);
    expect(w.c.cash.revenue).toBeLessThan(FLAGSHIP_ORDER.quotedRevenue);
    expect(w.closed).toHaveLength(1);
  });
});

describe('c2c engine — delivery + invoicing + payment', () => {
  it('late delivery: delivering past the deadline applies the late penalty', () => {
    const w = fresh();
    driveToDispatch(w, { qty: 12, supplier: 'standard', rolled: {} });
    act(w, { type: 'dispatch', rework: false, now: 30 });   // ship late
    pump(w, 40);                                            // arrives at 40 > deadline (18)
    expect(w.c.onTime).toBe(false);
    act(w, { type: 'send_invoice', now: 40 }); pump(w, 40);
    expect(w.c.cash.penalties).toBeGreaterThan(0);
    expect(w.c.cash.revenue).toBeLessThan(FLAGSHIP_ORDER.quotedRevenue);
  });

  it('customer rejection: an empty delivery is rejected → no revenue, reputation dips', () => {
    const w = fresh();
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'budget', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    force(w, { supplierOnTime: true, incomingDefectFrac: 1 });
    const recv = receiveAt('budget');
    pump(w, recv);
    act(w, { type: 'resolve_materials', quarantine: 'scrap' });
    act(w, { type: 'run_production' });                     // 0 produced
    pump(w, recv);
    act(w, { type: 'dispatch', rework: false, now: recv });    // ships 0
    pump(w, recv + 5);
    expect(w.c.customerRejected).toBe(true);
    act(w, { type: 'send_invoice', now: recv + 5 }); pump(w, recv + 5);
    expect(w.c.cash.revenue).toBe(0);
    expect(w.rep['Featherstone Rail Yard']).toBeLessThan(0);
  });

  it('payment on delivery: revenue lands as soon as the invoice is sent', () => {
    const w = fresh({ customerTerms: 'on_delivery' });
    driveToDispatch(w, { qty: 12, supplier: 'standard', rolled: {} });
    act(w, { type: 'dispatch', rework: false, now: 7 });
    pump(w, 12);
    act(w, { type: 'send_invoice', now: 12 });
    expect(w.c.t.payDueAt).toBe(12);
    pump(w, 12);                                            // same instant → paid
    expect(w.c.stage).toBe('closed');
    expect(w.c.cash.revenue).toBe(1236);
  });

  it('Net 15 payment: revenue is withheld until the terms fall due', () => {
    const w = fresh({ customerTerms: 'net_15' });
    driveToDispatch(w, { qty: 12, supplier: 'standard', rolled: {} });
    act(w, { type: 'dispatch', rework: false, now: 7 });
    pump(w, 12);
    act(w, { type: 'send_invoice', now: 12 });
    expect(w.c.t.payDueAt).toBe(27);                        // 12 + 15
    pump(w, 20);                                            // before due — not paid
    expect(w.c.did.paid).toBe(false);
    expect(w.c.stage).toBe('paid');
    pump(w, 27);                                            // due → paid → closed
    expect(w.c.did.paid).toBe(true);
    expect(w.c.cash.revenue).toBe(1236);
    expect(w.c.stage).toBe('closed');
  });
});

describe('c2c engine — reload safety at every stage', () => {
  it('serialising + restoring the contract at every stage is lossless and resumable', () => {
    // build a scripted run and snapshot the contract at each distinct stage
    const seen = new Set<string>();
    const w = fresh();
    const snap = () => { if (!seen.has(w.c.stage)) { seen.add(w.c.stage);
      const restored = JSON.parse(JSON.stringify(w.c)) as C2CContract;   // a "refresh"
      expect(restored).toEqual(w.c);
      // a tick on the restored copy must not throw and must respect decision gating
      const r = reduce(restored, { type: 'tick', now: (w.c as any).createdAt });
      expect(r.ok).toBe(true);
    } };
    snap();
    act(w, { type: 'accept_request' }); snap();
    act(w, { type: 'accept_quote' }); snap();
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' }); snap();
    act(w, { type: 'raise_po', now: 0 }); snap();
    force(w, {});
    pump(w, 6); snap();
    pump(w, 7); snap();
    act(w, { type: 'resolve_materials', quarantine: 'hold' }); snap();
    act(w, { type: 'run_production' }); snap();
    pump(w, 7); snap();
    act(w, { type: 'dispatch', rework: false, now: 7 }); snap();
    pump(w, 12); snap();
    act(w, { type: 'send_invoice', now: 12 }); snap();
    pump(w, 12); snap();
    // every stage that occurred was safely round-tripped
    expect(seen.has('closed')).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });
});

describe('c2c engine — duplicate-action protection', () => {
  it('repeating a decision action is a rejected no-op (no double money/inventory)', () => {
    const w = fresh();
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    const coinsAfterPo = w.coins;
    const dup = act(w, { type: 'raise_po', now: 0 });        // duplicate (stage already advanced)
    expect(dup.ok).toBe(false);                              // rejected — no second raise
    expect(w.coins).toBe(coinsAfterPo);                      // no second inbound charge

    force(w, {}); pump(w, receiveAt('standard'));
    act(w, { type: 'resolve_materials', quarantine: 'hold' });
    const dupResolve = act(w, { type: 'resolve_materials', quarantine: 'scrap' });
    expect(dupResolve.ok).toBe(false);
    act(w, { type: 'run_production' });
    const dupProd = act(w, { type: 'run_production' });
    expect(dupProd.ok).toBe(false);
    expect(w.inv.bracket).toBe(12);                          // not produced twice
    pump(w, 7);
    act(w, { type: 'dispatch', rework: false, now: 7 });
    const dupDispatch = act(w, { type: 'dispatch', rework: false, now: 7 });
    expect(dupDispatch.ok).toBe(false);
    expect(w.inv.bracket).toBe(0);                           // not shipped twice
    pump(w, 12);
    act(w, { type: 'send_invoice', now: 12 });
    const coinsBeforePay = w.coins;
    pump(w, 12);                                             // pays once
    const paidCoins = w.coins;
    pump(w, 99);                                             // extra ticks — already closed
    expect(w.coins).toBe(paidCoins);                         // never paid twice
    expect(w.coins).toBe(coinsBeforePay + 1236);
  });

  it('an out-of-order action for a different stage is rejected', () => {
    const w = fresh();
    expect(act(w, { type: 'run_production' }).error).toBe('wrong_stage');
    expect(act(w, { type: 'dispatch', rework: false, now: 0 }).error).toBe('wrong_stage');
    expect(act(w, { type: 'send_invoice', now: 0 }).error).toBe('wrong_stage');
  });
});

describe('c2c engine — determinism + P&L + migration', () => {
  it('seeded rolls are deterministic + reload-stable', () => {
    expect(seededUnit(42, 1)).toBe(seededUnit(42, 1));
    expect(seededUnit(42, 1)).not.toBe(seededUnit(42, 2));
    // same seed → identical full run outcome
    const run = (seed: number) => {
      const c = createContract(FLAGSHIP_ORDER, { id: 'S', seed, now: 0, makeQuality: 0.7 });
      const w = mkWorld(c);
      act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
      act(w, { type: 'select_supplier', offerId: 'budget', qty: 14, deliveryId: 'van' });
      act(w, { type: 'raise_po', now: 0 });
      pump(w, receiveAt('budget'));
      return { accepted: w.c.mat.accepted, quarantined: w.c.mat.quarantined, onTime: w.c.rolled?.supplierOnTime };
    };
    expect(run(999)).toEqual(run(999));
  });

  it('planned P&L reflects the committed PO', () => {
    const w = fresh();
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    const p = plannedPnl(w.c);
    expect(p.revenue).toBe(1200);
    expect(p.materialCost).toBe(12 * 48);
    expect(p.inboundLogistics).toBe(55);
    expect(p.outboundLogistics).toBe(30);
    expect(p.grossProfit).toBe(p.revenue - p.materialCost - p.inboundLogistics - p.productionCost - p.outboundLogistics);
  });

  it('migrateContract fills a minimal/old-shaped save with safe defaults', () => {
    const old: any = { id: 'OLD', orderId: 'flagship_featherstone_rail', stage: 'production', seed: 7,
      order: FLAGSHIP_ORDER, plan: { offerId: 'standard', orderQty: 12, deliveryId: 'van' } };
    const m = migrateContract(old)!;
    expect(m.ver).toBe(C2C_ENGINE_VERSION);
    expect(m.mat).toBeDefined();
    expect(m.fin.produced).toBe(0);
    expect(m.did.produced).toBe(false);
    expect(m.customerTerms).toBe('on_delivery');
    expect(m.t.payDueAt).toBeNull();
    // an unknown stage is coerced to a safe start
    expect(migrateContract({ stage: 'nonsense' })!.stage).toBe('customer_request');
    // garbage → null
    expect(migrateContract(null)).toBeNull();
    // a migrated contract is drivable
    const r = reduce(m, { type: 'run_production' });
    expect(r.ok).toBe(true);
  });

  it('reservedByContract tracks material and finished goods held for the order', () => {
    const w = fresh();
    driveToDispatch(w, { qty: 12, supplier: 'standard', rolled: {} });
    // after production, finished goods are reserved to the contract; material spent
    expect(reservedByContract(w.c, 'bracket')).toBe(12);
    expect(reservedByContract(w.c, 'iron_bar')).toBe(0);
  });
});
