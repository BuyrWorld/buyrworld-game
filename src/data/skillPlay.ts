// Milestone — starter-skill gameplay differentiation. Each starter skill gets ONE
// distinct, optional, meaningful choice (its "approach") that trades off time, yield,
// quality, cost, rare-material chance and tool wear — so the skills stop feeling like
// the same passive timer. Pure + fully deterministic so every outcome is testable;
// main.ts applies these deltas in completeAction with exact accounting.
//
// Design guarantees baked in here:
//  • at least two genuinely viable approaches per skill (no single dominant pick);
//  • a "balanced" default so a player who never touches it still plays fine (assisted);
//  • automation is allowed but can only use the default approach — forgoing the skilled
//    bonus is the measurable cost of automating;
//  • no button mashing — an approach is a single up-front choice; fishing adds one
//    generous, assist-able bite-and-reel press.

export type StarterSkill = 'mining' | 'woodcutting' | 'fishing' | 'steelworks' | 'manufacturing';

export interface Approach {
  id: string;
  label: string;
  ic: string;
  desc: string;          // the consequence, shown before confirming
  timeMult: number;      // action-duration multiplier (1 = base)
  bonusYield: number;    // exact integer change to primary output per action (…-1,0,+1)
  qualityDelta: number;  // added to the producing-skill QC rating per action (0 for pure gathering)
  costMult: number;      // input/fuel consumption multiplier (1 = base)
  rareChance: number;    // 0..1 chance of a rare/bonus material this action
  wear: number;          // tool wear per action (relative; a measurable cost)
  reworkRisk: number;    // 0..1 defect/rework risk (manufacturing)
}

const A = (id: string, label: string, ic: string, desc: string, o: Partial<Approach>): Approach => ({
  id, label, ic, desc,
  timeMult: o.timeMult ?? 1, bonusYield: o.bonusYield ?? 0, qualityDelta: o.qualityDelta ?? 0,
  costMult: o.costMult ?? 1, rareChance: o.rareChance ?? 0, wear: o.wear ?? 1, reworkRisk: o.reworkRisk ?? 0,
});

// ---- Per-skill approaches (each list's FIRST entry is the balanced default) ----
export const APPROACHES: Record<StarterSkill, Approach[]> = {
  // Mining — seam selection + tool wear. Deep seams pay more ore + gems but grind tools.
  mining: [
    A('steady',  'Steady Dig',  '⛏️', 'Balanced pace. Normal yield, a small gem chance, normal tool wear.', { rareChance: 0.03, wear: 1 }),
    A('surface', 'Surface Pick', '🪨', 'Quick and gentle on tools — 15% faster, no gems, but easy on the pick.', { timeMult: 0.85, rareChance: 0, wear: 0.5 }),
    A('deep',    'Deep Seam',    '💎', 'Chase the rich seam: +1 ore and a better gem chance, but slower and hard on tools.', { timeMult: 1.3, bonusYield: 1, rareChance: 0.09, wear: 2 }),
  ],
  // Woodcutting — safe / fast / careful chopping.
  woodcutting: [
    A('safe',    'Safe Chop',    '🪓', 'Steady swings. Normal yield and a modest rare-wood chance.', { rareChance: 0.04, wear: 1 }),
    A('fast',    'Fast Chop',    '💨', '30% faster, but no rare wood and rougher on the axe.', { timeMult: 0.7, rareChance: 0, wear: 1.4 }),
    A('careful', 'Careful Fell', '🌳', 'Slow and deliberate: +1 log and the best rare-wood chance.', { timeMult: 1.4, bonusYield: 1, rareChance: 0.12, wear: 0.7 }),
  ],
  // Fishing — rod patience; the bite-and-reel press (below) then sets quality/species.
  fishing: [
    A('steady',  'Steady Cast',  '🎣', 'A relaxed line. Normal pace and a fair chance at a decent fish.', { rareChance: 0.06, wear: 1 }),
    A('quick',   'Quick Cast',   '💨', 'Short casts — 20% faster bites, but mostly common fish.', { timeMult: 0.8, rareChance: 0.02, wear: 1 }),
    A('patient', 'Patient Line', '🐟', 'Wait for the good ones: slower, but a real shot at prize species.', { timeMult: 1.3, rareChance: 0.14, wear: 1 }),
  ],
  // Smelting — furnace profile: economical / fast / quality.
  steelworks: [
    A('standard',   'Standard Heat', '🔥', 'A balanced burn. Normal fuel, time and bar quality.', {}),
    A('economical', 'Economical',    '🪵', '20% less fuel, but the bars run a little rougher.', { costMult: 0.8, timeMult: 1.1, qualityDelta: -4 }),
    A('fast',       'Fast Smelt',    '💨', '30% faster, but it drinks fuel and quality slips.', { timeMult: 0.7, costMult: 1.2, qualityDelta: -6 }),
    A('quality',    'Quality Pour',  '✨', 'Low and slow with extra fuel — noticeably better bars.', { timeMult: 1.4, costMult: 1.15, qualityDelta: 6 }),
  ],
  // Manufacturing — batch tolerance. Tighter tolerance = better quality, more time + rework.
  manufacturing: [
    A('standard', 'Standard Tolerance', '⚙️', 'Balanced spec. Normal time, quality and rework risk.', { reworkRisk: 0.06 }),
    A('loose',    'Loose Tolerance',    '🏭', 'Ship it fast — 20% quicker with little rework, but lower quality.', { timeMult: 0.8, qualityDelta: -5, reworkRisk: 0.02 }),
    A('tight',    'Tight Tolerance',    '🎯', 'Precision build: better quality, but slower and more likely to need rework.', { timeMult: 1.35, qualityDelta: 7, reworkRisk: 0.14 }),
  ],
};

export const STARTER_SKILLS = Object.keys(APPROACHES) as StarterSkill[];
export function isStarterSkill(skill: string): skill is StarterSkill { return skill in APPROACHES; }

export function defaultApproach(skill: StarterSkill): Approach { return APPROACHES[skill][0]; }
export function approachById(skill: StarterSkill, id: string | null | undefined): Approach {
  return APPROACHES[skill].find(a => a.id === id) || defaultApproach(skill);
}
// Automation may run a skill, but only ever on the balanced default — it can't work a
// deep seam, fell carefully or hold a tight tolerance. That forgone bonus IS the cost.
export function automationApproach(skill: StarterSkill): Approach { return defaultApproach(skill); }
// What a manual optimiser gives up by automating this skill (for UI + tests).
export function automationCost(skill: StarterSkill): { yield: number; quality: number; rare: number } {
  const def = defaultApproach(skill);
  const best = APPROACHES[skill].reduce((b, a) => (a.bonusYield > b.bonusYield || a.qualityDelta > b.qualityDelta || a.rareChance > b.rareChance) ? a : b, def);
  return {
    yield: Math.max(0, best.bonusYield - def.bonusYield),
    quality: Math.max(0, best.qualityDelta - def.qualityDelta),
    rare: Math.max(0, +(best.rareChance - def.rareChance).toFixed(2)),
  };
}

// ---- Fishing bite-and-reel -------------------------------------------------
// One press inside a GENEROUS window — never a mash. Assisted mode always lands a
// solid catch. Quality is highest just after the bite and stays good all window.
export const BITE_WINDOW_MS = 2500;
export interface ReelResult { ok: boolean; quality: number; reason: 'assisted' | 'good' | 'early' | 'missed'; }
export function reel(pressMs: number, biteMs: number, opts: { assisted?: boolean; windowMs?: number } = {}): ReelResult {
  if (opts.assisted) return { ok: true, quality: 0.72, reason: 'assisted' };
  const w = opts.windowMs ?? BITE_WINDOW_MS;
  const dt = pressMs - biteMs;
  if (dt < 0) return { ok: false, quality: 0, reason: 'early' };     // reeled before the bite
  if (dt > w) return { ok: false, quality: 0, reason: 'missed' };    // let it get away
  const q = Math.max(0.4, 1 - (dt / w) * 0.6);                       // 1.0 → 0.4 across the window
  return { ok: true, quality: Math.round(q * 100) / 100, reason: 'good' };
}

// ---- Applying an approach (deterministic, exact) ---------------------------
// baseYield is the recipe's primary output count. Returns the ACTUAL integer yield
// (base + bonus, never below the base's sign) — so inventory accounting stays exact.
export function resolvedYield(baseYield: number, approach: Approach): number {
  return Math.max(0, baseYield + approach.bonusYield);
}
// The action's real duration multiplier.
export function resolvedTimeMult(approach: Approach): number { return approach.timeMult; }
// Whether a rare/bonus material drops, given a unit roll in [0,1).
export function rareDrops(approach: Approach, roll: number): boolean { return roll < approach.rareChance; }
// Whether a manufactured unit needs rework, given a unit roll in [0,1).
export function needsRework(approach: Approach, roll: number): boolean { return roll < approach.reworkRisk; }

// Exact input consumption under a costMult, carrying the fraction so aggregate use
// over many actions equals round(N · base · costMult) — never a fractional item.
export function costWithCarry(base: number, costMult: number, carry: number): { take: number; carry: number } {
  const want = base * costMult + (carry || 0);
  const take = Math.max(0, Math.floor(want + 1e-9));
  return { take, carry: want - take };
}

// One-line consequence for the confirm step (mouse + controller + reduced-motion all
// read the same text — no animation required).
export function outcomeSummary(approach: Approach): string {
  const bits: string[] = [];
  const tp = Math.round((approach.timeMult - 1) * 100);
  if (tp !== 0) bits.push(tp < 0 ? `${-tp}% faster` : `${tp}% slower`);
  if (approach.bonusYield > 0) bits.push(`+${approach.bonusYield} yield`);
  if (approach.qualityDelta !== 0) bits.push(`${approach.qualityDelta > 0 ? '+' : ''}${approach.qualityDelta} quality`);
  const cp = Math.round((approach.costMult - 1) * 100);
  if (cp !== 0) bits.push(cp < 0 ? `${-cp}% less fuel` : `${cp}% more fuel`);
  if (approach.rareChance > 0) bits.push(`${Math.round(approach.rareChance * 100)}% rare`);
  if (approach.reworkRisk > 0) bits.push(`${Math.round(approach.reworkRisk * 100)}% rework`);
  return bits.join(' · ') || 'balanced';
}
