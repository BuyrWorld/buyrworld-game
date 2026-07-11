// Milestone 1 — Deterministic tutorial supply chain. Pure/testable helpers for
// Frost's guaranteed Gather → Smelt → Manufacture → Deliver chain. The runtime
// (TUT steps, auto-stop, contract injection) lives in main.ts and uses these.

// The exact, guaranteed chain: 6 ore → 3 bars (2 ore each) → 3 brackets (1 bar
// each) → deliver 3 brackets. No grinding, no random contract required.
export const TUTORIAL_TARGETS: Record<string, number> = { iron_ore: 6, iron_bar: 3, bracket: 3 };

// Per-step (0..3) the item the player is producing and how many they need in hand.
// Step 3 is the delivery step (no production).
export const TUTORIAL_STEPS = [
  { key: 'mine',    item: 'iron_ore', need: 6, where: 'Quarry (far west)', target: 'rock_iron4' },
  { key: 'smelt',   item: 'iron_bar', need: 3, where: 'The Furnace',       target: 'furnace' },
  { key: 'make',    item: 'bracket',  need: 3, where: 'The Workshop',      target: 'workshop' },
  { key: 'deliver', item: 'bracket',  need: 3, where: 'The Depot',         target: 'depot' },
] as const;

// The guaranteed tutorial contract spec (never rotated, never expires while active).
export const TUTORIAL_CONTRACT = { client: 'Featherstone Works (Tutorial Order)', item: 'bracket', qty: 3, coins: 200, xp: 30 };

// During the tutorial, producing `itemId` should stop the job once the player has
// its target in hand — so no swing/yield/idle cycle overshoots the exact amount.
export function tutorialShouldStop(itemId: string, currentCount: number): boolean {
  const t = TUTORIAL_TARGETS[itemId];
  return t != null && currentCount >= t;
}
export function isTutorialItem(itemId: string): boolean { return itemId in TUTORIAL_TARGETS; }

// The minimum recovery grant for a partway-through save that lacks materials for
// the current step. Returns {} when nothing is needed (so it's never granted twice
// for an already-stocked player). Only the current step's input is topped up.
export function tutorialRecovery(step: number, inv: { iron_ore?: number; iron_bar?: number; bracket?: number }): Record<string, number> {
  const ore = inv.iron_ore || 0, bar = inv.iron_bar || 0, brk = inv.bracket || 0;
  if (step === 1){ const needBar = Math.max(0, 3 - bar); const needOre = Math.max(0, needBar * 2 - ore); return needOre > 0 ? { iron_ore: needOre } : {}; }
  if (step === 2){ const needBrk = Math.max(0, 3 - brk); const needBar = Math.max(0, needBrk - bar); return needBar > 0 ? { iron_bar: needBar } : {}; }
  if (step === 3){ const needBrk = Math.max(0, 3 - brk); return needBrk > 0 ? { bracket: needBrk } : {}; }
  return {};
}
