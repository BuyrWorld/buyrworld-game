// Milestone 5 — reward pacing & communication cleanup. Pure/testable notification
// priority + queue model, activity-log grouping, and the audited tutorial reward
// budget. The DOM toast/log/summary live in main.ts and use these.
import { stageById, TUTORIAL_CONTRACT, TUTORIAL_COMPLETE_BONUS } from './tutorial.ts';

// ---- Priority categories -------------------------------------------------
export type NotifyPriority = 'critical' | 'important' | 'routine';
export const NOTIFY_CATEGORIES: Record<string, NotifyPriority> = {
  // CRITICAL — must be understood, shown alone, persists
  story_objective: 'critical', contract_failed: 'critical', arrest: 'critical',
  district_unlocked: 'critical', save_problem: 'critical', supplier_failure: 'critical',
  court: 'critical',
  // IMPORTANT — one at a time, queued
  skill_level: 'important', award: 'important', journal_first: 'important',
  system_unlock: 'important', quality_failure: 'important', supplier_delay: 'important',
  relationship: 'important', furniture: 'important', cottage_upgrade: 'important',
  tutorial_step: 'important',
  // ROUTINE — small feedback, may be replaced
  gather: 'routine', produce: 'routine', small_sale: 'routine', coin_find: 'routine',
  purchase: 'routine', clean: 'routine', rubbish: 'routine', friendship: 'routine',
};
export function notifyPriority(category: string): NotifyPriority { return NOTIFY_CATEGORIES[category] || 'routine'; }
export const PRIORITY_RANK: Record<NotifyPriority, number> = { critical: 3, important: 2, routine: 1 };

// Configurable display durations — critical never vanishes instantly.
export const NOTIFY_DURATION: Record<NotifyPriority, number> = { critical: 5200, important: 3200, routine: 1800 };
export function notifyDuration(priority: NotifyPriority): number { return NOTIFY_DURATION[priority]; }
export function isManaged(priority: NotifyPriority): boolean { return priority !== 'routine'; }

// ---- Queue ---------------------------------------------------------------
export interface Notice { msg: string; priority: NotifyPriority; seq: number; }
// Which queued notice shows next: highest priority first, then FIFO (insertion order).
export function nextIndex(queue: Notice[]): number {
  if (!queue.length) return -1;
  let best = 0;
  for (let i = 1; i < queue.length; i++) {
    const a = queue[i], b = queue[best];
    if (PRIORITY_RANK[a.priority] > PRIORITY_RANK[b.priority] ||
       (PRIORITY_RANK[a.priority] === PRIORITY_RANK[b.priority] && a.seq < b.seq)) best = i;
  }
  return best;
}

// ---- Activity-log grouping ----------------------------------------------
// Repeated identical entries collapse into "… ×N" instead of many lines.
export interface LogGroup { base: string; count: number; cat: string; }
export function sameGroup(a: LogGroup | null, base: string): boolean { return !!a && a.base === base; }
export function groupedText(g: LogGroup): string { return g.count > 1 ? `${g.base} ×${g.count}` : g.base; }

// Log filter categories.
export const LOG_FILTERS = ['All', 'Work', 'Contracts', 'Quality', 'Procurement', 'Economy', 'Home', 'Social', 'Story', 'Law'] as const;
export type LogFilter = typeof LOG_FILTERS[number];
export function logMatchesFilter(cat: string, filter: LogFilter): boolean {
  if (filter === 'All') return true;
  const map: Record<string, LogFilter> = {
    work: 'Work', gather: 'Work', produce: 'Work',
    contract: 'Contracts', quality: 'Quality', procurement: 'Procurement', supplier: 'Procurement',
    economy: 'Economy', sale: 'Economy', purchase: 'Economy',
    home: 'Home', clean: 'Home', rubbish: 'Home', furniture: 'Home',
    social: 'Social', friendship: 'Social', relationship: 'Social',
    story: 'Story', journal: 'Story', journey: 'Story',
    law: 'Law', arrest: 'Law', court: 'Law',
  };
  return (map[cat] || 'All') === filter;
}

// ---- Audited tutorial reward budget --------------------------------------
// Target ~400–650 coins across the whole opening tutorial (Frosty + contract +
// bonus + kept achievements). No duplicated large coin rewards for one action.
// Derived from the ONE authoritative tutorial config so the budget can never
// drift from the per-stage rewards the player actually receives.
export const TUTORIAL_REWARDS = {
  mine: stageById('mine')!.reward.coins,
  smelt: stageById('smelt')!.reward.coins,
  make: stageById('make')!.reward.coins,
  deliver: stageById('deliver')!.reward.coins,
  contract: TUTORIAL_CONTRACT.coins,
  completeBonus: TUTORIAL_COMPLETE_BONUS,
};
export const TUTORIAL_ACHIEVEMENT_COINS = 110;   // first_swing 10 + hot_stuff 25 + made_here 25 + first_run 50 (kept, earned)
export const TUTORIAL_COIN_MIN = 400, TUTORIAL_COIN_MAX = 650;
export function tutorialCoinTotal(includeAchievements = true): number {
  const r = TUTORIAL_REWARDS;
  return r.mine + r.smelt + r.make + r.deliver + r.contract + r.completeBonus + (includeAchievements ? TUTORIAL_ACHIEVEMENT_COINS : 0);
}
export function tutorialTotalInRange(): boolean {
  const t = tutorialCoinTotal(true);
  return t >= TUTORIAL_COIN_MIN && t <= TUTORIAL_COIN_MAX;
}

// The three recommended next actions shown once the tutorial summary closes.
export const NEXT_ACTIONS = ['Improve Smelting', 'Explore Featherstone', 'Review Your Next Contract'];
// The progressive unlock schedule (not a single burst).
export const UNLOCK_SCHEDULE = {
  immediate: ['woodcutting', 'fishing'],
  afterSummary: ['trade', 'upgrades'],
  contextual: ['quality', 'suppliers', 'pets', 'journey', 'furniture', 'cleanliness'],
};
