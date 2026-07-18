import { describe, it, expect } from 'vitest';
import { FURNITURE, furnitureDef, defaultColor, rotatedSize, footprintCells, canPlace, migratePlacement, GRID } from '../src/data/furniture.ts';
import { isTradeFurniture, isPlaceableItem, TRADE_FURNITURE } from '../src/data/itemTax.ts';

// A tiny stand-in for main.ts's warehouse↔furniture bridge so the conservation
// invariant (warehouse + storage + placed is constant) is verified deterministically.
interface World { warehouse: Record<string, number>; storage: Record<string, number>; placed: any[]; }
const exitCells = [{ x: 3, y: GRID.rows - 1 }, { x: 4, y: GRID.rows - 1 }];
const opts = (placed: any[], exclude = -1) => ({ placed: placed.filter((_, i) => i !== exclude), exitCells });
function avail(w: World, id: string){ return isTradeFurniture(id) ? (w.warehouse[id] || 0) : (w.storage[id] || 0); }
function take(w: World, id: string){ if (isTradeFurniture(id)) w.warehouse[id] = Math.max(0, (w.warehouse[id]||0) - 1); else w.storage[id] = Math.max(0, (w.storage[id]||0) - 1); }
function give(w: World, id: string){ if (isTradeFurniture(id)) w.warehouse[id] = (w.warehouse[id]||0) + 1; else w.storage[id] = (w.storage[id]||0) + 1; }
function place(w: World, id: string, gx: number, gy: number, rot = 0){
  if (avail(w, id) < 1) return { ok: false, reason: 'none' };
  const chk = canPlace(id, gx, gy, rot, opts(w.placed));
  if (!chk.ok) return chk;
  take(w, id); w.placed.push({ id, gx, gy, rot, color: defaultColor(id), placedAt: Date.now() });
  return { ok: true, reason: 'ok' };
}
function store(w: World, idx: number){ const p = w.placed[idx]; if (!p) return; give(w, p.id); w.placed.splice(idx, 1); }
const total = (w: World, id: string) => (w.warehouse[id]||0) + (w.storage[id]||0) + w.placed.filter(p => p.id === id).length;

describe('furniture placement + warehouse reconciliation', () => {
  it("Finn's Table Lamp is placeable and consumes from the warehouse", () => {
    const w: World = { warehouse: { lamp: 2 }, storage: {}, placed: [] };
    expect(isPlaceableItem('lamp')).toBe(true);
    expect(furnitureDef('lamp')).toBeTruthy();
    const before = total(w, 'lamp');
    expect(place(w, 'lamp', 1, 1).ok).toBe(true);
    expect(w.warehouse.lamp).toBe(1);              // came out of the warehouse
    expect(w.placed).toHaveLength(1);
    expect(total(w, 'lamp')).toBe(before);         // conserved
  });

  it('placing then storing conserves the total across both pools', () => {
    const w: World = { warehouse: { bookcase: 1 }, storage: { furn_chair: 1 }, placed: [] };
    const t0 = { bookcase: total(w, 'bookcase'), chair: total(w, 'furn_chair') };
    place(w, 'bookcase', 0, 0);                    // bookcase is a wall item → back row
    place(w, 'furn_chair', 2, 2);
    expect(w.placed).toHaveLength(2);
    store(w, 0); store(w, 0);                      // put both back
    expect(w.placed).toHaveLength(0);
    expect(w.warehouse.bookcase).toBe(1);          // homeware back in the warehouse
    expect(w.storage.furn_chair).toBe(1);          // shop piece back in storage
    expect(total(w, 'bookcase')).toBe(t0.bookcase);
    expect(total(w, 'furn_chair')).toBe(t0.chair);
  });

  it('rejects invalid squares (overlap and the exit) and does not consume stock', () => {
    const w: World = { warehouse: { lamp: 3 }, storage: {}, placed: [] };
    expect(place(w, 'lamp', 1, 1).ok).toBe(true);
    const held = w.warehouse.lamp;
    expect(place(w, 'lamp', 1, 1).reason).toBe('blocked');     // overlap
    expect(place(w, 'lamp', 3, GRID.rows - 1).reason).toBe('exit');
    expect(w.warehouse.lamp).toBe(held);                        // nothing consumed on a rejected place
    expect(w.placed).toHaveLength(1);
  });

  it("a wall item (bookcase/painting) must sit on the back wall", () => {
    const w: World = { warehouse: { painting: 1 }, storage: {}, placed: [] };
    expect(place(w, 'painting', 2, 2).reason).toBe('wall');    // not on the back row
    expect(place(w, 'painting', 2, 0).ok).toBe(true);          // back row ok
  });

  it('rotation swaps the footprint of the fancy rug', () => {
    const d = furnitureDef('fancy_rug')!;
    expect(d.rotates).toBe(true);
    expect(rotatedSize(d.fw, d.fd, 0)).toEqual({ w: 3, d: 2 });
    expect(rotatedSize(d.fw, d.fd, 90)).toEqual({ w: 2, d: 3 });
    expect(footprintCells('fancy_rug', 0, 0, 0)).toHaveLength(6);
  });

  it('every trade-furniture piece exposes style/colour choices', () => {
    for (const id of TRADE_FURNITURE) expect(furnitureDef(id)!.colors.length).toBeGreaterThanOrEqual(1);
    expect(furnitureDef('fancy_rug')!.colors.length).toBeGreaterThan(1);   // real style choice
  });

  it('a placement survives a reload round-trip (plain-JSON serialisable)', () => {
    const w: World = { warehouse: { lamp: 1 }, storage: {}, placed: [] };
    place(w, 'lamp', 5, 1, 0);
    const roundTrip = JSON.parse(JSON.stringify(w.placed));
    expect(roundTrip).toEqual(w.placed);
    expect(furnitureDef(roundTrip[0].id)).toBeTruthy();        // still resolvable after reload
  });
});
