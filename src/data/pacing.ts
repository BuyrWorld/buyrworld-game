// ============================================================================
// FIRST-SESSION PACING — pure, testable rules for notification gating during
// Frosty's tutorial, the "Choose Your Next Step" recommendation, and staged
// feature unlocks. No DOM/game-state here; main.ts wires these into notify(),
// the tick-loop spawners, the tutorial summary and the unlock cards.
//
// Goal: while the tutorial is active, Frosty's guidance has the stage to itself.
// Festivals, awards, ambient contracts, radio unlocks and journal rewards are
// held back (still logged) and introduced calmly afterwards, a little at a time.
// ============================================================================

// Only these notification categories may interrupt while the tutorial is active;
// everything else is DEFERRED (queued + logged, surfaced calmly afterwards).
// Kept deliberately small: Frosty's own step guidance, plus genuine safety events
// the player must see immediately.
export const TUTORIAL_ALLOWED_CATEGORIES: ReadonlySet<string> = new Set([
  'tutorial_step',                                   // Frosty's guidance
  'save_problem', 'arrest', 'court', 'contract_failed',   // genuine safety / critical
]);

/** True when a notification of `category` should be held back during the tutorial. */
export function shouldDeferDuringTutorial(category: string, tutorialActive: boolean): boolean {
  if (!tutorialActive) return false;
  return !TUTORIAL_ALLOWED_CATEGORIES.has(category);
}

/** Ambient spawners (delivery requests, notice-board quests, villager requests,
 *  festival toasts) must not fire while the tutorial is active. */
export function ambientBlockedDuringTutorial(tutorialActive: boolean): boolean {
  return !!tutorialActive;
}

// ---- Choose Your Next Step -----------------------------------------------
export type NextStepId = 'production' | 'contract' | 'explore';
export interface NextStep { id: NextStepId; icon: string; title: string; desc: string; tab: string; }
export const NEXT_STEPS: NextStep[] = [
  { id: 'production', icon: '🔥', title: 'Improve your production chain', desc: 'Smelt more Iron Bars and press more Brackets to raise your output.', tab: 'steelworks' },
  { id: 'contract',   icon: '📋', title: 'Complete another customer contract', desc: 'Take a fresh order at the Depot and deliver it for coins + reputation.', tab: 'contracts' },
  { id: 'explore',    icon: '🗺️', title: 'Explore Featherstone', desc: 'Wander the valley, meet the villagers, and uncover new corners.', tab: 'village' },
];
export function nextStepById(id: NextStepId): NextStep { return NEXT_STEPS.find(s => s.id === id) || NEXT_STEPS[0]; }

// Recommend ONE path from current stock + progression (req 5).
export interface NextStepCtx { brackets: number; bars: number; ore: number; coins: number; contractsDone: number; }
export function recommendNextStep(c: NextStepCtx): NextStepId {
  // Finished goods on hand → nudge toward turning them into a paid contract.
  if ((c.brackets || 0) >= 3) return 'contract';
  // Raw/'half-made materials but not enough finished goods → build the chain up.
  if ((c.bars || 0) >= 1 || (c.ore || 0) >= 2) return 'production';
  // Empty-handed but they've delivered before → time to go and explore.
  if ((c.contractsDone || 0) >= 1) return 'explore';
  // Fresh out of the tutorial with nothing staged → rebuild the chain.
  return 'production';
}
/** A short reason string for the recommendation (for the "Recommended" chip). */
export function recommendReason(id: NextStepId, c: NextStepCtx): string {
  if (id === 'contract')   return `You have ${c.brackets} Brackets ready to sell.`;
  if (id === 'production')  return (c.bars || c.ore) ? 'You have materials to turn into goods.' : 'Rebuild your stock of Brackets.';
  return 'You have delivered before — go and see the valley.';
}

// ---- Staged feature unlocks (req 6/7) -------------------------------------
export interface UnlockFeature { id: string; icon: string; title: string; blurb: string; actionLabel: string; tab: string; }
// Introduced in SMALL GROUPS (not every icon at once). Each carries a short
// explanation, one meaningful action, and an implicit "Not now".
export const UNLOCK_GROUPS: UnlockFeature[][] = [
  [ { id: 'trade',     icon: '⚖️', title: 'The Trade Post',   blurb: 'Buy raw materials and sell surplus goods with Marge.',        actionLabel: 'Open Trade',      tab: 'trade' },
    { id: 'contracts', icon: '📋', title: 'Contracts Board',  blurb: 'Take customer orders for steady coins and reputation.',       actionLabel: 'See Contracts',   tab: 'contracts' } ],
  [ { id: 'woodcutting', icon: '🪓', title: 'Woodcutting',    blurb: 'Chop trees around the valley for wood and planks.',           actionLabel: 'Try Woodcutting', tab: 'woodcutting' },
    { id: 'fishing',     icon: '🎣', title: 'Fishing',        blurb: 'Cast off at the pier for fish to sell or cook.',              actionLabel: 'Go Fishing',      tab: 'fishing' } ],
  [ { id: 'upgrades',  icon: '⬆️', title: 'Upgrades',         blurb: 'Spend coins to speed up and expand your whole operation.',    actionLabel: 'View Upgrades',   tab: 'upgrades' } ],
];
export const UNLOCK_GROUP_MAX = 2;   // never introduce more than 2 features at once
export function unlockGroupsWithinLimit(): boolean { return UNLOCK_GROUPS.every(g => g.length >= 1 && g.length <= UNLOCK_GROUP_MAX); }
/** The next group of features to introduce given which ids have already been shown. */
export function nextUnlockGroup(shownIds: string[]): UnlockFeature[] | null {
  const shown = new Set(shownIds || []);
  for (const g of UNLOCK_GROUPS) {
    if (g.some(f => !shown.has(f.id))) return g.filter(f => !shown.has(f.id));
  }
  return null;
}

// ---- Deferred-notice summary (req 2) -------------------------------------
// Collapse a batch of deferred notices into a compact, readable list (dedupe +
// count) so simultaneous rewards read as ONE summary, not a wall of toasts.
export function summariseDeferred(notices: { msg: string }[]): { msg: string; count: number }[] {
  const map = new Map<string, number>();
  for (const n of notices) map.set(n.msg, (map.get(n.msg) || 0) + 1);
  return Array.from(map.entries()).map(([msg, count]) => ({ msg, count }));
}
