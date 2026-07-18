// ============================================================================
// PLAYABLE PROCUREMENT — pure, testable supplier-selection + sourcing logic.
// ----------------------------------------------------------------------------
// Turns the Contract-to-Cash sourcing step into a real decision: three enriched
// supplier quotes, a sourcing PLAN (gather your own stock / buy / split across
// suppliers / standard vs expedited inbound), an up-front margin ESTIMATE with a
// clear risk read, deterministic supplier reliability outcomes, and a persistent
// per-supplier scorecard. No DOM, no game state — main.ts + c2cEngine wire it in.
// ============================================================================

import type { FlagshipOrder, SupplierOffer } from './contractToCash.ts';
import { seededUnit } from './c2cEngine.ts';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- Inbound delivery mode (standard vs expedited) ------------------------
export type InboundMode = 'standard' | 'expedited';
export interface InboundModeDef { id: InboundMode; name: string; leadMult: number; costMult: number; blurb: string; }
export const INBOUND_MODES: InboundModeDef[] = [
  { id: 'standard',  name: 'Standard',  leadMult: 1.0, costMult: 1.0, blurb: 'Normal freight — the quoted lead time.' },
  { id: 'expedited', name: 'Expedited', leadMult: 0.5, costMult: 1.8, blurb: 'Rush freight — about half the wait, ~80% more haulage.' },
];
export function inboundMode(id: InboundMode): InboundModeDef { return INBOUND_MODES.find(m => m.id === id) || INBOUND_MODES[0]; }

// ---- Persistent supplier scorecard ----------------------------------------
export interface SupplierScore { orders: number; onTime: number; late: number; short: number; qualitySum: number; }
export function blankScore(): SupplierScore { return { orders: 0, onTime: 0, late: 0, short: 0, qualitySum: 0 }; }
export interface ScoreStats { orders: number; onTimePct: number | null; avgQualityPct: number | null; }
export function scoreStats(s: SupplierScore | null | undefined): ScoreStats {
  if (!s || !s.orders) return { orders: 0, onTimePct: null, avgQualityPct: null };
  return { orders: s.orders, onTimePct: Math.round((s.onTime / s.orders) * 100), avgQualityPct: Math.round((s.qualitySum / s.orders) * 100) };
}
/** Fold one order's supplier outcome into the running scorecard (pure). */
export function recordSupplierResult(prev: SupplierScore | null | undefined, r: { onTime: boolean; short: boolean; quality: number }): SupplierScore {
  const s = prev ? { ...prev } : blankScore();
  s.orders++; if (r.onTime) s.onTime++; else s.late++; if (r.short) s.short++;
  s.qualitySum += clamp(r.quality, 0, 1);
  return s;
}

// ---- Quotes (controller-card-ready, plain-language) -----------------------
export interface Quote { offer: SupplierOffer; bestFor: string; tradeoff: string; stats: ScoreStats; }
function tradeoffLine(o: SupplierOffer): string {
  const price = o.unitPrice <= 36 ? 'cheap' : o.unitPrice >= 60 ? 'pricey' : 'fair-priced';
  const rel   = o.reliability >= 0.95 ? 'rock-solid' : o.reliability >= 0.85 ? 'dependable' : 'a gamble';
  const speed = o.leadMin <= 4 ? 'fast' : o.leadMin >= 10 ? 'slow' : 'steady';
  const green = o.sustainability >= 0.8 ? 'local & green' : o.sustainability <= 0.4 ? 'not very green' : 'ok on ethics';
  return `${cap(price)} bars, ${speed} delivery, ${rel} — ${green}.`;
}
/** Enrich the raw offers into quotes with a "best for X" tag + a one-line
 *  trade-off + the supplier's scorecard stats. So a player can read the
 *  difference between suppliers in a couple of seconds. */
export function quotesFor(offers: SupplierOffer[], scores?: Record<string, SupplierScore>): Quote[] {
  if (!offers.length) return [];
  const min = (sel: (o: SupplierOffer) => number) => offers.reduce((a, b) => sel(b) < sel(a) ? b : a);
  const max = (sel: (o: SupplierOffer) => number) => offers.reduce((a, b) => sel(b) > sel(a) ? b : a);
  const cheapest = min(o => o.unitPrice), fastest = min(o => o.leadMin);
  const reliablest = max(o => o.reliability), greenest = max(o => o.sustainability), biggest = max(o => o.capacity);
  return offers.map(o => {
    let bestFor = '';
    if (o === cheapest) bestFor = 'Cheapest';
    else if (o === reliablest) bestFor = 'Most reliable';
    else if (o === fastest) bestFor = 'Fastest';
    else if (o === greenest) bestFor = 'Greenest';
    else if (o === biggest) bestFor = 'Biggest capacity';
    return { offer: o, bestFor, tradeoff: tradeoffLine(o), stats: scoreStats(scores ? scores[o.id] : null) };
  });
}

// ---- The sourcing plan + its estimated outcome ----------------------------
export interface ProcLine { offerId: string; qty: number; }
export interface ProcPlan { gatherQty: number; lines: ProcLine[]; mode: InboundMode; }
export interface PlannedLine { offerId: string; supplier: string; qty: number; unitPrice: number; lineCost: number; transport: number; leadMin: number; }
export interface ProcPlanned {
  need: number; gatherQty: number; buyQty: number; sourced: number; covered: boolean;
  materialCost: number; logisticsCost: number; qualityCost: number; totalCost: number;
  revenue: number; margin: number; marginPct: number;
  worstLeadMin: number; etaMin: number; onTimeExpected: boolean;
  capacityOk: boolean; moqOk: boolean; risk: 'low' | 'medium' | 'high'; warnings: string[];
  lines: PlannedLine[]; ownQuality: number; blendedQuality: number; committedCost: number;
}
export interface PlanOpts { available?: number; ownQuality?: number; demandMult?: number; shipMin?: number; }
/**
 * Estimate a sourcing plan. Gathered material is your own stock (no cost, no
 * lead, your own quality); buy lines source from suppliers (one or two lines =
 * a split); expedited inbound trades cash for a shorter wait. Returns the full
 * cost/margin/risk read the confirm screen shows — clearly an ESTIMATE.
 */
export function planProcurement(order: FlagshipOrder, offers: SupplierOffer[], plan: ProcPlan, opts: PlanOpts = {}): ProcPlanned {
  const need = order.qty * order.materialPerUnit;
  const md = inboundMode(plan.mode);
  const demandMult = opts.demandMult ?? 1;
  const available = Math.max(0, opts.available ?? 0);
  const ownQuality = clamp(opts.ownQuality ?? 0.9, 0, 1);
  const shipMin = opts.shipMin ?? 5;
  const gatherQty = Math.max(0, Math.min(plan.gatherQty | 0, need, available));

  const warnings: string[] = [];
  const lines: PlannedLine[] = [];
  let materialCost = 0, logisticsCost = 0, worstLeadMin = 0, buyQty = 0, qualityUnits = 0, blendW = 0;
  let capacityOk = true, moqOk = true, worstReliability = 1;

  for (const l of (plan.lines || [])) {
    const o = offers.find(x => x.id === l.offerId);
    const qty = Math.max(0, l.qty | 0);
    if (!o || qty <= 0) continue;
    const unitPrice = Math.round(o.unitPrice * demandMult);
    const transport = Math.round(o.transportCost * md.costMult);
    materialCost += qty * unitPrice; logisticsCost += transport; buyQty += qty;
    const lead = Math.ceil(o.leadMin * md.leadMult);
    worstLeadMin = Math.max(worstLeadMin, lead);
    worstReliability = Math.min(worstReliability, o.reliability);
    qualityUnits += qty * o.expectedQuality; blendW += qty;
    if (qty > o.capacity) { capacityOk = false; warnings.push(`${o.supplier} can only supply ${o.capacity} — that line is over capacity.`); }
    if (qty < o.moq) { moqOk = false; warnings.push(`${o.supplier} needs a minimum order of ${o.moq}.`); }
    lines.push({ offerId: o.id, supplier: o.supplier, qty, unitPrice, lineCost: qty * unitPrice, transport, leadMin: lead });
  }
  // gathered stock contributes at your own quality — free and instant
  qualityUnits += gatherQty * ownQuality; blendW += gatherQty;
  const blendedQuality = blendW > 0 ? qualityUnits / blendW : ownQuality;

  const sourced = gatherQty + buyQty;
  const covered = sourced >= need;
  if (!covered) warnings.push(`Short by ${need - sourced} bars — you couldn't make all ${order.qty}.`);

  const expectedDefects = Math.round(order.qty * (1 - blendedQuality));
  const qualityCost = expectedDefects * order.reworkCostPerUnit;
  const totalCost = materialCost + logisticsCost + qualityCost;
  const revenue = order.quotedRevenue;
  const margin = revenue - totalCost;
  const etaMin = worstLeadMin + order.productionMin + shipMin;
  const onTimeExpected = etaMin <= order.deadlineMin;
  if (!onTimeExpected) warnings.push(`On paper the ${etaMin}-min pipeline misses the ${order.deadlineMin}-min deadline.`);

  const risk: 'low' | 'medium' | 'high' = (!covered || worstReliability < 0.75) ? 'high'
    : (worstReliability < 0.9 || !onTimeExpected) ? 'medium' : 'low';
  // "committed cost" = cash the player commits at PO time (materials + inbound
  // freight); rework/quality is only realised later, so it isn't committed yet.
  const committedCost = materialCost + logisticsCost;

  return {
    need, gatherQty, buyQty, sourced, covered,
    materialCost, logisticsCost, qualityCost, totalCost,
    revenue, margin, marginPct: revenue ? margin / revenue : 0,
    worstLeadMin, etaMin, onTimeExpected, capacityOk, moqOk, risk, warnings,
    lines, ownQuality, blendedQuality, committedCost,
  };
}

// ---- Deterministic supplier reliability outcome ---------------------------
export interface SupplyRoll { onTime: boolean; shortfallFrac: number; incomingDefectFrac: number; }
/** Roll a supplier's actual inbound performance from a seed — deterministic and
 *  reload-safe. Expedited freight is a touch more reliable; a miss short-ships
 *  and a lower-quality supplier arrives with more defects. */
export function supplierOutcome(seed: number, offer: SupplierOffer, mode: InboundMode, salt: number): SupplyRoll {
  const relBoost = mode === 'expedited' ? 0.04 : 0;
  const onTime = seededUnit(seed, salt) <= Math.min(0.995, offer.reliability + relBoost);
  const shortfallFrac = onTime ? 0 : 0.12 + seededUnit(seed, salt + 7) * 0.4;
  const incomingDefectFrac = clamp((1 - offer.expectedQuality) * (0.6 + seededUnit(seed, salt + 13) * 0.9), 0, 1);
  return { onTime, shortfallFrac, incomingDefectFrac };
}

// A sensible default plan: buy the whole requirement from one supplier, standard
// inbound — the simple baseline the UI starts from.
export function defaultPlan(order: FlagshipOrder, offer: SupplierOffer): ProcPlan {
  const need = order.qty * order.materialPerUnit;
  return { gatherQty: 0, lines: [{ offerId: offer.id, qty: Math.max(need, offer.moq) }], mode: 'standard' };
}
