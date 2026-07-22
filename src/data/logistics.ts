// @ts-nocheck
// M20 — Logistics Decisions. When you deliver a contract you choose HOW to ship it,
// trading cost vs payout vs risk. Resolved instantly (keeps the satisfying "deliver →
// +coins" feedback); pure + deterministic here so it's unit-testable. The chosen default
// lives in S.logistics.method; the resolution + UI live in main.ts.

export interface LogisticsMethod {
  id: string;
  label: string;
  ic: string;
  blurb: string;
  payMult: number;   // multiplier applied to the base contract payout on success
  risk: number;      // 0..1 chance of a shipment mishap (delay/damage)
  mishapMult: number;// payout multiplier WHEN a mishap occurs (relative to base payout)
  bestFor: string;   // the contract tier this method suits (flavour/hint)
}

// Express = a courier's cut but zero risk (guaranteed, fast — beat a tight deadline).
// Standard = neutral, a tiny chance of a hiccup.
// Freight = a shipping saving you keep (bonus, higher expected value) but a real chance a
// delay/damage bites into the pay. Risk/reward, resolved at delivery.
export const LOGISTICS_METHODS: LogisticsMethod[] = [
  { id:'express',  label:'Express',  ic:'⚡', blurb:'Courier van — a cut off the top, but guaranteed and fast.',
    payMult:0.92, risk:0.00, mishapMult:0.92, bestFor:'rush' },
  { id:'standard', label:'Standard', ic:'🚚', blurb:'The usual lorry run. Full pay, the odd minor hiccup.',
    payMult:1.00, risk:0.08, mishapMult:0.90, bestFor:'standard' },
  { id:'freight',  label:'Freight',  ic:'🛳️', blurb:'Bulk freight — you keep the shipping saving, but it can be delayed or damaged.',
    payMult:1.12, risk:0.25, mishapMult:0.78, bestFor:'bulk' },
];

export const DEFAULT_LOGISTICS = 'standard';

export function logisticsMethod(id: string): LogisticsMethod {
  return LOGISTICS_METHODS.find(m => m.id === id) || LOGISTICS_METHODS.find(m => m.id === DEFAULT_LOGISTICS);
}

export interface Shipment { method: string; payout: number; mishap: boolean; basePayout: number; note: string; }

// Resolve a shipment for a base payout. `rng` (0..1) is supplied by the caller so tests
// can force success/failure. On a mishap, payout uses mishapMult; otherwise payMult.
export function resolveShipment(methodId: string, basePayout: number, rng: () => number = Math.random): Shipment {
  const m = logisticsMethod(methodId);
  const base = Math.max(0, Math.round(basePayout || 0));
  const mishap = m.risk > 0 && rng() < m.risk;
  const mult = mishap ? m.mishapMult : m.payMult;
  return {
    method: m.id,
    basePayout: base,
    payout: Math.max(0, Math.round(base * mult)),
    mishap,
    note: mishap ? 'Shipment delayed/damaged — reduced payout.' : '',
  };
}

// The payout shown on a contract card BEFORE risk is rolled (the success payout), so the
// player can compare methods at a glance.
export function quotedPayout(methodId: string, basePayout: number): number {
  return Math.max(0, Math.round((basePayout || 0) * logisticsMethod(methodId).payMult));
}

// Expected value of a method for a base payout (success + mishap branches), for tests /
// tooltips. Freight's EV should top Standard's, which tops Express's guaranteed cut.
export function expectedPayout(methodId: string, basePayout: number): number {
  const m = logisticsMethod(methodId);
  const base = basePayout || 0;
  return base * ((1 - m.risk) * m.payMult + m.risk * m.mishapMult);
}
