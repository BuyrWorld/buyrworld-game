// @ts-nocheck
// M24 — Town Evolution. Featherstone visibly grows as the player succeeds: crossing a
// net-worth threshold advances the town through stages, each announcing itself and
// unlocking a few ambient world decorations (drawn in main.ts's drawExtras). Pure +
// deterministic here so it's unit-testable; the celebration, persistence and props live
// in main.ts. Net worth is the driver — a clean proxy for overall business success.

export interface TownTier {
  idx: number;
  id: string;
  name: string;
  at: number;          // net-worth threshold to reach this tier
  blurb: string;
  unlocks: string[];   // decor flags this tier ADDS (cumulative up the ladder)
}

// Ordered by threshold. The first tier is the starting state (threshold 0).
export const TOWN_TIERS: TownTier[] = [
  { idx:0, id:'hamlet',        name:'Hamlet',        at:0,      blurb:'A quiet cluster of cottages by the quarry.',        unlocks:[] },
  { idx:1, id:'village',       name:'Village',       at:5000,   blurb:'A proper village green and a bit of bustle.',       unlocks:['bunting'] },
  { idx:2, id:'market_town',   name:'Market Town',   at:25000,  blurb:'Traders flock in; the market hums all day.',        unlocks:['bunting','extra_stalls'] },
  { idx:3, id:'bustling_town', name:'Bustling Town', at:100000, blurb:'Banners fly and the streets are never empty.',      unlocks:['bunting','extra_stalls','banners'] },
  { idx:4, id:'boomtown',      name:'Boomtown',      at:400000, blurb:'A thriving boomtown — Featherstone has arrived.',    unlocks:['bunting','extra_stalls','banners','street_lamps'] },
];

// Index of the tier for a given net worth (highest tier whose threshold is met).
export function townTierIndex(netWorth: number): number {
  const nw = Math.max(0, netWorth || 0);
  let i = 0;
  for (let k = 0; k < TOWN_TIERS.length; k++) if (nw >= TOWN_TIERS[k].at) i = k;
  return i;
}
export function townTier(netWorth: number): TownTier {
  return TOWN_TIERS[townTierIndex(netWorth)];
}
export function townTierById(id: string): TownTier | null {
  return TOWN_TIERS.find(t => t.id === id) || null;
}
// The next tier up, or null at the top.
export function nextTownTier(netWorth: number): TownTier | null {
  const i = townTierIndex(netWorth);
  return i < TOWN_TIERS.length - 1 ? TOWN_TIERS[i + 1] : null;
}
// The decor flags active at a given net worth (the current tier's cumulative unlocks).
export function tierUnlocks(netWorth: number): string[] {
  return townTier(netWorth).unlocks.slice();
}
// Whether a specific decoration is active at the given net worth.
export function townHasDecor(netWorth: number, flag: string): boolean {
  return townTier(netWorth).unlocks.includes(flag);
}
// Progress 0..1 toward the next tier (1 at the top).
export function townProgress(netWorth: number): number {
  const nw = Math.max(0, netWorth || 0);
  const cur = townTier(nw), nxt = nextTownTier(nw);
  if (!nxt) return 1;
  const span = nxt.at - cur.at;
  return span > 0 ? Math.max(0, Math.min(1, (nw - cur.at) / span)) : 1;
}
