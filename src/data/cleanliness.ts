// Milestone 3 — cottage cleanliness & household routine. A gentle, cosy loop:
// living in the cottage makes a little mess, tidying/binning it keeps a comfortable
// home for modest rewards. Pure/testable; the mess objects, bin and UI live in
// main.ts. No punishing drains, no manipulative streaks.

// ---- Cleanliness bands ---------------------------------------------------
export interface CleanBand { min: number; id: string; label: string; color: string; }
export const CLEAN_BANDS: CleanBand[] = [
  { min: 90, id: 'sparkling', label: 'Sparkling', color: '#5cc98a' },
  { min: 70, id: 'tidy',      label: 'Tidy',      color: '#8ad06a' },
  { min: 45, id: 'lived_in',  label: 'Lived-in',  color: '#e8c94a' },
  { min: 20, id: 'messy',     label: 'Messy',     color: '#e8a04a' },
  { min: 0,  id: 'filthy',    label: 'Filthy',    color: '#e8604a' },
];
export function cleanBand(rating: number): CleanBand {
  for (const b of CLEAN_BANDS) if ((rating || 0) >= b.min) return b;
  return CLEAN_BANDS[CLEAN_BANDS.length - 1];
}
export const START_CLEAN = 85;   // a new cottage: not perfect, not dirty
const clamp = (v: number) => Math.max(0, Math.min(100, v));

// ---- Decline through ACTIVITY (not idle waiting) -------------------------
// Small, occasional decrements from actually living in the home.
export const ACTIVITY_DECLINE: Record<string, number> = {
  cook: 3, sleep: 2, mine_return: 2, craft_indoor: 1.5, host: 4, party: 6, pet: 1,
};
export function activityDecline(activity: string): number { return ACTIVITY_DECLINE[activity] || 0; }
export function applyActivity(rating: number, activity: string): number { return clamp((rating == null ? START_CLEAN : rating) - activityDecline(activity)); }

// Offline decline is tiny and hard-capped, so a returning player never finds a
// filthy house they didn't cause.
export const OFFLINE_DECLINE_CAP = 6;
export function cappedOfflineDecline(hoursAway: number): number {
  return Math.max(0, Math.min(OFFLINE_DECLINE_CAP, Math.floor((hoursAway || 0) * 0.4)));
}

// ---- Visible mess --------------------------------------------------------
export interface MessKind { id: string; ic: string; tier: number; }   // tier: 1 lived-in, 2 messy, 3 filthy
export const MESS_KINDS: MessKind[] = [
  { id: 'cup',      ic: '🥤', tier: 1 },
  { id: 'paper',    ic: '📰', tier: 1 },
  { id: 'clothes',  ic: '🧺', tier: 1 },
  { id: 'wrapper',  ic: '🍬', tier: 2 },
  { id: 'dust',     ic: '💨', tier: 2 },
  { id: 'laundry',  ic: '🧦', tier: 2 },
  { id: 'bag',      ic: '🗑️', tier: 3 },
  { id: 'smell',    ic: '🌀', tier: 3 },
];
export function messKindById(id: string): MessKind | null { return MESS_KINDS.find(m => m.id === id) || null; }
// How many mess objects a room at this rating should hold (capped so the room is
// never unusable).
export const MAX_MESS = 5;
export function targetMessCount(rating: number): number {
  const b = cleanBand(rating).id;
  return b === 'sparkling' || b === 'tidy' ? 0 : b === 'lived_in' ? 1 : b === 'messy' ? 3 : MAX_MESS;
}
// The kinds to show at a rating (escalating tiers; deterministic-ish selection).
export function messKindsFor(rating: number): string[] {
  const n = targetMessCount(rating);
  const maxTier = cleanBand(rating).id === 'filthy' ? 3 : cleanBand(rating).id === 'messy' ? 2 : 1;
  // worst-first, so a filthy room actually shows the heavier mess kinds
  const pool = MESS_KINDS.filter(m => m.tier <= maxTier).slice().sort((a, b) => b.tier - a.tier);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pool[i % pool.length].id);
  return out;
}

// ---- Cleaning actions ----------------------------------------------------
// Cleanliness gained per action (tier = equipment/help level). Picking up a single
// item is worth a little; tidying more; a full clean a lot (rarely needed).
export function cleanGain(action: string, tier = 0): number {
  if (action === 'pickup') return 2;
  if (action === 'tidy')   return 14 + tier * 4;
  if (action === 'full')   return 45 + tier * 8;
  return 0;
}

// ---- Outdoor bin & weekly collection -------------------------------------
export const BIN_CAPACITY = 8;
export function binLevel(fill: number, cap = BIN_CAPACITY): string {
  const f = fill || 0;
  return f >= cap ? 'full' : f > 0 ? 'partial' : 'empty';
}
export function binHasRoom(fill: number, cap = BIN_CAPACITY): boolean { return (fill || 0) < cap; }
// Collection happens on one game-day each week.
export const COLLECTION_WEEKDAY = 2;
export function isCollectionDay(gameDay: number): boolean { return (((gameDay || 0) % 7) + 7) % 7 === COLLECTION_WEEKDAY; }
export function daysUntilCollection(gameDay: number): number {
  for (let i = 0; i < 7; i++) if (isCollectionDay((gameDay || 0) + i)) return i;
  return 7;
}

// ---- Furniture shine & dust ----------------------------------------------
// New furniture keeps its shine for a while after placement, then settles.
export const SHINE_MS = 3 * 60 * 1000;   // ~3 real minutes
export function shineRemaining(placedAt: number, now: number): number { return Math.max(0, SHINE_MS - (now - (placedAt || 0))); }
export function isShiny(placedAt: number, now: number): boolean { return placedAt > 0 && shineRemaining(placedAt, now) > 0; }

// ---- Comfort score -------------------------------------------------------
// Combines cleanliness, furniture quality/variety, upgrade tier and — importantly —
// leaves room: cramming every square with furniture does NOT maximise comfort.
export function comfortScore(p: { cleanliness: number; furnitureCount: number; variety: number; homeTier: number; totalCells: number }): number {
  const clean = (p.cleanliness || 0) * 0.4;                                   // up to 40
  const furn = Math.min(20, (p.furnitureCount || 0) * 4);                     // up to 20 (5 pieces)
  const variety = Math.min(15, (p.variety || 0) * 3);                         // up to 15 (5 kinds)
  const tier = Math.min(10, (p.homeTier || 0) * 3);                           // up to 10
  // walking space: best around 30–60% filled; overcrowding costs comfort
  const fill = p.totalCells > 0 ? (p.furnitureCount || 0) / p.totalCells : 0;
  const space = fill <= 0.5 ? 15 : Math.max(0, 15 - (fill - 0.5) * 40);       // up to 15, falls when crammed
  return Math.round(clean + furn + variety + tier + space);
}

// ---- First-time goals (one-off, exploit-proof) ---------------------------
export interface CleanGoal { id: string; label: string; reward: number; }
export const CLEAN_GOALS: CleanGoal[] = [
  { id: 'first_tidy',  label: 'First Tidy-Up',  reward: 40 },
  { id: 'bin_day',     label: 'Bin Day',        reward: 30 },
  { id: 'house_proud', label: 'House Proud',    reward: 80 },   // reach Sparkling
  { id: 'perfect_host',label: 'Perfect Host',   reward: 100 },  // host while Sparkling
  { id: 'spring_clean',label: 'Spring Clean',   reward: 120 },  // a full clean
];
export function cleanGoalById(id: string): CleanGoal | null { return CLEAN_GOALS.find(g => g.id === id) || null; }
