// @ts-nocheck
// The school fund — money raised at the children's lemonade stand pays for better
// school equipment, one tier at a time. Pure/testable: callers pass the running
// total raised. Costs are per-tier; a tier unlocks once the cumulative total is met.

export interface SchoolUpgrade { id: string; ic: string; name: string; cost: number; }

export const SCHOOL_UPGRADES: SchoolUpgrade[] = [
  { id: 'seating',    ic: '🪑', name: 'New Seating',             cost: 60 },
  { id: 'paintings',  ic: '🖼️', name: 'Wall Paintings',          cost: 150 },
  { id: 'statue',     ic: '🗿', name: 'Courtyard Statue',        cost: 320 },
  { id: 'library',    ic: '📚', name: 'Cultured Library',        cost: 600 },
  { id: 'tv',         ic: '📺', name: 'Classroom TV',            cost: 1000 },
  { id: 'whiteboard', ic: '🖥️', name: 'Interactive Whiteboard',  cost: 1600 },
];

// Total raised needed to have bought everything up to and including index i.
export function cumulativeCost(i: number): number {
  let s = 0;
  for (let k = 0; k <= i && k < SCHOOL_UPGRADES.length; k++) s += SCHOOL_UPGRADES[k].cost;
  return s;
}

// How many upgrades the school has bought for a given total raised.
export function schoolTier(raised: number): number {
  let n = 0;
  for (let i = 0; i < SCHOOL_UPGRADES.length; i++) {
    if (raised >= cumulativeCost(i)) n = i + 1; else break;
  }
  return n;
}

// The next upgrade being saved for, with progress — or null when all are bought.
export function nextUpgrade(raised: number): { upgrade: SchoolUpgrade; have: number; need: number } | null {
  const t = schoolTier(raised);
  if (t >= SCHOOL_UPGRADES.length) return null;
  const prev = t > 0 ? cumulativeCost(t - 1) : 0;
  return { upgrade: SCHOOL_UPGRADES[t], have: raised - prev, need: SCHOOL_UPGRADES[t].cost };
}

export function isSchoolComplete(raised: number): boolean {
  return schoolTier(raised) >= SCHOOL_UPGRADES.length;
}
