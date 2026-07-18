// Milestone — "Back on Shift" returning-player briefing. A concise, skippable
// summary shown after a meaningful absence, built ENTIRELY from real saved state.
// Pure + testable: main.ts assembles a plain snapshot and this module decides what
// (if anything) is worth surfacing and the single best next action.
//
// Guardrails baked in here:
//  • never invents offline production — `offline` lines are passed in from the real
//    catch-up, and are only echoed, never fabricated;
//  • no manipulative streaks / loss-aversion — tone is neutral and factual;
//  • expired contracts are explained fairly (they lapsed, clients sourced elsewhere);
//  • only genuinely-relevant items appear (empty categories are dropped).

export const MIN_ABSENCE_MS = 3 * 60 * 1000;    // below this, a return isn't "a shift" — never brief
export const SHORT_ABSENCE_MS = 20 * 60 * 1000; // a "short" absence (used by the skip-short setting)

export type BriefKind = 'info' | 'good' | 'warn' | 'action';
export type BriefAction = 'claim' | 'resume' | 'contracts' | 'cottage' | 'start' | 'none';

export interface BriefItem { id: string; icon: string; text: string; kind: BriefKind; }
export interface Recommendation { action: BriefAction; label: string; why: string; }
export interface Briefing {
  show: boolean;
  absenceMs: number;
  short: boolean;
  awayLabel: string;
  items: BriefItem[];
  recommended: Recommendation | null;
  showCottageButton: boolean;
}

export interface ShiftInput {
  now: number;
  lastSeen: number;
  offline: { coins: number; lines: string[] };
  journey: { title: string | null; desc: string | null; cur: number; max: number; pct: number; claimable: boolean; complete: boolean };
  contracts: { pending: number; deliverable: number; expiredDuringAbsence: number };
  flagship: { active: boolean; stageLabel: string | null; decision: boolean };
  economy: { phaseName: string; phaseId: string; changed: boolean; demand: number };
  reputation: { expiredDent: boolean; delta: number; note: string | null };
  claimable: { any: boolean; label: string | null };
  cottage: { active: boolean; band: string; needsClean: boolean };
  production: { running: boolean; label: string | null };
}

export function awayLabel(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = ms / 3600000;
  if (h < 24) return `${h.toFixed(h < 10 ? 1 : 0)} hr`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''}`;
}

/** Build the briefing from a real-state snapshot. `opts.skipShort` mirrors the
 *  player's "don't show again for short absences" preference. */
export function buildBriefing(inp: ShiftInput, opts: { skipShort: boolean }): Briefing {
  const absenceMs = Math.max(0, (inp.now || 0) - (inp.lastSeen || 0));
  const short = absenceMs < SHORT_ABSENCE_MS;

  // Something that always warrants a heads-up, even on a short absence: work lapsed,
  // a reward is waiting, or a flagship order is paused mid-decision.
  const important = inp.contracts.expiredDuringAbsence > 0 || inp.claimable.any || inp.journey.claimable || (inp.flagship.active && inp.flagship.decision);

  let show = true;
  if (absenceMs < MIN_ABSENCE_MS) show = false;         // barely stepped away
  else if (short && opts.skipShort && !important) show = false;   // respected the skip-short preference

  const items: BriefItem[] = [];
  const push = (id: string, icon: string, text: string, kind: BriefKind) => items.push({ id, icon, text, kind });

  // Real offline catch-up (never invented) — only if something actually happened.
  if (inp.offline.coins > 0 || inp.offline.lines.length) {
    const detail = inp.offline.lines.length ? ` (${inp.offline.lines.join(', ')})` : '';
    push('offline', '🌙', `While you were away you earned +${inp.offline.coins} coins${detail}.`, 'good');
  }

  // Expired contracts — explained fairly, no blame, no penalty framing beyond the truth.
  if (inp.contracts.expiredDuringAbsence > 0) {
    const n = inp.contracts.expiredDuringAbsence;
    push('expired', '⌛', `${n} contract${n > 1 ? 's' : ''} lapsed while you were away — those clients sourced elsewhere. No fee lost; just a small dip in their reputation. The board has refreshed.`, 'warn');
  }

  // Journey milestone + progress (the long-term direction).
  if (inp.journey.claimable) {
    push('journey', '🎁', `“${inp.journey.title}” is complete — a reward is ready to claim.`, 'good');
  } else if (inp.journey.title && !inp.journey.complete) {
    push('journey', '📖', `Founder's Journey: ${inp.journey.title} — ${inp.journey.cur}/${inp.journey.max} (${inp.journey.pct}%).`, 'info');
  }

  // A claimable reward outside the journey (welcome gifts, etc.).
  if (inp.claimable.any && inp.claimable.label) {
    push('claim', '🎁', inp.claimable.label, 'good');
  }

  // Active flagship order stage.
  if (inp.flagship.active && inp.flagship.stageLabel) {
    push('flagship', '⭐', `Your flagship order is in progress — ${inp.flagship.stageLabel}${inp.flagship.decision ? ' (waiting on your decision)' : ''}.`, inp.flagship.decision ? 'action' : 'info');
  }

  // Contracts on the board (pending / ready to deliver).
  if (inp.contracts.deliverable > 0) {
    push('contracts', '📋', `${inp.contracts.deliverable} contract${inp.contracts.deliverable > 1 ? 's are' : ' is'} ready to deliver right now.`, 'action');
  } else if (inp.contracts.pending > 0) {
    push('contracts', '📋', `${inp.contracts.pending} open contract${inp.contracts.pending > 1 ? 's' : ''} on the board.`, 'info');
  }

  // Market / economy change — only when the phase actually changed while away.
  if (inp.economy.changed) {
    const arrow = inp.economy.demand > 1.02 ? '📈' : inp.economy.demand < 0.98 ? '📉' : '📊';
    push('economy', arrow, `The market shifted to ${inp.economy.phaseName} while you were away.`, 'info');
  }

  // Cottage cleanliness — ONLY when action is genuinely needed (no nagging a tidy home).
  if (inp.cottage.active && inp.cottage.needsClean) {
    push('cottage', '🧹', `Your cottage is ${inp.cottage.band} — a quick tidy would lift its comfort.`, 'info');
  }

  // Current production / automation state (factual, no pressure).
  if (inp.production.running && inp.production.label) {
    push('production', '⚙️', `Still running: ${inp.production.label}.`, 'info');
  }

  const recommended = recommend(inp);

  return {
    show,
    absenceMs,
    short,
    awayLabel: awayLabel(absenceMs),
    items,
    recommended,
    showCottageButton: inp.cottage.active && inp.cottage.needsClean,
  };
}

// One recommended high-value next action, chosen by priority over REAL state only.
// Never stale: each branch is gated on the thing still being true right now.
function recommend(inp: ShiftInput): Recommendation | null {
  if (inp.journey.claimable && inp.journey.title)
    return { action: 'claim', label: `Claim your “${inp.journey.title}” reward`, why: 'a milestone is complete' };
  if (inp.claimable.any && inp.claimable.label)
    return { action: 'claim', label: inp.claimable.label, why: 'a reward is waiting' };
  if (inp.flagship.active && inp.flagship.decision)
    return { action: 'resume', label: 'Resume your flagship order', why: 'it’s paused on your decision' };
  if (inp.contracts.deliverable > 0)
    return { action: 'contracts', label: 'Deliver a ready contract', why: 'you have the goods on hand' };
  if (inp.cottage.active && inp.cottage.needsClean)
    return { action: 'cottage', label: 'Tidy your cottage', why: 'its comfort has slipped' };
  if (inp.journey.title && !inp.journey.complete && inp.journey.desc)
    return { action: 'start', label: inp.journey.desc, why: `progress “${inp.journey.title}”` };
  if (inp.contracts.pending > 0)
    return { action: 'contracts', label: 'Check the contracts board', why: 'orders are waiting' };
  return null;
}
