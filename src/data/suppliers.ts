// M17 — Procurement & Supplier System. The spot market (trader stalls) sells
// instantly at a volatile price; procurement is the buyer's other lever: commit a
// purchase order to a supplier at a FIXED contract price and take delivery over
// time, trading off unit cost vs lead time vs reliability vs minimum order size.
// Pure/testable here; the order book, timers and Post Office UI live in main.ts.

export interface Supplier {
  id: string;
  n: string;
  ic: string;
  blurb: string;
  items: string[];       // item ids this supplier can source
  priceMult: number;     // fixed unit price = round(baseValue * priceMult)
  leadMin: number;       // real minutes until delivery
  reliability: number;   // 0..1 chance of a full, on-time delivery
  moq: number;           // minimum order quantity
  bulkBreak: number;     // order this many+ for a discount (0 = none)
  bulkDiscount: number;  // fractional discount at/above the break
  unlockLvl: number;     // total-level gate
}

export const SUPPLIERS: Supplier[] = [
  { id:'cutprice', n:'Cutprice Metals Co.', ic:'🏷️',
    blurb:'Rock-bottom prices — if the lorry shows up.',
    items:['iron_ore','copper_ore','coal'],
    priceMult:0.90, leadMin:12, reliability:0.72, moq:10, bulkBreak:0, bulkDiscount:0, unlockLvl:1 },
  { id:'foundry', n:'Featherstone Foundry Supplies', ic:'🏭',
    blurb:'The dependable local yard. Fair prices, steady service.',
    items:['iron_ore','copper_ore','coal','bauxite','wood'],
    priceMult:1.05, leadMin:6, reliability:0.90, moq:4, bulkBreak:0, bulkDiscount:0, unlockLvl:1 },
  { id:'coastal', n:'Coastal Bulk Traders', ic:'🚢',
    blurb:'Buy big and the unit price drops — but it comes by slow boat.',
    items:['iron_ore','copper_ore','coal','wood','bauxite'],
    priceMult:1.00, leadMin:10, reliability:0.85, moq:8, bulkBreak:20, bulkDiscount:0.18, unlockLvl:1 },
  { id:'rapid', n:'Rapid Rail Freight', ic:'🚄',
    blurb:'Premium express — pay for speed and near-certain delivery.',
    items:['iron_ore','coal','bauxite','rare_earth'],
    priceMult:1.30, leadMin:2, reliability:0.98, moq:2, bulkBreak:0, bulkDiscount:0, unlockLvl:20 },
];

export function supplierById(id: string): Supplier | null {
  return SUPPLIERS.find(s => s.id === id) || null;
}

// Suppliers that can source `item` and are unlocked at the player's total level.
export function suppliersFor(item: string, totalLevel: number): Supplier[] {
  return SUPPLIERS.filter(s => s.items.includes(item) && (totalLevel || 0) >= s.unlockLvl);
}

export interface Quote {
  unit: number;        // per-unit price actually charged
  listUnit: number;    // per-unit before any bulk discount
  discounted: boolean;
  total: number;
  etaMin: number;
  moq: number;
  moqOk: boolean;
}

// Price a prospective order. `baseValue` is the item's base value (ITEMS[it].v).
export function supplierQuote(sup: Supplier, qty: number, baseValue: number): Quote {
  const listUnit = Math.max(1, Math.round((baseValue || 1) * sup.priceMult));
  const discounted = sup.bulkBreak > 0 && qty >= sup.bulkBreak;
  const unit = discounted ? Math.max(1, Math.round(listUnit * (1 - sup.bulkDiscount))) : listUnit;
  return {
    unit, listUnit, discounted,
    total: unit * Math.max(0, qty | 0),
    etaMin: sup.leadMin,
    moq: sup.moq,
    moqOk: (qty | 0) >= sup.moq,
  };
}

export interface DeliveryOutcome { onTime: boolean; delivered: number; shortfall: number; }

// Resolve a delivery. A reliable supplier delivers in full; an unreliable one
// occasionally short-ships (the caller refunds the shortfall). Deterministic
// under a seeded rng so it can be unit-tested.
export function rollDelivery(sup: Supplier, qty: number, rng: () => number = Math.random): DeliveryOutcome {
  const q = Math.max(0, qty | 0);
  if (rng() <= sup.reliability) return { onTime: true, delivered: q, shortfall: 0 };
  const frac = 0.55 + rng() * 0.35;                 // 55%–90% arrives
  const delivered = Math.max(1, Math.floor(q * frac));
  return { onTime: false, delivered, shortfall: q - delivered };
}

export function reliabilityLabel(r: number): string {
  if (r >= 0.95) return 'Rock-solid';
  if (r >= 0.85) return 'Reliable';
  if (r >= 0.75) return 'Fair';
  return 'Flaky';
}

// 1–4 filled stars for a reliability rating.
export function reliabilityStars(r: number): number {
  if (r >= 0.95) return 4;
  if (r >= 0.85) return 3;
  if (r >= 0.75) return 2;
  return 1;
}
