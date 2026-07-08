// @ts-nocheck
// LE1/LE2 — Living economy: supply/demand pressure + mean-reverting drift, plus a
// macro business cycle + news network.
// Pure & deterministic (except opt-in rng) so it can be unit-tested. See
// LIVING_ECONOMY_DESIGN.md. Everything is centred on 1.0 and hard-clamped, which
// is what keeps prices responsive yet free of inflation/deflation runaway.

export const ECON = {
  P_MIN: 0.55, P_MAX: 1.70, P_START: 1.0,   // per-item supply/demand pressure
  SELL_IMPACT: 0.15,                          // pressure drop for selling one "reference volume"
  BUY_IMPACT: 0.12,                           // pressure rise for buying one "reference volume"
  RECOVER: 0.06,                              // pressure heal toward 1.0 per market step (3 min)
  D_REVERT: 0.16, D_NOISE: 0.05,              // drift pull toward equilibrium + jitter per step
  D_MIN: 0.55, D_MAX: 1.55,                   // drift clamp (widened from the old [0.65,1.45])
  SALE_NUDGE: 0.5,                            // immediate market reaction to a sale (for visibility)
  F_MIN: 0.45, F_MAX: 2.2,                    // clamp on the propagated cost-push factor
};

export const clampP = (p: number) => Math.max(ECON.P_MIN, Math.min(ECON.P_MAX, p));
export const clampD = (d: number) => Math.max(ECON.D_MIN, Math.min(ECON.D_MAX, d));

// Reference sell volume that moves an item's price. Cheaper/bulkier goods have
// deeper markets (harder to move); pricier goods are thinner.
export function baseDemand(value: number): number {
  return Math.max(8, Math.min(60, Math.round(480 / ((value || 10) + 8))));
}

// Pressure drop from selling `qty` of an item worth `value`.
export function saleDrop(qty: number, value: number): number {
  return ECON.SELL_IMPACT * Math.max(0, qty) / baseDemand(value);
}
export function applySalePressure(p: number, qty: number, value: number): number {
  return clampP(p - saleDrop(qty, value));
}
// Buying raises pressure (demand/scarcity) — the driver of cost-push shortages.
export function applyBuyPressure(p: number, qty: number, value: number): number {
  return clampP(p + ECON.BUY_IMPACT * Math.max(0, qty) / baseDemand(value));
}

// Analytic recovery of pressure toward 1.0 across N market steps (offline-safe:
// one call handles many missed steps).
export function recoverPressure(p: number, steps: number): number {
  if (steps <= 0) return p;
  const k = 1 - Math.pow(1 - ECON.RECOVER, steps);
  return clampP(p + (1 - p) * k);
}

// One drift step toward equilibrium `eq` (with a little noise).
export function driftToward(d: number, eq: number, rng: () => number = Math.random): number {
  return clampD(d + (eq - d) * ECON.D_REVERT + (rng() - 0.5) * ECON.D_NOISE);
}

// Immediate partial market reaction to a shock (e.g. a sale) so the quoted price
// visibly moves right away, before the slower per-step reversion catches up.
export function nudgeDrift(d: number, target: number): number {
  return clampD(d + (target - d) * ECON.SALE_NUDGE);
}

// Trend glyph for the trader UI: high price (good to sell) vs soft (saturated).
export function trendArrow(d: number): '↑' | '↓' | '→' {
  return d > 1.06 ? '↑' : d < 0.94 ? '↓' : '→';
}

export const clampF = (f: number) => Math.max(ECON.F_MIN, Math.min(ECON.F_MAX, f));

// LE4 — mark inventory to the live market: qty × base value × current drift.
export function markToMarket(qty: number, value: number, drift: number): number {
  return Math.max(0, qty) * (value || 0) * (drift || 1);
}

// LE3 — supply-chain cost-push. An item's equilibrium factor is its own pressure
// times the (recursively-computed) cost ratio of its recipe inputs, so a shift in
// raw-material prices propagates up the production chain to processed goods.
//   recipeOf(id)  → { in: { [inputId]: qty } } | null   (null = raw / gathered)
//   valueOf(id)   → base value
//   pressureOf(id)→ current supply/demand pressure (default 1.0)
// `seen` guards against cyclic recipes.
export function baseFactor(
  item: string,
  recipeOf: (id: string) => any,
  valueOf: (id: string) => number,
  pressureOf: (id: string) => number,
  seen: Set<string> = new Set(),
): number {
  const p = clampP(pressureOf(item) ?? ECON.P_START);
  const rec = recipeOf(item);
  if (!rec || !rec.in || seen.has(item)) return p;   // raw material / gathered / cycle guard
  seen.add(item);
  let baseSum = 0, curSum = 0;
  for (const inId in rec.in) {
    const qty = rec.in[inId], v = valueOf(inId) || 0;
    baseSum += v * qty;
    curSum  += v * qty * baseFactor(inId, recipeOf, valueOf, pressureOf, seen);
  }
  seen.delete(item);
  const ratio = baseSum > 0 ? curSum / baseSum : 1;
  return clampF(p * ratio);
}

// ---------------------------------------------------------------------------
// LE2 — macro business cycle. A deterministic, offline-safe town-wide demand
// cycle (like the club themes): the whole market's equilibrium is scaled by the
// current phase's demand, so booms lift prices and downturns soften them.
import { DAY_DURATION_MS } from '../world/daynight.ts';

export const MACRO_EPOCH = Date.UTC(2026, 0, 5);   // shared fixed anchor
export const MACRO_PHASE_DAYS = 4;                 // each phase lasts 4 game days (~96 real min)
export const MACRO_SEQUENCE = ['steady', 'boom', 'steady', 'downturn', 'recovery'];

export const MACRO_PHASES: Record<string, any> = {
  boom:     { id:'boom',     name:'Boom',     demand:1.15, ic:'📈', tone:'good',
    head:'📈 Boom — demand surges across the valley; sell prices are strong.',
    flavour:["Warehouses can't keep up with orders.", "The whole valley is hiring.", "Margins are fat — sell into the rush."] },
  steady:   { id:'steady',   name:'Steady',   demand:1.00, ic:'📊', tone:'',
    head:'📊 Markets settle into a steady rhythm.',
    flavour:["Trade ticks along at a comfortable pace.", "No surprises at market today.", "Steady hands, steady margins."] },
  downturn: { id:'downturn', name:'Downturn', demand:0.85, ic:'📉', tone:'bad',
    head:'📉 Downturn — demand cools; hold your best stock if you can.',
    flavour:["Buyers are cautious; deals move slowly.", "Bargains for anyone with coin to spare.", "Belts are tightening across the valley."] },
  recovery: { id:'recovery', name:'Recovery', demand:0.95, ic:'🔄', tone:'',
    head:'🔄 Recovery — the valley economy is climbing back.',
    flavour:["Confidence is creeping back.", "Order books are filling again.", "The worst is behind us, they reckon."] },
};

const _macroPeriod = () => MACRO_PHASE_DAYS * DAY_DURATION_MS;

export function macroPhaseId(now = Date.now(), periodMs = _macroPeriod()): string {
  const n = MACRO_SEQUENCE.length;
  const i = Math.floor((now - MACRO_EPOCH) / periodMs) % n;
  return MACRO_SEQUENCE[((i % n) + n) % n];
}
export function macroPhase(now = Date.now(), periodMs = _macroPeriod()) {
  return MACRO_PHASES[macroPhaseId(now, periodMs)];
}
export function macroDemand(now = Date.now(), periodMs = _macroPeriod()): number {
  return macroPhase(now, periodMs).demand;
}
export function msToNextPhase(now = Date.now(), periodMs = _macroPeriod()): number {
  const off = ((now - MACRO_EPOCH) % periodMs + periodMs) % periodMs;
  return periodMs - off;
}
