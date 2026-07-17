// ============================================================================
// CONTRACT-TO-CASH — the authoritative gameplay STATE ENGINE.
// ----------------------------------------------------------------------------
// This is the underlying state model for BuyrWorld's signature source-to-cash
// pipeline. It EXTENDS the existing flagship order + supplier offers + delivery
// options (src/data/contractToCash.ts) rather than forking a prototype: the same
// FlagshipOrder/SupplierOffer/DeliveryOption data drives a persistent 17-stage
// state machine.
//
// Design pillars:
//  • Pure & serialisable. A C2CContract is plain JSON — it lives in the save.
//  • Decision-gated. Stages that require a player choice NEVER auto-advance
//    (only an explicit action moves them); time/outcome stages advance on tick().
//  • Effect-based. The reducer performs no side effects; it returns declarative
//    effects (inventory movements, wallet debits/credits with idempotency keys,
//    material reservations, history). main.ts (or a test world) applies them
//    against the real inventory + wallet — the inventory stays the source of truth.
//  • Deterministic. All randomness is seeded (mulberry32 with fixed per-roll
//    salts), so outcomes are testable and identical across a reload.
//  • Idempotent & no-skip. Every action asserts the expected stage and guards its
//    money/inventory side effects behind one-shot flags — double actions, double
//    payments and duplicate movements are impossible.
//
// The presentation layer (a clickable per-stage UI) is intentionally NOT built
// here — main.ts exposes the state for debugging + a minimal readout only.
// ============================================================================

import type { FlagshipOrder, SupplierOffer, PaymentTerms } from './contractToCash.ts';
import { offerById, deliveryById, plannedMargin } from './contractToCash.ts';

// ---- Stages ---------------------------------------------------------------
export const C2C_STAGES = [
  'customer_request',                 // 1  await: accept_request
  'quotation_review',                 // 2  await: accept_quote / decline_quote
  'supplier_selection',               // 3  await: select_supplier
  'purchase_order_raised',            // 4  await: raise_po
  'supplier_in_progress',             // 5  time: supplier makes the goods
  'inbound_transport',                // 6  time: inbound freight in transit
  'goods_received',                   // 7  auto: real inbound inventory movement
  'goods_in_qc',                      // 8  auto: incoming inspection roll
  'materials_accepted_or_quarantined',// 9  await: resolve_materials (accept/rework/scrap)
  'production',                       // 10 await: run_production (consume → finished goods)
  'final_qc',                         // 11 auto: classify accepted/reworkable/scrapped
  'dispatch_decision',                // 12 await: dispatch (optional rework, ship qty)
  'outbound_transport',               // 13 time: shipment to customer
  'delivered',                        // 14 auto: on-time / rejection evaluation
  'invoiced',                         // 15 await: send_invoice (sets payment timing)
  'paid',                             // 16 time: customer pays per terms → revenue in
  'closed',                           // 17 terminal: P&L finalised, history written
] as const;
export type C2CStage = typeof C2C_STAGES[number];

export function stageIndex(s: C2CStage): number { return C2C_STAGES.indexOf(s); }

// Stages that REQUIRE a player decision — tick() must never advance across these.
export const DECISION_STAGES: ReadonlySet<C2CStage> = new Set<C2CStage>([
  'customer_request', 'quotation_review', 'supplier_selection', 'purchase_order_raised',
  'materials_accepted_or_quarantined', 'production', 'dispatch_decision', 'invoiced',
]);
export function isDecisionStage(s: C2CStage): boolean { return DECISION_STAGES.has(s); }

export const C2C_ENGINE_VERSION = 1;

// ---- Deterministic seeded randomness --------------------------------------
function mulberry32(a: number){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A stable [0,1) draw for a given seed + salt. Independent of evaluation order,
 *  so recomputing a roll after a reload yields the same number. */
export function seededUnit(seed: number, salt: number): number {
  return mulberry32(((seed | 0) ^ Math.imul(salt | 0, 0x9E3779B1)) >>> 0)();
}
const SALT = { supplier: 1, shortfall: 2, incoming: 3, make: 4, reworkShare: 5, reject: 6 };

// ---- Serialisable contract state ------------------------------------------
export interface C2CPO {
  supplier: string; offerId: string;
  qty: number; unitPrice: number; paymentTerms: PaymentTerms;
  expectedQuality: number; promisedLeadMin: number; transportCost: number;
  deliveryId: string; deliveryCost: number; deliveryTimeMin: number;
  raisedAt: number;
}
export interface C2CContract {
  ver: number;
  id: string;
  orderId: string;
  stage: C2CStage;
  seed: number;
  makeQuality: number;          // 0..1 finished-goods quality (from the player's QC rating)
  customerTerms: PaymentTerms;  // when the CUSTOMER pays us
  createdAt: number;            // game-time (minutes)
  deadlineAt: number;           // game-time by which the customer must be delivered
  // authored-order snapshot (kept on the contract so it is fully self-describing)
  order: {
    client: string; productName?: string; productItem: string; qty: number;
    materialItem: string; materialPerUnit: number;
    quotedRevenue: number; productionMin: number;
    deadlineMin?: number; warehouseCap?: number;
    latePenaltyPct: number; defectValuePct: number; reworkCostPerUnit: number;
  };
  plan: { offerId: string | null; orderQty: number; deliveryId: string | null };
  po: C2CPO | null;
  // material buckets (units)
  mat: { ordered: number; delivered: number; shortfall: number; received: number;
         accepted: number; quarantined: number; scrapped: number; consumed: number;
         defectiveAccepted?: number; rejected?: number };
  inspected?: boolean;      // player inspected the goods-in sample (reveals defects)
  extended?: boolean;       // a deadline extension was granted (small satisfaction hit)
  // finished-goods buckets (units)
  fin: { produced: number; good: number; reworkable: number; scrapped: number;
         reworked: number; dispatched: number; deliveredToCustomer: number };
  // time thresholds (game-minutes), null until scheduled
  t: { supplierReadyAt: number | null; inboundArriveAt: number | null;
       outboundArriveAt: number | null; invoiceAt: number | null; payDueAt: number | null;
       deliveredAt: number | null; supplierPayAt: number | null };
  // persisted outcome rolls (for reload-safety + performance history)
  rolled: { supplierOnTime: boolean; shortfallFrac: number; incomingDefectFrac: number;
            makeDefectFrac: number; reworkShare: number } | null;
  onTime: boolean | null;
  customerRejected: boolean;
  // actual cash movements accrued (coins)
  cash: { supplierPaid: number; inboundPaid: number; reworkPaid: number; outboundPaid: number;
          revenue: number; penalties: number };
  // one-shot side-effect guards (idempotency / no-skip)
  did: { poRaised: boolean; supplierPaid: boolean; goodsMoved: boolean; materialsResolved: boolean;
         produced: boolean; finalQc: boolean; dispatched: boolean; invoiced: boolean; paid: boolean; closed: boolean;
         chased?: boolean; expedited?: boolean; extended?: boolean };
  history: string[];
}

// ---- Effects (applied by main.ts / a test world) --------------------------
export type C2CEffect =
  | { kind: 'inv_add'; item: string; qty: number }
  | { kind: 'inv_remove'; item: string; qty: number }
  | { kind: 'reserve'; item: string; qty: number }
  | { kind: 'release'; item: string; qty: number }
  | { kind: 'debit'; amount: number; source: string; key: string }
  | { kind: 'credit'; amount: number; source: string; key: string }
  | { kind: 'rep'; client: string; delta: number }
  | { kind: 'closed'; record: C2CPerfRecord };

export interface C2CPerfRecord {
  id: string; orderId: string; client: string; supplier: string | null; deliveryId: string | null;
  onTime: boolean; inFull: boolean; customerRejected: boolean; satisfaction: number; reputationDelta: number;
  delivered: number; ordered: number; supplierShortfall: number; incomingDefects: number; finishedScrapped: number;
  planned: C2CPnl; actual: C2CPnl; grade: OrderGrade; closedAt: number;
}
export type OrderGrade = 'excellent' | 'good' | 'fair' | 'poor';

export interface ActionResult {
  contract: C2CContract;
  effects: C2CEffect[];
  ok: boolean;
  error?: string;
  changed: boolean;   // did the stage advance / state meaningfully change?
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const okRes = (c: C2CContract, effects: C2CEffect[] = [], changed = true): ActionResult => ({ contract: c, effects, ok: true, changed });
const noRes = (c: C2CContract, error: string): ActionResult => ({ contract: c, effects: [], ok: false, error, changed: false });

// ---- Construction ---------------------------------------------------------
export interface CreateOpts { id: string; seed: number; now: number; makeQuality?: number; customerTerms?: PaymentTerms; }
export function createContract(order: FlagshipOrder, opts: CreateOpts): C2CContract {
  return {
    ver: C2C_ENGINE_VERSION,
    id: opts.id,
    orderId: order.id,
    stage: 'customer_request',
    seed: opts.seed | 0,
    makeQuality: clamp(opts.makeQuality ?? 0.9, 0, 1),
    customerTerms: opts.customerTerms ?? 'on_delivery',
    createdAt: opts.now,
    deadlineAt: opts.now + order.deadlineMin,
    order: {
      client: order.client, productName: order.productName, productItem: order.productItem, qty: order.qty,
      materialItem: order.materialItem, materialPerUnit: order.materialPerUnit,
      quotedRevenue: order.quotedRevenue, productionMin: order.productionMin,
      deadlineMin: order.deadlineMin, warehouseCap: order.warehouseCap,
      latePenaltyPct: order.latePenaltyPct, defectValuePct: order.defectValuePct,
      reworkCostPerUnit: order.reworkCostPerUnit,
    },
    plan: { offerId: null, orderQty: 0, deliveryId: null },
    po: null,
    mat: { ordered: 0, delivered: 0, shortfall: 0, received: 0, accepted: 0, quarantined: 0, scrapped: 0, consumed: 0 },
    fin: { produced: 0, good: 0, reworkable: 0, scrapped: 0, reworked: 0, dispatched: 0, deliveredToCustomer: 0 },
    t: { supplierReadyAt: null, inboundArriveAt: null, outboundArriveAt: null, invoiceAt: null, payDueAt: null, deliveredAt: null, supplierPayAt: null },
    rolled: null,
    onTime: null,
    customerRejected: false,
    cash: { supplierPaid: 0, inboundPaid: 0, reworkPaid: 0, outboundPaid: 0, revenue: 0, penalties: 0 },
    did: { poRaised: false, supplierPaid: false, goodsMoved: false, materialsResolved: false, produced: false, finalQc: false, dispatched: false, invoiced: false, paid: false, closed: false },
    history: [`Order opened for ${order.client} — ${order.qty}× ${order.productItem}.`],
  };
}

// ---- Migration ------------------------------------------------------------
/** Bring a persisted contract from any older shape up to the current version.
 *  Additive + defensive: missing buckets/flags default safely, never destructive. */
export function migrateContract(raw: any): C2CContract | null {
  if (!raw || typeof raw !== 'object') return null;
  const c: any = { ...raw };
  c.ver = C2C_ENGINE_VERSION;
  if (!C2C_STAGES.includes(c.stage)) c.stage = 'customer_request';
  c.mat = Object.assign({ ordered: 0, delivered: 0, shortfall: 0, received: 0, accepted: 0, quarantined: 0, scrapped: 0, consumed: 0 }, c.mat || {});
  c.fin = Object.assign({ produced: 0, good: 0, reworkable: 0, scrapped: 0, reworked: 0, dispatched: 0, deliveredToCustomer: 0 }, c.fin || {});
  c.t = Object.assign({ supplierReadyAt: null, inboundArriveAt: null, outboundArriveAt: null, invoiceAt: null, payDueAt: null, deliveredAt: null, supplierPayAt: null }, c.t || {});
  c.cash = Object.assign({ supplierPaid: 0, inboundPaid: 0, reworkPaid: 0, outboundPaid: 0, revenue: 0, penalties: 0 }, c.cash || {});
  c.did = Object.assign({ poRaised: false, supplierPaid: false, goodsMoved: false, materialsResolved: false, produced: false, finalQc: false, dispatched: false, invoiced: false, paid: false, closed: false }, c.did || {});
  c.plan = Object.assign({ offerId: null, orderQty: 0, deliveryId: null }, c.plan || {});
  if (typeof c.customerTerms !== 'string') c.customerTerms = 'on_delivery';
  if (typeof c.makeQuality !== 'number') c.makeQuality = 0.9;
  if (typeof c.customerRejected !== 'boolean') c.customerRejected = false;
  if (!Array.isArray(c.history)) c.history = [];
  if (c.onTime === undefined) c.onTime = null;
  if (c.rolled === undefined) c.rolled = null;
  return c as C2CContract;
}

// ---- Deterministic, replayable scenarios ----------------------------------
// Named, seeded set-ups for the Rail Yard showcase — each locks the outcome rolls
// so a scenario plays out identically every time (testable + fair to practise).
// The rolls only fix the WORLD (supplier reliability, defects); the player's
// decisions still determine the profit + satisfaction.
export type ScenarioRolls = NonNullable<C2CContract['rolled']>;
export interface C2CScenario {
  id: string; label: string; blurb: string;
  orderOverrides?: Partial<C2CContract['order']>;
  rolled: ScenarioRolls;
  customerTerms?: PaymentTerms;
}
export const C2C_SCENARIOS: C2CScenario[] = [
  { id: 'trailer', label: 'The Featherstone Run', blurb: 'A clean showcase order — dependable suppliers, minor defects. On time and profitable if you plan well.',
    rolled: { supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0.12, makeDefectFrac: 0.05, reworkShare: 0.6 } },
  { id: 'supplier_shortfall', label: 'The Short Shipment', blurb: 'A cheap supplier under-delivers. Chase them, expedite, or ship what you can.',
    rolled: { supplierOnTime: false, shortfallFrac: 0.3, incomingDefectFrac: 0.1, makeDefectFrac: 0.05, reworkShare: 0.6 } },
  { id: 'quality_crisis', label: 'The Quality Crisis', blurb: 'A dodgy batch arrives. Inspect it, quarantine the bad bars, rework them — or gamble on accepting the lot.',
    rolled: { supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0.4, makeDefectFrac: 0.08, reworkShare: 0.5 } },
  { id: 'rush', label: 'The Rush Order', blurb: 'A tight deadline. Pay to expedite the supplier, or ask the client for grace.',
    orderOverrides: { deadlineMin: 10 }, rolled: { supplierOnTime: true, shortfallFrac: 0, incomingDefectFrac: 0.1, makeDefectFrac: 0.05, reworkShare: 0.6 } },
];
export function scenarioById(id: string): C2CScenario | null { return C2C_SCENARIOS.find(s => s.id === id) || null; }

// ---- P&L (planned + actual) -----------------------------------------------
export interface C2CPnl {
  revenue: number;
  materialCost: number;
  inboundLogistics: number;
  productionCost: number;   // rework/quality cost
  outboundLogistics: number;
  penalties: number;
  grossProfit: number;
  marginPct: number;
}
function pnl(revenue: number, material: number, inbound: number, production: number, outbound: number, penalties: number): C2CPnl {
  const grossProfit = revenue - material - inbound - production - outbound - penalties;
  return { revenue, materialCost: material, inboundLogistics: inbound, productionCost: production,
           outboundLogistics: outbound, penalties, grossProfit, marginPct: revenue ? grossProfit / revenue : 0 };
}
/** Planned P&L — from the PO the player committed to (expected outcome). */
export function plannedPnl(c: C2CContract): C2CPnl {
  if (!c.po) return pnl(c.order.quotedRevenue, 0, 0, 0, 0, 0);
  const offer = offerById(c.po.offerId);
  const material = c.po.qty * c.po.unitPrice;
  const inbound = c.po.transportCost;
  const outbound = c.po.deliveryCost;
  // expected quality/rework from the supplier's typical quality
  const expDefects = Math.round(c.order.qty * (1 - (offer ? offer.expectedQuality : c.po.expectedQuality)));
  const production = expDefects * c.order.reworkCostPerUnit;
  return pnl(c.order.quotedRevenue, material, inbound, production, outbound, 0);
}
/** Actual P&L — from what really happened (buckets + accrued cash). Revenue is
 *  shown GROSS (what the order was worth) with the short/late/defect losses as a
 *  separate penalties line, so grossProfit equals the real cash delta:
 *  (net received = gross − penalties) − costs. `c.cash.revenue` is the NET amount
 *  actually banked, so gross = net + penalties. */
export function actualPnl(c: C2CContract): C2CPnl {
  return pnl(c.cash.revenue + c.cash.penalties, c.cash.supplierPaid, c.cash.inboundPaid, c.cash.reworkPaid, c.cash.outboundPaid, c.cash.penalties);
}
export function gradeOf(c: C2CContract): OrderGrade {
  const a = actualPnl(c);
  const sat = satisfactionOf(c);
  return sat >= 90 && a.grossProfit > 0 ? 'excellent'
    : sat >= 70 && a.grossProfit > 0 ? 'good'
    : a.grossProfit >= 0 ? 'fair' : 'poor';
}
export function satisfactionOf(c: C2CContract): number {
  let s = 100;
  if (c.onTime === false) s -= 30;
  s -= c.fin.scrapped * 6;
  const shortUnits = Math.max(0, c.order.qty - c.fin.deliveredToCustomer);
  s -= shortUnits * 8;
  if (c.customerRejected) s -= 25;
  if (c.extended) s -= 10;   // a granted extension keeps you on-time, but the client noticed
  return clamp(Math.round(s), 0, 100);
}

// ---- Reserved-inventory helper (source-of-truth stays the real inventory) --
/** Units of `item` this contract currently holds reserved in the shared inventory
 *  (material not yet consumed/scrapped, plus finished goods not yet shipped). */
export function reservedByContract(c: C2CContract, item: string): number {
  let n = 0;
  // Material stays reserved until production runs, which frees ALL of it (consumed
  // out, the rest handed back to the player). Finished goods stay reserved until
  // dispatch, which frees ALL of them (shipped out, the rest kept as stock).
  if (item === c.order.materialItem) n += c.did.produced ? 0 : Math.max(0, c.mat.received - c.mat.scrapped);
  if (item === c.order.productItem) n += c.did.dispatched ? 0 : Math.max(0, c.fin.produced - c.fin.scrapped);
  return n;
}

// ---- Actions --------------------------------------------------------------
export type C2CAction =
  | { type: 'accept_request' }
  | { type: 'accept_quote' }
  | { type: 'decline_quote' }
  | { type: 'select_supplier'; offerId: string; qty: number; deliveryId: string }
  | { type: 'raise_po'; now: number }
  | { type: 'intervene'; kind: 'wait' | 'chase' | 'expedite'; now: number }
  | { type: 'inspect' }
  | { type: 'resolve_materials'; quarantine: 'scrap' | 'rework' | 'hold' | 'accept' | 'reject' }
  | { type: 'run_production' }
  | { type: 'extend_deadline'; now: number }
  | { type: 'dispatch'; rework: boolean; now: number }
  | { type: 'send_invoice'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'close' };

/** The single authoritative reducer. Pure: returns a NEW contract + effects. */
export function reduce(c0: C2CContract, action: C2CAction): ActionResult {
  const c: C2CContract = JSON.parse(JSON.stringify(c0));   // never mutate the input
  const O = c.order;

  switch (action.type) {
    case 'accept_request': {
      if (c.stage !== 'customer_request') return noRes(c0, 'wrong_stage');
      c.stage = 'quotation_review';
      c.history.push('Reviewed the customer request and quotation.');
      return okRes(c);
    }
    case 'accept_quote': {
      if (c.stage !== 'quotation_review') return noRes(c0, 'wrong_stage');
      c.stage = 'supplier_selection';
      c.history.push(`Quote accepted at ${O.quotedRevenue}c — comparing suppliers.`);
      return okRes(c);
    }
    case 'decline_quote': {
      if (c.stage !== 'quotation_review') return noRes(c0, 'wrong_stage');
      c.stage = 'closed'; c.did.closed = true;
      c.history.push('Quote declined — order closed with no commitment.');
      return okRes(c, [{ kind: 'closed', record: perfRecord(c) }]);
    }
    case 'select_supplier': {
      if (c.stage !== 'supplier_selection') return noRes(c0, 'wrong_stage');
      const offer = offerById(action.offerId);
      if (!offer) return noRes(c0, 'unknown_supplier');
      const del = deliveryById(action.deliveryId);
      const qty = Math.max(0, action.qty | 0);
      c.plan = { offerId: offer.id, orderQty: qty, deliveryId: del.id };
      c.po = {
        supplier: offer.supplier, offerId: offer.id, qty,
        unitPrice: offer.unitPrice, paymentTerms: offer.paymentTerms,
        expectedQuality: offer.expectedQuality, promisedLeadMin: offer.leadMin, transportCost: offer.transportCost,
        deliveryId: del.id, deliveryCost: del.cost, deliveryTimeMin: del.timeMin,
        raisedAt: 0,
      };
      c.stage = 'purchase_order_raised';
      c.history.push(`Drafted PO: ${qty}× ${O.materialItem} from ${offer.supplier} @ ${offer.unitPrice}c (${offer.paymentTerms}).`);
      return okRes(c);
    }
    case 'raise_po': {
      if (c.stage !== 'purchase_order_raised') return noRes(c0, 'wrong_stage');
      if (!c.po) return noRes(c0, 'no_po');
      if (c.did.poRaised) return noRes(c0, 'already_raised');
      const now = action.now;
      c.po.raisedAt = now;
      c.did.poRaised = true;
      c.mat.ordered = c.po.qty;
      const effects: C2CEffect[] = [];
      // Prepaid terms: cash leaves now (cash-timing lever, req).
      if (c.po.paymentTerms === 'prepaid') {
        c.cash.supplierPaid += c.po.qty * c.po.unitPrice;
        c.did.supplierPaid = true;
        effects.push({ kind: 'debit', amount: c.po.qty * c.po.unitPrice, source: 'c2c_material', key: keyOf(c, 'material') });
      }
      // Inbound freight is paid at dispatch of the supplier (on raise) — a committed cost.
      c.cash.inboundPaid += c.po.transportCost;
      effects.push({ kind: 'debit', amount: c.po.transportCost, source: 'c2c_inbound', key: keyOf(c, 'inbound') });
      // schedule the whole inbound timeline in game-time up front (absolute
      // thresholds, so a single clock read flows the mechanical stages through).
      c.t.supplierReadyAt = now + c.po.promisedLeadMin;
      c.t.inboundArriveAt = c.t.supplierReadyAt + INBOUND_TRANSIT;
      c.stage = 'supplier_in_progress';
      c.history.push(`PO raised — supplier working (lead ${c.po.promisedLeadMin} min).`);
      return okRes(c, effects);
    }
    case 'intervene': {
      // A meaningful mid-fulfilment intervention while the supplier is working.
      if (c.stage !== 'supplier_in_progress') return noRes(c0, 'wrong_stage');
      const now = action.now;
      const effects: C2CEffect[] = [];
      if (action.kind === 'chase') {
        if (c.did.chased) return noRes(c0, 'already_chased');
        c.did.chased = true;
        // free, once: a gentle nudge that trims a minute off the remaining lead
        if (c.t.supplierReadyAt != null) { c.t.supplierReadyAt = Math.max(now, c.t.supplierReadyAt - 1); c.t.inboundArriveAt = c.t.supplierReadyAt + INBOUND_TRANSIT; }
        c.history.push('Chased the supplier — they promise to hurry it along.');
        return okRes(c, effects);
      }
      if (action.kind === 'expedite') {
        if (c.did.expedited) return noRes(c0, 'already_expedited');
        if (!c.po) return noRes(c0, 'no_po');
        c.did.expedited = true;
        const fee = Math.max(10, Math.round(c.po.qty * c.po.unitPrice * 0.15));
        c.cash.inboundPaid += fee;   // a rush freight surcharge (logistics)
        effects.push({ kind: 'debit', amount: fee, source: 'c2c_expedite', key: keyOf(c, 'expedite') });
        if (c.t.supplierReadyAt != null) { const rem = Math.max(0, c.t.supplierReadyAt - now); c.t.supplierReadyAt = now + Math.ceil(rem / 2); c.t.inboundArriveAt = c.t.supplierReadyAt + INBOUND_TRANSIT; }
        c.history.push(`Paid ${fee}c to expedite — the batch is fast-tracked.`);
        return okRes(c, effects);
      }
      // wait: hold your nerve — costs nothing, changes nothing
      c.history.push('Waited on the supplier.');
      return { contract: c, effects: [], ok: true, changed: false };
    }
    case 'inspect': {
      if (c.stage !== 'materials_accepted_or_quarantined') return noRes(c0, 'wrong_stage');
      if (c.inspected) return noRes(c0, 'already_inspected');
      c.inspected = true;
      c.history.push(`Inspected a sample: ${c.mat.quarantined} of ${c.mat.received} bars are out of spec.`);
      return okRes(c, []);
    }
    case 'extend_deadline': {
      if (c.stage !== 'dispatch_decision') return noRes(c0, 'wrong_stage');
      if (c.did.extended) return noRes(c0, 'already_extended');
      c.did.extended = true;
      c.extended = true;
      const fee = Math.max(10, Math.round(c.order.quotedRevenue * 0.05));
      c.cash.outboundPaid += fee;   // a rush/grace service fee
      c.deadlineAt = Math.max(c.deadlineAt, action.now + 12);   // the client grants extra time
      c.history.push(`Requested a deadline extension (−${fee}c) — the client grants some grace.`);
      return okRes(c, [{ kind: 'debit', amount: fee, source: 'c2c_extension', key: keyOf(c, 'extension') }]);
    }
    case 'resolve_materials': {
      if (c.stage !== 'materials_accepted_or_quarantined') return noRes(c0, 'wrong_stage');
      if (c.did.materialsResolved) return noRes(c0, 'already_resolved');
      const effects: C2CEffect[] = [];
      c.did.materialsResolved = true;
      // reject the WHOLE received batch → scrapped + a goodwill part-refund; nothing
      // usable remains (a cut-your-losses escape hatch).
      if (action.quarantine === 'reject') {
        const remaining = Math.max(0, c.mat.received - c.mat.consumed - c.mat.scrapped);
        if (c.mat.received > 0) effects.push({ kind: 'inv_remove', item: O.materialItem, qty: c.mat.received });
        if (remaining > 0) effects.push({ kind: 'release', item: O.materialItem, qty: remaining });
        const refund = Math.round((c.po ? c.po.unitPrice : 0) * c.mat.received * 0.5);
        if (refund > 0) { c.cash.supplierPaid = Math.max(0, c.cash.supplierPaid - refund); effects.push({ kind: 'credit', amount: refund, source: 'c2c_refund', key: keyOf(c, 'refund') }); }
        c.mat.rejected = c.mat.received; c.mat.scrapped += c.mat.quarantined; c.mat.quarantined = 0; c.mat.accepted = 0;
        c.history.push(`Rejected the whole batch — supplier refunded ${refund}c. You'll need to ship short.`);
        c.stage = 'production';
        return okRes(c, effects);
      }
      // accept ALL, defective included — cheap + fast, but the bad bars raise the
      // finished-goods defect rate (a genuine risk/quality trade-off).
      if (action.quarantine === 'accept' && c.mat.quarantined > 0) {
        c.mat.defectiveAccepted = c.mat.quarantined;
        c.mat.accepted += c.mat.quarantined;
        c.history.push(`Accepted all ${c.mat.received} bars, including ${c.mat.quarantined} out-of-spec — defect risk up.`);
        c.mat.quarantined = 0;
        c.stage = 'production';
        return okRes(c, effects);
      }
      if (c.mat.quarantined > 0) {
        if (action.quarantine === 'scrap') {
          // scrapped material leaves inventory + its reservation is released
          effects.push({ kind: 'inv_remove', item: O.materialItem, qty: c.mat.quarantined });
          effects.push({ kind: 'release', item: O.materialItem, qty: c.mat.quarantined });
          c.mat.scrapped += c.mat.quarantined;
          c.history.push(`Scrapped ${c.mat.quarantined} quarantined bars.`);
          c.mat.quarantined = 0;
        } else if (action.quarantine === 'rework') {
          // pay to bring quarantined stock up to spec → it becomes accepted
          const cost = c.mat.quarantined * O.reworkCostPerUnit;
          c.cash.reworkPaid += cost;
          effects.push({ kind: 'debit', amount: cost, source: 'c2c_rework', key: keyOf(c, 'mat_rework') });
          c.mat.accepted += c.mat.quarantined;
          c.history.push(`Reworked ${c.mat.quarantined} bars into spec (−${cost}c).`);
          c.mat.quarantined = 0;
        } else {
          // hold: leave quarantined stock aside (still reserved, unusable by production)
          c.history.push(`Held ${c.mat.quarantined} quarantined bars aside.`);
        }
      }
      c.stage = 'production';
      return okRes(c, effects);
    }
    case 'run_production': {
      if (c.stage !== 'production') return noRes(c0, 'wrong_stage');
      if (c.did.produced) return noRes(c0, 'already_produced');
      const perUnit = Math.max(1, O.materialPerUnit);
      const canMake = Math.floor(c.mat.accepted / perUnit);
      const produced = Math.min(O.qty, canMake);
      const consumed = produced * perUnit;
      c.did.produced = true;
      c.mat.consumed += consumed;
      c.fin.produced = produced;
      const effects: C2CEffect[] = [];
      // consume accepted material (real movement out of inventory)…
      if (consumed > 0) effects.push({ kind: 'inv_remove', item: O.materialItem, qty: consumed });
      // …and release ALL remaining material reservation for this order (the consumed
      // units, plus any leftover accepted AND held-quarantine bars, which become the
      // player's free stock). After production no material is reserved to the order.
      const stillReserved = Math.max(0, c.mat.received - c.mat.scrapped);
      if (stillReserved > 0) effects.push({ kind: 'release', item: O.materialItem, qty: stillReserved });
      c.mat.accepted = 0;
      // create real finished goods (reserved to this contract until shipped)
      if (produced > 0) {
        effects.push({ kind: 'inv_add', item: O.productItem, qty: produced });
        effects.push({ kind: 'reserve', item: O.productItem, qty: produced });
      }
      c.stage = 'final_qc';
      c.history.push(`Produced ${produced}× ${O.productItem} (consumed ${consumed} bars).`);
      return okRes(c, effects);
    }
    case 'dispatch': {
      if (c.stage !== 'dispatch_decision') return noRes(c0, 'wrong_stage');
      if (c.did.dispatched) return noRes(c0, 'already_dispatched');
      const effects: C2CEffect[] = [];
      c.did.dispatched = true;
      // optional rework of reworkable finished goods → good
      if (action.rework && c.fin.reworkable > 0) {
        const cost = c.fin.reworkable * O.reworkCostPerUnit;
        c.cash.reworkPaid += cost;
        effects.push({ kind: 'debit', amount: cost, source: 'c2c_rework', key: keyOf(c, 'fin_rework') });
        c.fin.good += c.fin.reworkable;
        c.fin.reworked += c.fin.reworkable;
        c.history.push(`Reworked ${c.fin.reworkable} finished units (−${cost}c).`);
        c.fin.reworkable = 0;
      }
      const ship = Math.min(O.qty, c.fin.good);
      c.fin.dispatched = ship;
      c.fin.deliveredToCustomer = ship;
      // dispatch removes shipped goods from inventory…
      if (ship > 0) effects.push({ kind: 'inv_remove', item: O.productItem, qty: ship });
      // …and releases ALL remaining finished-goods reservation (shipped units plus any
      // un-reworked reworkable units left behind — the player keeps those as stock).
      const finReserved = Math.max(0, c.fin.produced - c.fin.scrapped);
      if (finReserved > 0) effects.push({ kind: 'release', item: O.productItem, qty: finReserved });
      // outbound freight cost
      c.cash.outboundPaid += (c.po ? c.po.deliveryCost : 0);
      if (c.po && c.po.deliveryCost > 0) effects.push({ kind: 'debit', amount: c.po.deliveryCost, source: 'c2c_outbound', key: keyOf(c, 'outbound') });
      // schedule the outbound leg
      const now = action.now;
      c.t.outboundArriveAt = now + (c.po ? c.po.deliveryTimeMin : 0);
      c.stage = 'outbound_transport';
      c.history.push(`Dispatched ${ship}× ${O.productItem} to ${O.client}.`);
      return okRes(c, effects);
    }
    case 'send_invoice': {
      if (c.stage !== 'invoiced') return noRes(c0, 'wrong_stage');
      if (c.did.invoiced) return noRes(c0, 'already_invoiced');
      c.did.invoiced = true;
      const now = action.now;
      c.t.invoiceAt = now;
      // customer payment timing (cash-in) depends on their terms (req): on_delivery
      // is due immediately, net_15 falls due 15 game-minutes later.
      c.t.payDueAt = now + (c.customerTerms === 'net_15' ? 15 : 0);
      c.stage = 'paid';   // enter the payment-pending stage; tick settles it at payDueAt
      c.history.push(`Invoice sent (${c.customerTerms}).`);
      return okRes(c);
    }
    case 'close': {
      if (c.stage === 'closed') return noRes(c0, 'already_closed');
      c.stage = 'closed'; c.did.closed = true;
      c.history.push('Order closed.');
      return okRes(c, [{ kind: 'closed', record: perfRecord(c) }]);
    }
    case 'tick':
      return tick(c, action.now);
  }
  return noRes(c0, 'unknown_action');
}

/** Advance time-driven, non-decision stages. Never crosses a decision stage. */
function tick(c: C2CContract, now: number): ActionResult {
  if (isDecisionStage(c.stage) || c.stage === 'closed') return { contract: c, effects: [], ok: true, changed: false };
  const effects: C2CEffect[] = [];

  switch (c.stage) {
    case 'supplier_in_progress': {
      if (c.t.supplierReadyAt == null || now < c.t.supplierReadyAt) return still(c);
      // roll the supplier outcome ONCE (persisted)
      if (!c.rolled) c.rolled = rollAll(c);
      const onTime = c.rolled.supplierOnTime;
      c.mat.shortfall = onTime ? 0 : Math.round(c.mat.ordered * clamp(c.rolled.shortfallFrac, 0, 1));
      c.mat.delivered = Math.max(0, c.mat.ordered - c.mat.shortfall);
      // inbound transit was scheduled at PO time; just hand off to it
      c.stage = 'inbound_transport';
      c.history.push(onTime ? `Supplier shipped ${c.mat.delivered} bars on time.` : `Supplier SHORT-shipped: ${c.mat.delivered}/${c.mat.ordered}.`);
      return okRes(c, effects);
    }
    case 'inbound_transport': {
      if (c.t.inboundArriveAt == null || now < c.t.inboundArriveAt) return still(c);
      c.stage = 'goods_received';
      c.history.push('Inbound freight arrived at the yard.');
      return okRes(c, effects);
    }
    case 'goods_received': {
      // AUTO: create the actual inbound inventory movement + reserve it to this order
      if (!c.did.goodsMoved) {
        c.did.goodsMoved = true;
        c.mat.received = c.mat.delivered;
        // pay the supplier now if terms are on_delivery; schedule net_15
        if (c.po && !c.did.supplierPaid) {
          if (c.po.paymentTerms === 'on_delivery') {
            c.cash.supplierPaid += c.po.qty * c.po.unitPrice; c.did.supplierPaid = true;
            effects.push({ kind: 'debit', amount: c.po.qty * c.po.unitPrice, source: 'c2c_material', key: keyOf(c, 'material') });
          } else if (c.po.paymentTerms === 'net_15') {
            c.t.supplierPayAt = now + 15;
          }
        }
        if (c.mat.received > 0) {
          effects.push({ kind: 'inv_add', item: c.order.materialItem, qty: c.mat.received });
          effects.push({ kind: 'reserve', item: c.order.materialItem, qty: c.mat.received });
        }
      }
      c.stage = 'goods_in_qc';
      c.history.push(`Goods received: ${c.mat.received} bars booked into inventory.`);
      return okRes(c, effects);
    }
    case 'goods_in_qc': {
      // AUTO: incoming inspection → accepted vs quarantined (roll persisted)
      if (!c.rolled) c.rolled = rollAll(c);
      const defects = Math.round(c.mat.received * clamp(c.rolled.incomingDefectFrac, 0, 1));
      c.mat.quarantined = defects;
      c.mat.accepted = Math.max(0, c.mat.received - defects);
      c.stage = 'materials_accepted_or_quarantined';
      c.history.push(defects > 0 ? `Goods-in QC quarantined ${defects} defective bars (${c.mat.accepted} accepted).` : `Goods-in QC passed all ${c.mat.accepted} bars.`);
      return okRes(c, effects);
    }
    case 'final_qc': {
      // AUTO: classify produced units accepted / reworkable / scrapped
      if (!c.did.finalQc) {
        c.did.finalQc = true;
        if (!c.rolled) c.rolled = rollAll(c);
        // Accepting defective material at goods-in raises the finished defect rate.
        const badMat = c.mat.defectiveAccepted || 0;
        const matPenalty = badMat > 0 ? 0.4 * (badMat / Math.max(1, c.mat.received)) : 0;
        const defectRate = clamp(c.rolled.makeDefectFrac + matPenalty, 0, 1);
        const defects = Math.round(c.fin.produced * defectRate);
        const reworkable = Math.round(defects * clamp(c.rolled.reworkShare, 0, 1));
        const scrapped = defects - reworkable;
        c.fin.good = Math.max(0, c.fin.produced - defects);
        c.fin.reworkable = reworkable;
        c.fin.scrapped = scrapped;
        if (scrapped > 0) {
          // scrapped finished goods leave inventory + release reservation
          effects.push({ kind: 'inv_remove', item: c.order.productItem, qty: scrapped });
          effects.push({ kind: 'release', item: c.order.productItem, qty: scrapped });
        }
        c.history.push(`Final QC: ${c.fin.good} good, ${reworkable} reworkable, ${scrapped} scrapped.`);
      }
      c.stage = 'dispatch_decision';
      return okRes(c, effects);
    }
    case 'outbound_transport': {
      if (c.t.outboundArriveAt == null || now < c.t.outboundArriveAt) return still(c);
      // The order arrives at its SCHEDULED time (not whenever the tick happens to
      // observe it) — so on-time is deterministic and robust to clock granularity.
      c.t.deliveredAt = c.t.outboundArriveAt;
      c.onTime = c.t.outboundArriveAt <= c.deadlineAt;
      // Customer rejection: nothing usable actually reached them.
      const shortUnits = c.order.qty - c.fin.deliveredToCustomer;
      c.customerRejected = c.fin.deliveredToCustomer <= 0;
      c.stage = 'delivered';
      c.history.push(c.onTime ? `Delivered to ${c.order.client} on time.` : `Delivered to ${c.order.client} LATE.`);
      if (shortUnits > 0 && !c.customerRejected) c.history.push(`Short by ${shortUnits} units.`);
      return okRes(c, effects);
    }
    case 'delivered': {
      // AUTO → invoicing step (the invoice itself is a player action)
      // pay a net_15 supplier bill if it has now come due
      if (c.po && c.po.paymentTerms === 'net_15' && !c.did.supplierPaid && c.t.supplierPayAt != null && now >= c.t.supplierPayAt) {
        c.cash.supplierPaid += c.po.qty * c.po.unitPrice; c.did.supplierPaid = true;
        effects.push({ kind: 'debit', amount: c.po.qty * c.po.unitPrice, source: 'c2c_material', key: keyOf(c, 'material') });
      }
      c.stage = 'invoiced';
      return okRes(c, effects);
    }
    case 'paid': {
      if (c.did.paid) { return maybeClose(c, now, effects); }
      if (c.t.payDueAt == null || now < c.t.payDueAt) return still(c);
      // settle any still-outstanding net_15 supplier bill first
      if (c.po && c.po.paymentTerms === 'net_15' && !c.did.supplierPaid) {
        c.cash.supplierPaid += c.po.qty * c.po.unitPrice; c.did.supplierPaid = true;
        effects.push({ kind: 'debit', amount: c.po.qty * c.po.unitPrice, source: 'c2c_material', key: keyOf(c, 'material') });
      }
      // compute realised revenue (short/defect/late penalties), pay unless rejected
      const rev = realisedRevenue(c);
      c.cash.revenue += rev.revenue;
      c.cash.penalties = rev.penalties;
      c.did.paid = true;
      if (rev.revenue > 0) effects.push({ kind: 'credit', amount: rev.revenue, source: 'c2c_revenue', key: keyOf(c, 'revenue') });
      const repDelta = repDeltaOf(c);
      if (repDelta !== 0) effects.push({ kind: 'rep', client: c.order.client, delta: repDelta });
      c.history.push(c.customerRejected ? `Customer rejected the order — no payment.` : `Paid ${rev.revenue}c by ${c.order.client}.`);
      return maybeClose(c, now, effects);
    }
  }
  return still(c);
}

// Payment settled (or rejected) → the terminal 'closed' stage, writing history.
function maybeClose(c: C2CContract, now: number, effects: C2CEffect[]): ActionResult {
  c.stage = 'closed'; c.did.closed = true;
  effects.push({ kind: 'closed', record: perfRecord(c) });
  c.history.push('Order closed — performance recorded.');
  return okRes(c, effects);
}
function still(c: C2CContract): ActionResult { return { contract: c, effects: [], ok: true, changed: false }; }

// ---- Derived money --------------------------------------------------------
function realisedRevenue(c: C2CContract): { revenue: number; penalties: number } {
  if (c.customerRejected) return { revenue: 0, penalties: c.order.quotedRevenue };
  const O = c.order;
  const shortUnits = Math.max(0, O.qty - c.fin.deliveredToCustomer);
  const shortLoss = O.quotedRevenue * (shortUnits / O.qty);
  const defectLoss = O.quotedRevenue * O.defectValuePct * c.fin.scrapped;
  const lateLoss = c.onTime === false ? O.quotedRevenue * O.latePenaltyPct : 0;
  let revenue = Math.max(0, O.quotedRevenue - shortLoss - defectLoss - lateLoss);
  // goodwill floor for a genuine attempt (safe recovery)
  const floor = Math.round(O.quotedRevenue * 0.40);
  if (c.fin.deliveredToCustomer > 0 && revenue < floor) revenue = floor;
  const penalties = Math.round(shortLoss + defectLoss + lateLoss);
  return { revenue: Math.round(revenue), penalties };
}
function repDeltaOf(c: C2CContract): number {
  const s = satisfactionOf(c);
  return s >= 90 ? 2 : s >= 70 ? 1 : s >= 45 ? 0 : -1;
}
export function isInFull(c: C2CContract): boolean { return c.fin.deliveredToCustomer >= c.order.qty; }
function perfRecord(c: C2CContract): C2CPerfRecord {
  return {
    id: c.id, orderId: c.orderId, client: c.order.client,
    supplier: c.po ? c.po.supplier : null, deliveryId: c.po ? c.po.deliveryId : null,
    onTime: c.onTime === true, inFull: isInFull(c), customerRejected: c.customerRejected,
    satisfaction: satisfactionOf(c), reputationDelta: repDeltaOf(c),
    delivered: c.fin.deliveredToCustomer, ordered: c.order.qty, supplierShortfall: c.mat.shortfall,
    incomingDefects: c.mat.quarantined + (c.mat.defectiveAccepted || 0) + (c.mat.rejected || 0), finishedScrapped: c.fin.scrapped,
    planned: plannedPnl(c), actual: actualPnl(c), grade: gradeOf(c), closedAt: c.t.deliveredAt ?? c.createdAt,
  };
}

// ---- Rolls + time helpers -------------------------------------------------
function rollAll(c: C2CContract) {
  const offer = c.po ? offerById(c.po.offerId) : null;
  const reliability = offer ? offer.reliability : 0.9;
  const expQ = offer ? offer.expectedQuality : c.po ? c.po.expectedQuality : 0.9;
  const supplierOnTime = seededUnit(c.seed, SALT.supplier) <= reliability;
  const shortfallFrac = supplierOnTime ? 0 : 0.12 + seededUnit(c.seed, SALT.shortfall) * 0.4;
  const incomingDefectFrac = clamp((1 - expQ) * (0.6 + seededUnit(c.seed, SALT.incoming) * 0.9), 0, 1);
  const makeBase = Math.max(0.02, 0.06 * (1 - (c.makeQuality - 0.5) * 1.6));
  const makeDefectFrac = clamp(makeBase + (seededUnit(c.seed, SALT.make) - 0.5) * 0.03, 0, 1);
  const reworkShare = 0.5 + seededUnit(c.seed, SALT.reworkShare) * 0.35;
  return { supplierOnTime, shortfallFrac, incomingDefectFrac, makeDefectFrac, reworkShare };
}
// A small fixed inbound-freight beat after the supplier finishes, so goods_received
// stays a distinct, observable stage rather than collapsing into supplier lead.
const INBOUND_TRANSIT = 1;
function keyOf(c: C2CContract, tag: string): string { return `c2c:${c.id}:${tag}`; }
