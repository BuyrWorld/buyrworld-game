// @ts-nocheck
// Fishing catch model — one cast, a probabilistic catch. Common fish are likely;
// rare, valuable fish (salmon, tuna) are unlikely, but a better rod (higher tool
// tier) shifts the odds toward them. Pure/testable: callers pass the rod tier and
// an rng. Rod tiers: 0 wood, 1 stone, 2 iron, 3 gold, 4 diamond.

export interface FishDef {
  id: string;
  rarity: number;      // 0 common … 3 prized (for flavour + toasts)
  xp: number;          // fishing XP granted for landing it
  baseWeight: number;  // odds at rod tier 0
  rodScale: number;    // extra weight per rod tier (rare fish scale up the most)
}

export const FISH: FishDef[] = [
  { id: 'sardine',  rarity: 0, xp: 8,  baseWeight: 100, rodScale: 0 },
  { id: 'mackerel', rarity: 0, xp: 14, baseWeight: 62,  rodScale: 2 },
  { id: 'bass',     rarity: 1, xp: 26, baseWeight: 28,  rodScale: 5 },
  { id: 'salmon',   rarity: 2, xp: 48, baseWeight: 8,   rodScale: 7 },
  { id: 'tuna',     rarity: 3, xp: 80, baseWeight: 2,   rodScale: 5 },
];

export function fishById(id: string): FishDef | undefined {
  return FISH.find(f => f.id === id);
}

// Catch weights at a given rod tier (rare fish grow more likely with a better rod).
export function catchWeights(rodTier: number): { id: string; w: number }[] {
  const rt = Math.max(0, rodTier || 0);
  return FISH.map(f => ({ id: f.id, w: Math.max(0, f.baseWeight + f.rodScale * rt) }));
}

// Roll a caught fish id. rng() in [0,1); deterministic given a seeded rng.
export function rollCatch(rodTier: number, rng: () => number): string {
  const ws = catchWeights(rodTier);
  const total = ws.reduce((a, b) => a + b.w, 0);
  let r = rng() * total;
  for (const x of ws) { if ((r -= x.w) < 0) return x.id; }
  return ws[0].id;
}

// Probability of landing a given fish at a rod tier (for UI / tests).
export function catchChance(id: string, rodTier: number): number {
  const ws = catchWeights(rodTier);
  const total = ws.reduce((a, b) => a + b.w, 0) || 1;
  const f = ws.find(x => x.id === id);
  return f ? f.w / total : 0;
}
