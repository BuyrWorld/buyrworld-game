// @ts-nocheck
// M12 — Active Swing Mode (design-gated, idle-protecting).
// A "swing" adds a chunk of progress to the CURRENT gathering action — additive
// only. It never grants bonus resources (completion still routes through
// completeAction) and never touches idle/offline catch-up. Higher tool tier =
// bigger chunk = fewer clicks per resource. A per-swing cooldown caps it at
// active-play speed so autoclickers can't outrun the design.

// Only the two "swing a tool at a resource" gathering skills support quick clicks;
// every other task (foraging, fishing, processing, etc.) stays at standard speed.
export const SWING_SKILLS = new Set<string>(['mining', 'woodcutting']);

// Progress added per swing, as a fraction of the action's duration, indexed by
// tool tier (0 wood → 4 diamond). Every value is < 1, so a single click can
// never complete an action from a standing start.
export const SWING_FRAC = [0.17, 0.24, 0.32, 0.40, 0.50];

// Minimum ms between swings (anti-autoclicker; ~9 swings/sec max).
export const SWING_COOLDOWN_MS = 110;

export function isSwingSkill(skill: string): boolean {
  return SWING_SKILLS.has(skill);
}

// Approx clicks to fell/mine one resource from empty at a given tier (display/test).
export function swingClicks(tier: number): number {
  const f = SWING_FRAC[Math.max(0, Math.min(SWING_FRAC.length - 1, tier))];
  return Math.ceil(1 / f);
}
