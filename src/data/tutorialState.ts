// ============================================================================
// TUTORIAL SESSION STATE + MODAL/REWARD COORDINATOR — pure, testable rules.
// ----------------------------------------------------------------------------
// This module owns three things that used to be tangled inside main.ts and that
// caused the first-session reliability defects:
//
//   1. An explicit tutorial session state machine (req 1) so every system can
//      ask "what phase are we in?" instead of poking at S.tut.step ad-hoc.
//   2. A modal coordinator (req 5/6) that classifies every overlay and enforces
//      "never more than one blocking modal", with a clear priority order.
//   3. Reward coalescing (req 7) so several simultaneous unlocks read as ONE
//      compact summary instead of a stack of competing toasts.
//
// No DOM, no game state, no timers — main.ts wires these into the tutorial
// engine, the contract board, the notification pump and the onboarding flow.
// ============================================================================

// ---- 1. Session state machine (req 1) -------------------------------------

export type TutorialPhase =
  | 'not_started'            // no tutorial record yet (pre-init)
  | 'active'                 // working through an objective, inputs on hand
  | 'contract_ready'         // at the delivery stage; the Tutorial Order is deliverable
  | 'completed'              // whole chain finished (paid + bonus + reputation)
  | 'abandoned_recoverable'; // mid-tutorial but the current stage's inputs are missing
                             // (old 5/2/1 save, or resources spent elsewhere) — repairable

export interface TutRecord { step: number; done?: boolean }
export interface TutInv { iron_ore?: number; iron_bar?: number; bracket?: number }

export interface PhaseOpts {
  deliverStep: number;    // index of the final "deliver" stage
  stageCount: number;     // total number of stages
  // deficit of inputs the current stage needs but the player lacks ({} when fine)
  recovery: (step: number, inv: TutInv) => Record<string, number>;
}

/** Derive the authoritative tutorial phase from the save record + live inventory. */
export function tutorialPhase(tut: TutRecord | null | undefined, inv: TutInv, opts: PhaseOpts): TutorialPhase {
  if (!tut) return 'not_started';
  const step = tut.step | 0;
  if (tut.done || step >= opts.stageCount) return 'completed';
  if (step < 0) return 'not_started';
  // A stage whose required inputs are missing is recoverable (safe-repair, req 10).
  const deficit = opts.recovery(step, inv || {});
  if (deficit && Object.keys(deficit).length > 0) return 'abandoned_recoverable';
  if (step === opts.deliverStep) return 'contract_ready';
  return 'active';
}

/** The tutorial is "active" for gating purposes in every phase except completed/not_started. */
export function isTutorialRunning(phase: TutorialPhase): boolean {
  return phase === 'active' || phase === 'contract_ready' || phase === 'abandoned_recoverable';
}

/** True when the standard contract board must stay frozen (no countdowns, no
 *  expiry) because the tutorial still has the stage (req 2). Normal timers begin
 *  only once this returns false (req 3). */
export function contractsFrozen(phase: TutorialPhase): boolean {
  return isTutorialRunning(phase);
}

// ---- 2. Modal coordinator (req 5/6) ---------------------------------------
// Four lanes, highest priority first. Only ONE blocking modal is ever visible;
// the toast/reward lane never blocks and is handled by the notification pump.

export type ModalClass = 'critical' | 'tutorial' | 'optional' | 'toast';

export const MODAL_RANK: Record<ModalClass, number> = { critical: 3, tutorial: 2, optional: 1, toast: 0 };

/** A blocking modal dims the game and owns input. Toasts do not. */
export function isBlocking(c: ModalClass): boolean { return c !== 'toast'; }

// Classify a modal by its DOM id. Anything unknown is treated as 'optional' so a
// stray overlay can never masquerade as critical and steal a tutorial moment.
const CRITICAL_IDS = new Set(['save-problem-modal', 'arrest-modal', 'court-modal', 'recovery-modal']);
const TUTORIAL_IDS = new Set(['tut-summary', 'next-step-modal', 'welcome-modal', 'play-hint-overlay']);
export function classifyModal(id: string): ModalClass {
  if (!id) return 'optional';
  if (CRITICAL_IDS.has(id)) return 'critical';
  if (TUTORIAL_IDS.has(id)) return 'tutorial';
  return 'optional';
}

/**
 * May a modal of class `incoming` open right now, given the class of the current
 * topmost blocking modal (or null) and whether the tutorial is running?
 *
 *  - critical always preempts (safety events must be seen).
 *  - never cover a critical modal with anything.
 *  - never open a second blocking modal over an existing blocking one (req 6).
 *  - while the tutorial is running, an OPTIONAL informational modal may not
 *    interrupt the required tutorial actions (req 2) even with nothing open.
 */
export function canOpenModal(incoming: ModalClass, topOpen: ModalClass | null, tutorialActive: boolean): boolean {
  if (incoming === 'critical') return true;
  if (topOpen === 'critical') return false;
  if (topOpen && isBlocking(incoming) && isBlocking(topOpen)) return false;
  if (tutorialActive && incoming === 'optional' && !topOpen) return false;
  return true;
}

// ---- 3. Reward coalescing (req 7) -----------------------------------------

export interface RewardItem { label: string; coins?: number }
export interface RewardSummary { lines: { label: string; count: number }[]; totalCoins: number; count: number }

/** Collapse several simultaneous rewards/unlocks into ONE compact summary:
 *  de-duplicated lines with counts, plus the pooled coin total. */
export function summariseRewards(items: RewardItem[]): RewardSummary {
  const order: string[] = [];
  const counts = new Map<string, number>();
  let totalCoins = 0;
  for (const it of items || []) {
    if (!counts.has(it.label)) order.push(it.label);
    counts.set(it.label, (counts.get(it.label) || 0) + 1);
    totalCoins += it.coins || 0;
  }
  return { lines: order.map(label => ({ label, count: counts.get(label) || 1 })), totalCoins, count: (items || []).length };
}

// ---- 4. Resource conservation guard (req 10) ------------------------------

/** Validate that the tutorial invariant holds for a transition: production must
 *  never exceed the exact target for a tutorial item (6 ore / 3 bars / 3
 *  brackets). Returns the clamped-safe count. */
export function clampTutorialCount(target: number | undefined, current: number): number {
  if (target == null) return current;
  return Math.min(current, target);
}
