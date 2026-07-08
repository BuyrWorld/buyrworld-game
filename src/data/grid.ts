// @ts-nocheck
// Energy & Data Centre — a tiered Power Grid facility. Each tier is a one-off
// upgrade (coins + advanced parts) that grants a global, idle-safe action-speed
// bonus (energy makes the whole town more efficient). Pure/testable; wired into
// speedMult() in main.ts. Distinct from per-skill automatons — this is town-wide.

export interface GridTier {
  tier: number; name: string; ic: string; speedBonus: number; ds: string;
  cost: { coins: number; items: Record<string, number> } | null;
}

export const GRID_TIERS: GridTier[] = [
  { tier:0, name:'Off-grid',    ic:'🔌', speedBonus:0.00, ds:'No grid power yet.', cost:null },
  { tier:1, name:'Power Grid',  ic:'⚡', speedBonus:0.04, ds:'−4% action time on every skill',
    cost:{ coins:8000,   items:{ sensor:2, chassis:2 } } },
  { tier:2, name:'Substation',  ic:'🔋', speedBonus:0.08, ds:'−8% action time on every skill',
    cost:{ coins:22000,  items:{ sensor:4, pallet_jack:2 } } },
  { tier:3, name:'Data Centre', ic:'🖥️', speedBonus:0.12, ds:'−12% action time on every skill',
    cost:{ coins:55000,  items:{ sensor:6, tech_alloy:3 } } },
  { tier:4, name:'Smart Grid',  ic:'🛰️', speedBonus:0.16, ds:'−16% action time on every skill',
    cost:{ coins:130000, items:{ sensor:10, tech_alloy:6 } } },
];

export const GRID_MAX_TIER = GRID_TIERS.length - 1;

export function gridTier(tier: number): GridTier {
  return GRID_TIERS[Math.max(0, Math.min(GRID_MAX_TIER, tier | 0))];
}
export function gridBonus(tier: number): number {
  return gridTier(tier).speedBonus;
}
export function gridNext(tier: number): GridTier | null {
  return tier < GRID_MAX_TIER ? GRID_TIERS[tier + 1] : null;
}
