// ============================================================================
// CONTRACT-TO-CASH — one authored, fully-connected commercial order.
// ----------------------------------------------------------------------------
// A single flagship post-tutorial order that walks the whole business pipeline:
//   customer request → quotation → supplier comparison → purchase order →
//   inbound delivery → goods receipt → quality inspection → production →
//   finished-goods quality → delivery planning → customer delivery → invoice →
//   payment → realised margin.
//
// This module is the PURE, testable heart: the authored order, the (≤3) supplier
// offers, the delivery options, the planned-margin preview, and the realised
// profit-and-loss after outcomes (late / defective / expensive) — plus a
// safe-recovery floor so a poor decision teaches rather than destroys the save.
// No DOM, no game state. main.ts renders the guided flow and applies the wallet
// + reputation results.
// ============================================================================

// ---- The authored order ---------------------------------------------------
export interface FlagshipOrder {
  id: string;
  client: string;
  productName: string;      // finished good the customer wants
  productItem: string;      // finished-good item id (bracket — reuses the tutorial chain)
  qty: number;              // finished units required
  materialItem: string;     // input material to source (iron_bar)
  materialPerUnit: number;  // input units per finished unit
  quotedRevenue: number;    // headline price agreed with the customer
  deadlineMin: number;      // minutes allowed, request → customer delivery
  warehouseCap: number;     // how many material units the warehouse can hold at once
  productionMin: number;    // minutes to make the goods once materials are in
  latePenaltyPct: number;   // fraction of revenue lost if delivered late
  defectValuePct: number;   // fraction of revenue lost per defective finished unit (quality → value)
  reworkCostPerUnit: number;// coins to rework/scrap a defective unit (quality cost)
}

// The one authored order. Values are tuned so a good plan clears a healthy margin
// and a careless one can slip into a (survivable) loss.
export const FLAGSHIP_ORDER: FlagshipOrder = {
  id: 'flagship_featherstone_rail',
  client: 'Featherstone Rail Yard',
  productName: 'Rail Brackets',
  productItem: 'bracket',
  qty: 12,
  materialItem: 'iron_bar',
  materialPerUnit: 1,
  quotedRevenue: 1200,
  deadlineMin: 18,
  warehouseCap: 20,
  productionMin: 4,
  latePenaltyPct: 0.25,
  defectValuePct: 0.05,     // each defective unit knocks 5% off the agreed price
  reworkCostPerUnit: 18,
};

// ---- Per-order variation --------------------------------------------------
// So a REPEATED order feels fresh: a seeded roll picks a client + varies the
// quantity, deadline and revenue within tuned bounds. Deterministic (a given seed
// always yields the same order) so it is testable and reload-safe. The mechanical
// chain (bracket product, iron-bar material, penalties, rework) is unchanged.
export interface FlagshipVariant { client: string; productName: string; unitRevenue: number; }
export const FLAGSHIP_VARIANTS: FlagshipVariant[] = [
  { client: 'Featherstone Rail Yard',  productName: 'Rail Brackets',      unitRevenue: 100 },
  { client: 'Port Salvo Shipworks',    productName: 'Deck Brackets',      unitRevenue: 108 },
  { client: 'Ironbridge Freight Depot',productName: 'Chassis Brackets',   unitRevenue: 96  },
  { client: 'Hollow Pine Sawmill',     productName: 'Mill Brackets',      unitRevenue: 104 },
  { client: 'Kestrel Aerodrome',       productName: 'Airframe Brackets',  unitRevenue: 114 },
];

function _c2cRng(seed: number){
  let a = seed >>> 0;
  return function(){ a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- Generalisation: run ANY standard board contract through the engine ------
// A board contract only carries {client, item, qty, coins, tier}. To fulfil it via
// the source-to-cash pipeline we map it onto a FlagshipOrder: the finished item is
// the product, and the primary recipe input becomes the material to source. Items
// with no recipe (raw materials) aren't pipeline-fulfillable.
export interface BoardContractLike { id?: string; client: string; item: string; qty: number; coins: number; tier?: string; }
export interface SourceInfo { materialItem: string; materialPerUnit: number; }

/** Pick the primary source material from a recipe's inputs (the largest per-unit
 *  requirement; ties resolve to the first). Null when there is no recipe. */
export function primarySource(inputs: Record<string, number> | null | undefined): SourceInfo | null {
  if (!inputs || typeof inputs !== 'object') return null;
  const keys = Object.keys(inputs);
  if (!keys.length) return null;
  let best = keys[0];
  for (const k of keys) if ((inputs[k] || 0) > (inputs[best] || 0)) best = k;
  return { materialItem: best, materialPerUnit: Math.max(1, inputs[best] | 0) };
}

/** True when a contract's item can be produced from a material (has a recipe). */
export function contractSourceable(inputs: Record<string, number> | null | undefined): boolean {
  return primarySource(inputs) != null;
}

/** Build an engine order from a board contract + its resolved source material. */
export function orderFromContract(c: BoardContractLike, src: SourceInfo, opts: { productName?: string; deadlineMin: number }): FlagshipOrder {
  const material = Math.max(1, c.qty) * src.materialPerUnit;
  return {
    ...FLAGSHIP_ORDER,
    id: 'c2c_board_' + (c.id || (c.client + '_' + c.item)),
    client: c.client,
    productName: opts.productName || c.item,
    productItem: c.item,
    qty: Math.max(1, c.qty | 0),
    materialItem: src.materialItem,
    materialPerUnit: src.materialPerUnit,
    quotedRevenue: Math.max(1, c.coins | 0),
    deadlineMin: opts.deadlineMin,
    warehouseCap: Math.max(FLAGSHIP_ORDER.warehouseCap, material + 6),
  };
}

/** Roll a fresh flagship order from `seed` — a different client, order size,
 *  deadline and price each time, all within tuned, always-valid bounds. */
export function rollFlagshipOrder(seed: number): FlagshipOrder {
  const r = _c2cRng(seed);
  const v = FLAGSHIP_VARIANTS[Math.floor(r() * FLAGSHIP_VARIANTS.length) % FLAGSHIP_VARIANTS.length];
  const qty = 8 + Math.floor(r() * 9);                 // 8..16 finished units
  const deadlineMin = 15 + Math.floor(r() * 8);        // 15..22 min of pipeline time
  const quotedRevenue = Math.round(qty * v.unitRevenue * (0.96 + r() * 0.1));   // ± a little market noise
  return {
    ...FLAGSHIP_ORDER,
    id: 'flagship_' + (seed >>> 0).toString(36),
    client: v.client,
    productName: v.productName,
    qty,
    quotedRevenue,
    deadlineMin,
    warehouseCap: Math.max(FLAGSHIP_ORDER.warehouseCap, qty + 6),   // always fits the order
  };
}

// ---- Supplier offers (no more than three — req 1) -------------------------
export type PaymentTerms = 'prepaid' | 'on_delivery' | 'net_15';
export interface SupplierOffer {
  id: string;
  supplier: string;
  icon: string;
  blurb: string;
  unitPrice: number;        // purchase price per material unit
  leadMin: number;          // lead time (order → goods received)
  reliability: number;      // 0..1 chance of a full, on-time inbound delivery
  expectedQuality: number;  // 0..1 (higher = fewer incoming defects)
  moq: number;              // minimum order quantity
  paymentTerms: PaymentTerms;
  transportCost: number;    // inbound logistics cost
}

// Exactly three, spanning the classic trade-offs: cheap-but-risky, dependable
// middle, and premium-fast-flawless.
export const SUPPLIER_OFFERS: SupplierOffer[] = [
  { id: 'budget', supplier: 'Cutprice Metals Co.', icon: '🏷️',
    blurb: 'Cheapest bars in the valley — if the lorry turns up and the metal is clean.',
    unitPrice: 34, leadMin: 12, reliability: 0.70, expectedQuality: 0.72, moq: 14, paymentTerms: 'prepaid', transportCost: 40 },
  { id: 'standard', supplier: 'Featherstone Foundry', icon: '🏭',
    blurb: 'The dependable local yard. Fair price, steady service, decent quality.',
    unitPrice: 48, leadMin: 6, reliability: 0.92, expectedQuality: 0.90, moq: 12, paymentTerms: 'on_delivery', transportCost: 55 },
  { id: 'premium', supplier: 'Rapid Rail Freight', icon: '🚄',
    blurb: 'Premium express — near-certain, near-flawless, and you pay for it.',
    unitPrice: 62, leadMin: 3, reliability: 0.98, expectedQuality: 0.98, moq: 12, paymentTerms: 'net_15', transportCost: 70 },
];
export function offerById(id: string): SupplierOffer | null { return SUPPLIER_OFFERS.find(o => o.id === id) || null; }

// ---- Outbound delivery options (transport to the customer) ----------------
export interface DeliveryOption { id: string; name: string; icon: string; cost: number; timeMin: number; }
export const DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: 'van',     name: 'Local Van',        icon: '🚐', cost: 30,  timeMin: 5 },
  { id: 'courier', name: 'Express Courier',  icon: '🛻', cost: 90,  timeMin: 2 },
];
export function deliveryById(id: string): DeliveryOption { return DELIVERY_OPTIONS.find(d => d.id === id) || DELIVERY_OPTIONS[0]; }

// ---- The player's plan ----------------------------------------------------
export interface OrderPlan { offerId: string; orderQty: number; deliveryId: string; }

// The order quantity the order actually needs (finished units × material per unit).
export function requiredMaterial(order: FlagshipOrder): number { return order.qty * order.materialPerUnit; }
// A sensible default order quantity: the requirement, but at least the MOQ, and
// never above what the warehouse can hold (an inventory-capacity decision).
export function suggestedOrderQty(order: FlagshipOrder, offer: SupplierOffer): number {
  const need = requiredMaterial(order);
  return Math.min(order.warehouseCap, Math.max(need, offer.moq));
}

// ---- Planned margin (shown BEFORE accepting — req 3) -----------------------
export interface PlannedMargin {
  revenue: number;
  materialCost: number;
  logisticsCost: number;      // inbound transport + outbound delivery
  expectedQualityCost: number;// expected rework from the supplier's quality
  totalCost: number;
  margin: number;             // revenue − totalCost
  marginPct: number;          // margin / revenue
  onTimeExpected: boolean;    // will the plan beat the deadline on paper?
  capacityOk: boolean;        // does the order fit the warehouse?
  moqOk: boolean;
  warnings: string[];
}
export function plannedMargin(order: FlagshipOrder, offer: SupplierOffer, plan: OrderPlan): PlannedMargin {
  const del = deliveryById(plan.deliveryId);
  const qty = Math.max(0, plan.orderQty | 0);
  const materialCost = qty * offer.unitPrice;
  const logisticsCost = offer.transportCost + del.cost;
  // Expected defects from the supplier's typical quality (before any inspection).
  const expectedDefects = Math.round(order.qty * (1 - offer.expectedQuality));
  const expectedQualityCost = expectedDefects * order.reworkCostPerUnit;
  const totalCost = materialCost + logisticsCost + expectedQualityCost;
  const eta = offer.leadMin + order.productionMin + del.timeMin;
  const onTimeExpected = eta <= order.deadlineMin;
  const capacityOk = qty <= order.warehouseCap;
  const moqOk = qty >= offer.moq;
  const revenue = order.quotedRevenue;
  const warnings: string[] = [];
  if (!onTimeExpected) warnings.push(`Lead ${offer.leadMin} + make ${order.productionMin} + ship ${del.timeMin} = ${eta} min beats the ${order.deadlineMin}-min deadline? No — expect a late penalty.`);
  if (!capacityOk) warnings.push(`Ordering ${qty} exceeds your ${order.warehouseCap}-unit warehouse capacity.`);
  if (!moqOk) warnings.push(`Below this supplier's minimum order of ${offer.moq}.`);
  if (offer.reliability < 0.8) warnings.push(`${offer.supplier} is not fully reliable — a short shipment could leave you unable to finish all ${order.qty} units.`);
  return { revenue, materialCost, logisticsCost, expectedQualityCost, totalCost, margin: revenue - totalCost, marginPct: revenue ? (revenue - totalCost) / revenue : 0, onTimeExpected, capacityOk, moqOk, warnings };
}

// ---- Realised outcome (after the rolls) — the full P&L --------------------
// Rolls are injected so every path (best / late / defective / loss) is testable.
export interface OrderRolls {
  supplierOnTime: boolean;   // did the inbound arrive on time & in full?
  shortfallFrac: number;     // 0..1 fraction NOT delivered when the supplier fails
  incomingDefectFrac: number;// 0..1 fraction of received material found defective at goods-in
  makeDefectFrac: number;    // 0..1 fraction of finished units that come out defective
}
// Expected-value rolls (what "should" happen) — used for a fair default resolution.
export function expectedRolls(offer: SupplierOffer): OrderRolls {
  return { supplierOnTime: offer.reliability >= 0.85, shortfallFrac: 0, incomingDefectFrac: 1 - offer.expectedQuality, makeDefectFrac: 0.03 };
}

export interface OrderResult {
  // stage figures
  ordered: number;
  delivered: number;
  shortfall: number;
  incomingDefects: number;
  usableMaterial: number;
  produced: number;          // good finished units made
  finishedDefects: number;
  deliveredToCustomer: number;
  onTime: boolean;
  etaMin: number;
  // money (req 6/7)
  quotedRevenue: number;
  actualRevenue: number;
  materialCost: number;
  logisticsCost: number;
  qualityCost: number;
  totalCost: number;
  profit: number;            // actualRevenue − totalCost
  cashIn: number;            // coins actually received from the customer
  cashOut: number;           // coins actually spent (materials + logistics + rework)
  netCash: number;           // cashIn − cashOut
  // relationship
  satisfaction: number;      // 0..100
  reputationDelta: number;   // −2..+2 with the client
  // framing
  learning: boolean;         // safe-recovery "teaching" outcome (a survivable loss)
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  notes: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function computeOrderResult(order: FlagshipOrder, offer: SupplierOffer, plan: OrderPlan, rolls: OrderRolls): OrderResult {
  const del = deliveryById(plan.deliveryId);
  const ordered = Math.max(0, plan.orderQty | 0);
  const notes: string[] = [];

  // --- inbound delivery + goods receipt ---
  const shortfall = rolls.supplierOnTime ? 0 : Math.round(ordered * clamp(rolls.shortfallFrac, 0, 1));
  const delivered = ordered - shortfall;
  if (shortfall > 0) notes.push(`${offer.supplier} short-shipped ${shortfall} of ${ordered} bars.`);

  // --- incoming quality inspection ---
  const incomingDefects = Math.round(delivered * clamp(rolls.incomingDefectFrac, 0, 1));
  const usableMaterial = Math.max(0, delivered - incomingDefects);
  if (incomingDefects > 0) notes.push(`Goods-in inspection rejected ${incomingDefects} defective bars.`);

  // --- production (usable material → finished units, capped at the order) ---
  const madeRaw = Math.floor(usableMaterial / Math.max(1, order.materialPerUnit));
  const produced = Math.min(order.qty, madeRaw);
  const finishedDefects = Math.round(produced * clamp(rolls.makeDefectFrac, 0, 1));
  const goodUnits = Math.max(0, produced - finishedDefects);
  if (finishedDefects > 0) notes.push(`Final QC found ${finishedDefects} out-of-spec brackets.`);

  // --- delivery planning + customer delivery ---
  const deliveredToCustomer = Math.min(order.qty, goodUnits);
  const etaMin = offer.leadMin + order.productionMin + del.timeMin;
  const onTime = rolls.supplierOnTime && etaMin <= order.deadlineMin;
  if (!onTime) notes.push(etaMin > order.deadlineMin
    ? `Delivered late — ${etaMin} min against an ${order.deadlineMin}-min deadline.`
    : `Delivered late — the short inbound shipment set the schedule back.`);

  // --- invoice: quality + lateness cut the agreed price (req 4/5) ---
  const shortUnits = order.qty - deliveredToCustomer;                  // units we simply couldn't deliver
  const shortLoss = order.quotedRevenue * (shortUnits / order.qty);    // no pay for undelivered units
  const defectLoss = order.quotedRevenue * order.defectValuePct * finishedDefects;
  const lateLoss = onTime ? 0 : order.quotedRevenue * order.latePenaltyPct;
  let actualRevenue = Math.max(0, order.quotedRevenue - shortLoss - defectLoss - lateLoss);

  // --- costs ---
  const materialCost = ordered * offer.unitPrice;                     // you pay for what you ordered
  const logisticsCost = offer.transportCost + del.cost;
  const qualityCost = (incomingDefects + finishedDefects) * order.reworkCostPerUnit;
  let totalCost = materialCost + logisticsCost + qualityCost;

  // --- safe recovery (req 8): a bad order teaches, it never wipes you out ---
  // The client honours a goodwill floor of 40% of the agreed price for a genuine
  // attempt, so realised revenue can't collapse to nothing on one poor decision.
  let learning = false;
  const floor = Math.round(order.quotedRevenue * 0.40);
  if (deliveredToCustomer > 0 && actualRevenue < floor){ actualRevenue = floor; learning = true; notes.push('Goodwill clause: the client paid a minimum for a genuine attempt.'); }

  const profit = actualRevenue - totalCost;
  if (profit < 0) learning = true;

  // --- customer satisfaction + reputation ---
  let satisfaction = 100;
  if (!onTime) satisfaction -= 30;
  satisfaction -= finishedDefects * 6;
  satisfaction -= shortUnits * 8;
  satisfaction = clamp(Math.round(satisfaction), 0, 100);
  const reputationDelta = satisfaction >= 90 ? 2 : satisfaction >= 70 ? 1 : satisfaction >= 45 ? 0 : -1;
  if (reputationDelta < 0) notes.push('The client is unhappy — reputation dipped, but the relationship survives.');

  const grade: OrderResult['grade'] = satisfaction >= 90 && profit > 0 ? 'excellent'
    : satisfaction >= 70 && profit > 0 ? 'good'
    : profit >= 0 ? 'fair' : 'poor';

  return {
    ordered, delivered, shortfall, incomingDefects, usableMaterial, produced, finishedDefects,
    deliveredToCustomer, onTime, etaMin,
    quotedRevenue: order.quotedRevenue, actualRevenue: Math.round(actualRevenue),
    materialCost, logisticsCost, qualityCost, totalCost,
    profit: Math.round(actualRevenue) - totalCost,
    cashIn: Math.round(actualRevenue), cashOut: totalCost, netCash: Math.round(actualRevenue) - totalCost,
    satisfaction, reputationDelta, learning, grade, notes,
  };
}
