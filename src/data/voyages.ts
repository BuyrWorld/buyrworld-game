// @ts-nocheck
// Ocean voyages — dispatch a boat from the Harbour on a timed idle expedition; it
// sails off and returns after a while laden with cargo (coins + goods). A gentle
// passive layer that gives the Harbour District real purpose. Pure/testable.

export interface Voyage {
  id: string;
  name: string;
  ic: string;
  mins: number;                       // real-time duration
  cost: number;                       // coins to charter
  coins: number;                      // coins brought back
  items: Record<string, number>;      // goods brought back
}

export const MAX_VOYAGES = 3;         // boats you can have at sea at once

export const VOYAGE_DESTINATIONS: Voyage[] = [
  { id: 'coast', name: 'Coastal Run',  ic: '🛶', mins: 5,  cost: 50,   coins: 120,  items: { sardine: 5 } },
  { id: 'isles', name: 'The Isles',    ic: '⛵', mins: 15, cost: 150,  coins: 420,  items: { bass: 4, salmon: 1 } },
  { id: 'deep',  name: 'Deep Waters',  ic: '🚤', mins: 30, cost: 400,  coins: 1150, items: { tuna: 2, rare_wood: 2 } },
  { id: 'trade', name: 'Trade Convoy', ic: '🚢', mins: 60, cost: 1000, coins: 3000, items: { tech_alloy: 1, plank: 6 } },
];

export function voyageById(id: string): Voyage | undefined {
  return VOYAGE_DESTINATIONS.find(v => v.id === id);
}

export function voyageDurationMs(v: Voyage): number {
  return v.mins * 60 * 1000;
}

// 0..1 how far along a voyage is, given its return time and duration.
export function voyageProgress(startedAt: number, returnsAt: number, now: number): number {
  const total = returnsAt - startedAt;
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (now - startedAt) / total));
}

export function voyageReady(returnsAt: number, now: number): boolean {
  return now >= returnsAt;
}

// Rough profit of a voyage (cargo value in coins isn't included here — this is just
// the coin reward minus the charter cost, for display/testing).
export function voyageNetCoins(v: Voyage): number {
  return v.coins - v.cost;
}
