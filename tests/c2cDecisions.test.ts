import { describe, it, expect } from 'vitest';
import {
  createContract, reduce, scenarioById, C2C_SCENARIOS, satisfactionOf, isInFull,
  type C2CContract, type C2CAction, type C2CEffect,
} from '../src/data/c2cEngine.ts';
import { FLAGSHIP_ORDER } from '../src/data/contractToCash.ts';

interface World { inv: Record<string, number>; reserved: Record<string, number>; coins: number; seen: Record<string, boolean>; c: C2CContract; }
function mk(overrides: Partial<C2CContract['order']> = {}, terms: any = 'on_delivery'): World {
  const order = Object.assign({}, FLAGSHIP_ORDER, overrides);
  return { inv: {}, reserved: {}, coins: 5000, seen: {}, c: createContract(order, { id: 'T', seed: 7, now: 0, makeQuality: 0.9, customerTerms: terms }) };
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
function toMaterials(w: World, rolled: any, supplier = 'standard', qty = 12) {
  act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
  act(w, { type: 'select_supplier', offerId: supplier, qty, deliveryId: 'van' });
  act(w, { type: 'raise_po', now: 0 });
  w.c.rolled = Object.assign({ supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0, makeDefectFrac: 0, reworkShare: 0.6 }, rolled);
  pump(w, 20);
}

describe('supplier intervention (req 5)', () => {
  it('expedite pays a fee and halves the remaining lead — once', () => {
    const w = mk();
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    const readyBefore = w.c.t.supplierReadyAt;                 // 0 + lead 6
    const coinsBefore = w.coins;
    const r = act(w, { type: 'intervene', kind: 'expedite', now: 0 });
    expect(r.ok).toBe(true);
    expect(w.c.t.supplierReadyAt).toBeLessThan(readyBefore!);   // fast-tracked
    expect(w.coins).toBeLessThan(coinsBefore);                  // paid a surcharge
    expect(act(w, { type: 'intervene', kind: 'expedite', now: 0 }).ok).toBe(false);   // once only
  });
  it('chase trims the lead for free, once', () => {
    const w = mk();
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    const readyBefore = w.c.t.supplierReadyAt!;
    const coinsBefore = w.coins;
    act(w, { type: 'intervene', kind: 'chase', now: 0 });
    expect(w.c.t.supplierReadyAt).toBe(readyBefore - 1);
    expect(w.coins).toBe(coinsBefore);                          // free
    expect(act(w, { type: 'intervene', kind: 'chase', now: 0 }).ok).toBe(false);
  });
  it('wait is a valid no-op', () => {
    const w = mk();
    act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
    act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    act(w, { type: 'raise_po', now: 0 });
    const r = act(w, { type: 'intervene', kind: 'wait', now: 0 });
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(false);
  });
});

describe('goods-in QC decisions (req 7)', () => {
  it('inspect reveals the defect count', () => {
    const w = mk();
    toMaterials(w, { incomingDefectFrac: 0.25 });
    expect(w.c.inspected).toBeFalsy();
    act(w, { type: 'inspect' });
    expect(w.c.inspected).toBe(true);
    expect(act(w, { type: 'inspect' }).ok).toBe(false);        // once
  });
  it('accept-all keeps the defective bars but raises the finished defect rate', () => {
    const safe = mk(); toMaterials(safe, { incomingDefectFrac: 0.25, makeDefectFrac: 0.05 });
    act(safe, { type: 'resolve_materials', quarantine: 'hold' });   // use only good
    act(safe, { type: 'run_production' }); pump(safe, 25);
    const risky = mk(); toMaterials(risky, { incomingDefectFrac: 0.25, makeDefectFrac: 0.05 });
    act(risky, { type: 'resolve_materials', quarantine: 'accept' });  // keep them all
    expect(risky.c.mat.defectiveAccepted).toBe(3);
    act(risky, { type: 'run_production' }); pump(risky, 25);
    // accepting the bad bars produced MORE finished defects than the safe route
    const riskyDefects = risky.c.fin.scrapped + risky.c.fin.reworkable;
    const safeDefects = safe.c.fin.scrapped + safe.c.fin.reworkable;
    expect(riskyDefects).toBeGreaterThan(safeDefects);
    // but it also made more units (used all 12 bars, not just 9)
    expect(risky.c.fin.produced).toBeGreaterThan(safe.c.fin.produced);
  });
  it('reject scraps the whole batch, refunds part of the cost, leaves nothing to make', () => {
    const w = mk();
    toMaterials(w, { incomingDefectFrac: 0.4 });
    const coinsBefore = w.coins;
    act(w, { type: 'resolve_materials', quarantine: 'reject' });
    expect(w.inv.iron_bar).toBe(0);                            // all returned/scrapped
    expect(w.coins).toBeGreaterThan(coinsBefore);              // goodwill refund
    act(w, { type: 'run_production' });
    expect(w.c.fin.produced).toBe(0);
  });
});

describe('failure recovery (req 11)', () => {
  it('extend_deadline pushes the deadline so a late order lands on time (fee + satisfaction hit)', () => {
    const w = mk();
    toMaterials(w, {});
    act(w, { type: 'resolve_materials', quarantine: 'hold' });
    act(w, { type: 'run_production' }); pump(w, 25);
    expect(w.c.stage).toBe('dispatch_decision');
    const coinsBefore = w.coins;
    const lateNow = w.c.deadlineAt + 5;                        // we're already past the deadline
    act(w, { type: 'extend_deadline', now: lateNow });
    expect(w.c.deadlineAt).toBeGreaterThan(lateNow);           // grace granted
    expect(w.coins).toBeLessThan(coinsBefore);                 // a service fee
    expect(w.c.extended).toBe(true);
    act(w, { type: 'dispatch', rework: false, now: lateNow });
    pump(w, lateNow + 6);
    expect(w.c.onTime).toBe(true);                             // delivered within the extended deadline
    expect(satisfactionOf(w.c)).toBeLessThan(100);             // the client still noticed
  });
});

describe('deterministic scenarios (req: seeded, replayable)', () => {
  it('exposes at least four named scenarios', () => {
    expect(C2C_SCENARIOS.length).toBeGreaterThanOrEqual(4);
    expect(scenarioById('trailer')).toBeTruthy();
    expect(scenarioById('nope')).toBeNull();
  });
  it('a scenario plays out identically every time', () => {
    const run = () => {
      const scn = scenarioById('quality_crisis')!;
      const w = mk(scn.orderOverrides || {});
      w.c.rolled = { ...scn.rolled };
      act(w, { type: 'accept_request' }); act(w, { type: 'accept_quote' });
      act(w, { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
      act(w, { type: 'raise_po', now: 0 });
      pump(w, 20);
      return { accepted: w.c.mat.accepted, quarantined: w.c.mat.quarantined };
    };
    expect(run()).toEqual(run());
  });
});
