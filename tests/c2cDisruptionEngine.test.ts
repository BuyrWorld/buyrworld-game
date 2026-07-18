import { describe, it, expect } from 'vitest';
import { createContract, reduce, actualPnl, type C2CContract, type C2CAction, type C2CEffect } from '../src/data/c2cEngine.ts';
import { FLAGSHIP_ORDER } from '../src/data/contractToCash.ts';
import type { DisruptionId, BatchMode } from '../src/data/disruptions.ts';

interface World { inv: Record<string, number>; reserved: Record<string, number>; coins: number; seen: Record<string, boolean>; c: C2CContract; }
function mk(disruption: DisruptionId | null = null): World {
  return { inv: {}, reserved: {}, coins: 6000, seen: {}, c: createContract(FLAGSHIP_ORDER, { id: 'D', seed: 3, now: 0, makeQuality: 0.9, customerTerms: 'on_delivery', disruption }) };
}
function apply(w: World, e: C2CEffect) {
  if (e.kind === 'inv_add') w.inv[e.item] = (w.inv[e.item] || 0) + e.qty;
  else if (e.kind === 'inv_remove') w.inv[e.item] = Math.max(0, (w.inv[e.item] || 0) - e.qty);
  else if (e.kind === 'reserve') w.reserved[e.item] = (w.reserved[e.item] || 0) + e.qty;
  else if (e.kind === 'release') w.reserved[e.item] = Math.max(0, (w.reserved[e.item] || 0) - e.qty);
  else if (e.kind === 'debit') { if (!w.seen[e.key]) { w.coins -= e.amount; w.seen[e.key] = true; } }
  else if (e.kind === 'credit') { if (!w.seen[e.key]) { w.coins += e.amount; w.seen[e.key] = true; } }
}
function act(w: World, a: C2CAction) { const r = reduce(w.c, a); if (r.ok) { w.c = r.contract; r.effects.forEach(e => apply(w, e)); } return r; }
function pump(w: World, now: number) { for (let i = 0; i < 80; i++) { const r = reduce(w.c, { type: 'tick', now }); if (!r.changed) break; w.c = r.contract; r.effects.forEach(e => apply(w, e)); } }
// Drive to the goods-in decision with clean supplier rolls (isolate the disruption).
function toMaterials(w: World, supplier = 'standard', qty = 14) {
  act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
  act(w, { type: 'select_supplier', offerId: supplier, qty, deliveryId: 'van' });
  act(w, { type: 'raise_po', now: 0 });
  w.c.rolled = { supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0, makeDefectFrac: 0.05, reworkShare: 0.6 };
  pump(w, 40);
}

describe('disruptions — each type has a distinct, deterministic effect', () => {
  it('supplier_delay adds lead time', () => {
    const base = mk(null), del = mk('supplier_delay');
    for (const w of [base, del]) { act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' }); act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' }); act(w, { type: 'raise_po', now: 0 }); }
    expect(del.c.t.supplierReadyAt!).toBe(base.c.t.supplierReadyAt! + 4);
  });
  it('expedite_request tightens the deadline', () => {
    expect(mk('expedite_request').c.deadlineAt).toBeLessThan(mk(null).c.deadlineAt);
  });
  it('defective_materials raises the quarantined count', () => {
    // let the engine roll (the disruption adds to the incoming-defect fraction in
    // rollAll); same seed + supplier → same delivery, so only the disruption differs.
    const clean = mk(null), bad = mk('defective_materials');
    for (const w of [clean, bad]) {
      act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
      act(w, { type: 'select_supplier', offerId: 'premium', qty: 14, deliveryId: 'van' });
      act(w, { type: 'raise_po', now: 0 });
      pump(w, 40);
    }
    expect(bad.c.mat.delivered).toBe(clean.c.mat.delivered);          // identical delivery
    expect(bad.c.mat.quarantined).toBeGreaterThan(clean.c.mat.quarantined);
  });
  it('partial_shortage forces a shortfall even when the supplier is "on time"', () => {
    const w = mk('partial_shortage');
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    w.c.rolled = { supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0, makeDefectFrac: 0, reworkShare: 0.6 };
    pump(w, 40);
    expect(w.c.mat.shortfall).toBeGreaterThan(0);   // 0.25 × 12 = 3
    expect(w.c.mat.delivered).toBeLessThan(12);
  });
  it('machine_slowdown makes production take longer', () => {
    const fast = mk(null), slow = mk('machine_slowdown');
    for (const w of [fast, slow]) { toMaterials(w); act(w, { type: 'resolve_materials', quarantine: 'hold' }); act(w, { type: 'run_production', now: 20 }); }
    expect(slow.c.t.productionReadyAt!).toBeGreaterThan(fast.c.t.productionReadyAt!);
  });
});

describe('batch strategies produce different quality/time outcomes', () => {
  function runBatch(mode: BatchMode) {
    const w = mk(null);
    toMaterials(w);
    act(w, { type: 'resolve_materials', quarantine: 'hold' });
    act(w, { type: 'run_production', mode, now: 20 });
    pump(w, 200);   // wait out the (possibly long) careful batch
    return w.c;
  }
  it('fast makes more defects than careful; standard sits between', () => {
    const fast = runBatch('fast'), std = runBatch('standard'), careful = runBatch('careful');
    const defects = (c: C2CContract) => c.fin.scrapped + c.fin.reworkable;
    expect(defects(fast)).toBeGreaterThanOrEqual(defects(std));
    expect(defects(careful)).toBeLessThanOrEqual(defects(std));
    expect(defects(fast)).toBeGreaterThan(defects(careful));
    // careful takes longer than fast on the clock
    expect(careful.t.productionReadyAt!).toBeGreaterThan(fast.t.productionReadyAt!);
  });
});

describe('reconciliation + no defect reuse, WITH a disruption', () => {
  it('stock, cost and quality reconcile and scrapped units never come back', () => {
    const w = mk('defective_materials');
    const c0 = w.coins;
    toMaterials(w, 'budget', 16);
    // rework the quarantined so we can produce, then a fast batch to create scrap
    act(w, { type: 'resolve_materials', quarantine: 'rework' });
    const madeInv = w.inv.iron_bar;
    act(w, { type: 'run_production', mode: 'fast', now: 20 });
    pump(w, 60);
    const scrapped = w.c.fin.scrapped, reworkable = w.c.fin.reworkable;
    // scrapped finished goods left inventory — you can't ship or reuse them
    expect(w.inv.bracket).toBe(w.c.fin.produced - scrapped);
    act(w, { type: 'dispatch', rework: false, now: 60 });
    // only GOOD units ship; scrapped are gone, un-reworked reworkable stay as your
    // stock — a defect can never be delivered or duplicated.
    expect(w.c.fin.deliveredToCustomer).toBe(w.c.fin.good);
    expect(w.inv.bracket).toBe(reworkable);              // leftover reworkable, never the scrapped
    pump(w, 70); act(w, { type: 'send_invoice', now: 70 }); pump(w, 80);
    expect(w.c.stage).toBe('closed');
    expect(w.coins - c0).toBe(actualPnl(w.c).grossProfit);   // cash reconciles exactly
    expect(w.reserved.iron_bar || 0).toBe(0);
    expect(w.reserved.bracket || 0).toBe(0);
  });
});
