import { describe, it, expect } from 'vitest';
import { primarySource, contractSourceable, orderFromContract, FLAGSHIP_ORDER } from '../src/data/contractToCash.ts';
import { createContract, reduce } from '../src/data/c2cEngine.ts';

describe('board → pipeline order mapping (engine generalisation)', () => {
  it('primarySource picks the material to source from a recipe', () => {
    expect(primarySource({ iron_bar: 1 })).toEqual({ materialItem: 'iron_bar', materialPerUnit: 1 });
    expect(primarySource({ iron_ore: 2 })).toEqual({ materialItem: 'iron_ore', materialPerUnit: 2 });
    // the largest per-unit input wins (the dominant material)
    expect(primarySource({ copper: 1, plastic: 3 })).toEqual({ materialItem: 'plastic', materialPerUnit: 3 });
  });
  it('contractSourceable is false for raw materials (no recipe)', () => {
    expect(contractSourceable(null)).toBe(false);
    expect(contractSourceable(undefined)).toBe(false);
    expect(contractSourceable({})).toBe(false);
    expect(contractSourceable({ iron_bar: 1 })).toBe(true);
  });

  it('orderFromContract maps a board contract onto a valid engine order', () => {
    const bc = { id: 'ct_1', client: 'Valley Rail Maintenance', item: 'gearbox', qty: 5, coins: 900, tier: 'rush' };
    const o = orderFromContract(bc, { materialItem: 'steel_bar', materialPerUnit: 2 }, { productName: 'Gearbox', deadlineMin: 8 });
    expect(o.client).toBe('Valley Rail Maintenance');
    expect(o.productItem).toBe('gearbox');
    expect(o.qty).toBe(5);
    expect(o.quotedRevenue).toBe(900);
    expect(o.materialItem).toBe('steel_bar');
    expect(o.materialPerUnit).toBe(2);
    expect(o.deadlineMin).toBe(8);
    expect(o.warehouseCap).toBeGreaterThanOrEqual(5 * 2);   // fits the material order
    // the mechanical chain fields inherit sane defaults from the base order
    expect(o.latePenaltyPct).toBe(FLAGSHIP_ORDER.latePenaltyPct);
    expect(o.reworkCostPerUnit).toBe(FLAGSHIP_ORDER.reworkCostPerUnit);
  });

  it('a mapped order runs through the engine like any other (different material + product)', () => {
    const bc = { id: 'ct_2', client: 'Dockside Repair Guild', item: 'gearbox', qty: 4, coins: 800, tier: 'standard' };
    const order = orderFromContract(bc, { materialItem: 'steel_bar', materialPerUnit: 2 }, { productName: 'Gearbox', deadlineMin: 20 });
    let c = createContract(order, { id: 'C', seed: 5, now: 0, makeQuality: 1, customerTerms: 'on_delivery' });
    // drive the decision path; the engine sources steel_bar and produces gearbox
    c = reduce(c, { type: 'accept_request' }).contract;
    c = reduce(c, { type: 'accept_quote' }).contract;
    c = reduce(c, { type: 'select_supplier', offerId: 'standard', qty: 8, deliveryId: 'van' }).contract;
    const po = reduce(c, { type: 'raise_po', now: 0 });
    c = po.contract;
    // the goods-received movement is for the CONTRACT's material, not iron_bar
    c.rolled = { supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0, makeDefectFrac: 0, reworkShare: 0.6 };
    for (let n = 0; n < 6; n++) c = reduce(c, { type: 'tick', now: 7 }).contract;
    expect(c.stage).toBe('materials_accepted_or_quarantined');
    const recv = reduce(c, { type: 'tick', now: 7 });   // no-op (decision stage)
    expect(recv.changed).toBe(false);
    c = reduce(c, { type: 'resolve_materials', quarantine: 'hold' }).contract;
    const prod = reduce(c, { type: 'run_production' });
    // production emits real movements for steel_bar (consume) + gearbox (create)
    const items = prod.effects.filter(e => e.kind === 'inv_remove' || e.kind === 'inv_add').map(e => (e as any).item);
    expect(items).toContain('steel_bar');
    expect(items).toContain('gearbox');
    expect(prod.contract.fin.produced).toBe(4);
  });
});
