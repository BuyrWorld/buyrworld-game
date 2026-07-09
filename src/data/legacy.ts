// @ts-nocheck
// The Legacy — a cosy prestige. Once you've built a legendary supply chain you can
// hand the valley to a successor and start a "New Chapter": your skills, coins and
// upgrades reset, but you keep a permanent Legacy that makes every future climb
// faster and more rewarding — plus a golden star by your name. Pure/testable.

export const PRESTIGE_MIN_TOTAL = 100;   // total skill level needed to start a new chapter

export function prestigeEligible(totalLevel: number): boolean {
  return (totalLevel || 0) >= PRESTIGE_MIN_TOTAL;
}

// Permanent bonuses from N completed chapters (Legacy level).
export function legacyXpMult(legacy: number): number {
  return 1 + 0.15 * Math.max(0, legacy || 0);   // +15% skill XP per legacy
}
export function legacySellMult(legacy: number): number {
  return 1 + 0.08 * Math.max(0, legacy || 0);    // +8% sell prices per legacy
}
export function legacyStars(legacy: number): number {
  return Math.max(0, Math.min(9, legacy || 0));
}

const RANKS = ["", "Valley Elder", "Valley Sage", "Valley Luminary", "Valley Paragon", "Valley Legend"];
export function legacyRank(legacy: number): string {
  const l = Math.max(0, legacy || 0);
  if (l <= 0) return "";
  if (l >= RANKS.length) return "Timeless Founder";
  return RANKS[l];
}

// A short summary of the permanent bonus, for the UI.
export function legacyBonusText(legacy: number): string {
  const l = Math.max(0, legacy || 0);
  return `+${Math.round((legacyXpMult(l) - 1) * 100)}% skill XP · +${Math.round((legacySellMult(l) - 1) * 100)}% sell prices`;
}
