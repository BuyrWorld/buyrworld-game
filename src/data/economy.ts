// @ts-nocheck
// LE1 — Living economy foundation: supply/demand pressure + mean-reverting drift.
// Pure & deterministic (except opt-in rng) so it can be unit-tested. See
// LIVING_ECONOMY_DESIGN.md. Everything is centred on 1.0 and hard-clamped, which
// is what keeps prices responsive yet free of inflation/deflation runaway.

export const ECON = {
  P_MIN: 0.55, P_MAX: 1.70, P_START: 1.0,   // per-item supply/demand pressure
  SELL_IMPACT: 0.15,                          // pressure drop for selling one "reference volume"
  RECOVER: 0.06,                              // pressure heal toward 1.0 per market step (3 min)
  D_REVERT: 0.16, D_NOISE: 0.05,              // drift pull toward equilibrium + jitter per step
  D_MIN: 0.55, D_MAX: 1.55,                   // drift clamp (widened from the old [0.65,1.45])
  SALE_NUDGE: 0.5,                            // immediate market reaction to a sale (for visibility)
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
