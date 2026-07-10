// @ts-nocheck
// The Shipyard — boat upgrades for the Harbour. A better boat makes ocean
// voyages faster, hauls more cargo, lets you keep more boats at sea, and opens
// farther trade routes. Pure/testable; state is just S.fleet.tier (an index).

export interface BoatTier {
  tier: number;
  n: string; ic: string;
  cost: number;         // coins to upgrade INTO this tier (0 for the starting boat)
  speedMult: number;    // voyage duration multiplier (<1 = faster)
  cargoMult: number;    // reward multiplier (>1 = more coins + goods)
  maxBoats: number;     // boats you can have at sea at once
  ds: string;
}

export const FLEET_TIERS: BoatTier[] = [
  { tier: 0, n: 'Rowboat',          ic: '🚣', cost: 0,     speedMult: 1.00, cargoMult: 1.00, maxBoats: 3, ds: 'One oar and a lot of hope. Gets the job done.' },
  { tier: 1, n: 'Fishing Skiff',    ic: '⛵', cost: 1200,  speedMult: 0.90, cargoMult: 1.12, maxBoats: 3, ds: 'A proper little sail — quicker runs, fuller nets.' },
  { tier: 2, n: 'Coastal Cutter',   ic: '🛥️', cost: 4500,  speedMult: 0.80, cargoMult: 1.25, maxBoats: 4, ds: 'Trim and fast. Opens the Coral Reef route.' },
  { tier: 3, n: 'Deep-Sea Trawler', ic: '🚢', cost: 14000, speedMult: 0.70, cargoMult: 1.45, maxBoats: 4, ds: 'A heavy hauler that reaches the Far Horizon.' },
  { tier: 4, n: 'Merchant Clipper', ic: '⛴️', cost: 38000, speedMult: 0.62, cargoMult: 1.75, maxBoats: 5, ds: 'The pride of Port Salvo — swift, with vast holds.' },
];

export function boatTier(tier: number): BoatTier {
  const t = Math.max(0, Math.min(FLEET_TIERS.length - 1, tier | 0));
  return FLEET_TIERS[t];
}
export function nextBoatTier(tier: number): BoatTier | null {
  return tier + 1 < FLEET_TIERS.length ? FLEET_TIERS[tier + 1] : null;
}
export function fleetSpeedMult(tier: number): number { return boatTier(tier).speedMult; }
export function fleetCargoMult(tier: number): number { return boatTier(tier).cargoMult; }
export function fleetMaxBoats(tier: number): number { return boatTier(tier).maxBoats; }

export function fleetUpgradeCost(tier: number): number | null {
  const nx = nextBoatTier(tier);
  return nx ? nx.cost : null;
}
export function canUpgradeFleet(tier: number, coins: number): boolean {
  const nx = nextBoatTier(tier);
  return !!nx && coins >= nx.cost;
}
// A voyage route is available once your boat is good enough for it.
export function routeUnlocked(minTier: number, fleetTier: number): boolean {
  return (fleetTier | 0) >= (minTier || 0);
}
