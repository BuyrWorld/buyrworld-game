// M19 — Warehouse Management. Storage becomes a decision without ever blocking a
// loop or breaking a save: a lean (or expanded) warehouse earns a small "organised"
// speed bonus that tapers to nothing as it fills — never a penalty, never a hard
// cap. Pure/testable here; the gauge + expand button live in main.ts.

export interface WarehouseTier { tier: number; n: string; cap: number; cost: number; }

export const WAREHOUSE_TIERS: WarehouseTier[] = [
  { tier: 0, n: 'Lean-to Store', cap: 250,  cost: 0     },
  { tier: 1, n: 'Storeroom',     cap: 500,  cost: 2000  },
  { tier: 2, n: 'Warehouse',     cap: 1000, cost: 7500  },
  { tier: 3, n: 'Depot Store',   cap: 2000, cost: 22000 },
  { tier: 4, n: 'Grand Depot',   cap: 4000, cost: 60000 },
];

export function warehouseTierDef(tier: number): WarehouseTier {
  return WAREHOUSE_TIERS[Math.max(0, Math.min(WAREHOUSE_TIERS.length - 1, tier | 0))];
}
export function warehouseCap(tier: number): number { return warehouseTierDef(tier).cap; }
export function nextWarehouseTier(tier: number): WarehouseTier | null {
  return tier + 1 < WAREHOUSE_TIERS.length ? WAREHOUSE_TIERS[tier + 1] : null;
}

// Fill percentage (can exceed 100 when over capacity — the gauge clamps for display).
export function warehouseFillPct(used: number, cap: number): number {
  if (!cap || cap <= 0) return 0;
  return Math.round((Math.max(0, used) / cap) * 100);
}

// The "organised warehouse" speed factor for speedMult (where <1 = faster).
// Up to 8% faster with an empty store, tapering to exactly 1.0 (no change) once
// full or over — POSITIVE ONLY, so it can never make anyone slower than before.
export function organisedSpeedFactor(used: number, cap: number): number {
  if (!cap || cap <= 0) return 1;
  const fill = Math.max(0, used) / cap;
  if (fill >= 1) return 1;
  return 1 - 0.08 * (1 - fill);
}

// The smallest tier whose cap covers current usage — used to grandfather existing
// saves so their stock is always within capacity (they're never worse off).
export function tierForUsage(used: number): number {
  for (let i = 0; i < WAREHOUSE_TIERS.length; i++) if (WAREHOUSE_TIERS[i].cap >= (used || 0)) return i;
  return WAREHOUSE_TIERS.length - 1;
}

export function fillLabel(pct: number): string {
  if (pct >= 100) return 'Full';
  if (pct >= 80)  return 'Filling up';
  if (pct >= 40)  return 'Roomy';
  return 'Plenty of space';
}
