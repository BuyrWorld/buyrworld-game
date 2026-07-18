import { describe, it, expect } from 'vitest';
import { createContract, reduce, actualPnl, reservedByContract, type C2CContract, type C2CAction, type C2CEffect } from '../src/data/c2cEngine.ts';
import { FLAGSHIP_ORDER } from '../src/data/contractToCash.ts';

interface World { inv: Record<string, number>; reserved: Record<string, number>; coins: number; seen: Record<string, boolean>; c: C2CContract; }
function mk(startBars = 0): World {
  const w: World = { inv: {}, reserved: {}, coins: 5000, seen: {}, c: createContract(FLAGSHIP_ORDER, { id: 'S', seed: 3, now: 0, makeQuality: 1, customerTerms: 'on_delivery' }) };
  if (startBars) w.inv.iron_bar = startBars;
  return w;
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
function pump(w: World, now: number) { for (let i = 0; i < 60; i++) { const r = reduce(w.c, { type: 'tick', now }); if (!r.changed) break; w.c = r.contract; r.effects.forEach(e => apply(w, e)); } }

describe('sourcing: gather + expedited inbound (real inventory + reconciliation)', () => {
  it('gathering your own stock buys less, moves real inbound stock, and reconciles cash', () => {
    const w = mk(6);   // you already hold 6 iron_bars (gathered)
    const c0 = w.coins;
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 6, deliveryId: 'van' });   // buy the other 6
    act(w, { type: 'set_sourcing', gatherQty: 6, mode: 'standard' });
    act(w, { type: 'raise_po', now: 0 });
    expect(w.reserved.iron_bar).toBe(6);                 // gathered stock reserved to the order
    w.c.rolled = { supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0, makeDefectFrac: 0, reworkShare: 0.6 };
    pump(w, 8);
    // only the BOUGHT 6 are a new inbound movement; total on hand = 12
    expect(w.c.mat.delivered).toBe(6);
    expect(w.c.mat.gathered).toBe(6);
    expect(w.c.mat.received).toBe(12);
    expect(w.inv.iron_bar).toBe(12);                     // 6 gathered + 6 bought
    expect(w.reserved.iron_bar).toBe(12);
    expect(w.c.mat.accepted).toBe(12);
    // material cost is for the 6 BOUGHT only (gathered is free)
    expect(actualPnl(w.c).materialCost).toBe(6 * 48);
    // finish and reconcile: final coins delta == the result's gross profit
    act(w, { type: 'resolve_materials', quarantine: 'hold' });
    act(w, { type: 'run_production' }); pump(w, 8);
    expect(w.inv.iron_bar).toBe(0);                      // both gathered + bought consumed
    expect(w.inv.bracket).toBe(12);
    expect(reservedByContract(w.c, 'iron_bar')).toBe(0);
    act(w, { type: 'dispatch', rework: false, now: 8 }); pump(w, 14);
    act(w, { type: 'send_invoice', now: 14 }); pump(w, 16);
    expect(w.c.stage).toBe('closed');
    expect(w.coins - c0).toBe(actualPnl(w.c).grossProfit);   // cash reconciles exactly
    expect(w.reserved.iron_bar || 0).toBe(0);
    expect(w.reserved.bracket || 0).toBe(0);
  });

  it('gathering reduces incoming defects — only bought bars can be defective', () => {
    // half gathered (clean), half bought from a poor-quality supplier
    const w = mk(6);
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'budget', qty: 6, deliveryId: 'van' });
    act(w, { type: 'set_sourcing', gatherQty: 6, mode: 'standard' });
    act(w, { type: 'raise_po', now: 0 });
    w.c.rolled = { supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0.5, makeDefectFrac: 0, reworkShare: 0.6 };
    pump(w, 14);
    // 50% defect rate applies to the 6 bought only → 3 quarantined, not 6
    expect(w.c.mat.quarantined).toBe(3);
    expect(w.c.mat.accepted).toBe(12 - 3);
  });

  it('expedited inbound halves the lead and raises freight (materials unchanged)', () => {
    const std = mk(); const exp = mk();
    for (const w of [std, exp]) {
      act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
      act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    }
    act(exp, { type: 'set_sourcing', gatherQty: 0, mode: 'expedited' });
    act(std, { type: 'raise_po', now: 0 });
    act(exp, { type: 'raise_po', now: 0 });
    expect(exp.c.po!.promisedLeadMin).toBeLessThan(std.c.po!.promisedLeadMin);   // ~half
    expect(exp.c.cash.inboundPaid).toBeGreaterThan(std.c.cash.inboundPaid);      // rush freight
    expect(exp.c.po!.qty).toBe(std.c.po!.qty);                                   // materials unchanged
  });

  it('set_sourcing is rejected once the PO is raised (no double-commit)', () => {
    const w = mk();
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    expect(act(w, { type: 'set_sourcing', gatherQty: 4, mode: 'expedited' }).ok).toBe(false);
  });
});
