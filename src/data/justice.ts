// Justice System V2 — Crime Ledger, offence severity and proportionate consequences.
// Pure, deterministic and testable: no game imports. main.ts assembles the runtime
// ledger (S.justice) and calls these to classify offences, size consequences,
// decide escalation/spent status, and answer employment-eligibility questions.
// Fictional in-world justice for Featherstone Valley — never real legal advice.

// ---- Offence definitions (central, data-driven) --------------------------
export interface OffenceDef {
  id: string;
  name: string;
  category: 'property' | 'public-order' | 'financial';
  baseSpentDays: number;   // in-game days before it can become spent (scaled by severity)
}
export const OFFENCES: Record<string, OffenceDef> = {
  trespassing:      { id: 'trespassing',      name: 'Trespassing',          category: 'public-order', baseSpentDays: 3 },
  theft:            { id: 'theft',            name: 'Theft',                category: 'property',     baseSpentDays: 5 },
  burglary:         { id: 'burglary',         name: 'Burglary',             category: 'property',     baseSpentDays: 8 },
  shoplifting:      { id: 'shoplifting',      name: 'Shoplifting',          category: 'property',     baseSpentDays: 4 },
  property_damage:  { id: 'property_damage',  name: 'Property damage',      category: 'property',     baseSpentDays: 5 },
  antisocial:       { id: 'antisocial',       name: 'Antisocial behaviour', category: 'public-order', baseSpentDays: 4 },
  drunk_disorderly: { id: 'drunk_disorderly', name: 'Drunk & disorderly',   category: 'public-order', baseSpentDays: 3 },
  financial:        { id: 'financial',        name: 'Financial crime',      category: 'financial',    baseSpentDays: 12 },
};
export function offenceDef(id: string): OffenceDef | null { return OFFENCES[id] || null; }

// ---- Severity model ------------------------------------------------------
export const SEVERITY_LABELS = ['No further action', 'Warning', 'Minor', 'Moderate', 'Serious', 'Major'];
// levels: 0 = no offence, 1 = warning, 2 = minor, 3 = moderate, 4 = serious, 5 = major.
// (We keep an internal 0 = "not an offence" so e.g. drink without disorder records nothing.)
export function severityLabel(level: number): string {
  return SEVERITY_LABELS[Math.max(0, Math.min(SEVERITY_LABELS.length - 1, level | 0))];
}

export interface OffenceFactors {
  value?: number;             // value stolen/damaged (coins)
  isHome?: boolean;           // target was a private home
  warningsIgnored?: boolean;  // ignored a warning / stayed after being told to leave
  victims?: number;           // number of victims
  priorActive?: number;       // existing active offences on record
  intoxicated?: boolean;
  concealed?: boolean;        // tried to conceal the offence
  returned?: boolean;         // voluntarily returned the goods
  compensated?: boolean;      // paid compensation before recording
  disruptiveAction?: boolean; // an actual disorderly act occurred (for drunk & disorderly)
}

export interface Severity { level: number; label: string; reasons: string[]; }

const clampLevel = (n: number) => Math.max(0, Math.min(5, Math.round(n)));

// Offence-specific severity rules → an explainable result in plain language.
export function computeSeverity(offenceId: string, f: OffenceFactors = {}): Severity {
  const reasons: string[] = [];
  let level = 0;
  const v = Math.max(0, f.value || 0);
  const prior = Math.max(0, f.priorActive || 0);

  switch (offenceId) {
    case 'trespassing': {
      level = 1; reasons.push('Entered a place without permission');   // a warning by default
      if (f.isHome) reasons.push('It was a private home');
      if (f.warningsIgnored){ level += 1; reasons.push('You ignored a warning to leave'); }  // minor once warned
      if (prior >= 1){ level += 1; reasons.push('You have trespassed before'); }
      break;
    }
    case 'theft': {
      if (v < 50){ level = 2; reasons.push(`Low-value item (${v} coins)`); }
      else if (v < 200){ level = 3; reasons.push(`Item value ${v} coins`); }
      else { level = 4; reasons.push(`High-value item (${v} coins)`); }
      if (f.isHome){ level += 1; reasons.push('Taken from a private home'); }
      if (f.returned){ level -= 1; reasons.push('You returned the item voluntarily'); }
      break;
    }
    case 'burglary': {
      // burglary = the theft value-tier PLUS one (always graver than plain theft)
      const tier = v < 50 ? 2 : v < 200 ? 3 : 4;
      level = tier + 1; reasons.push('Entered unlawfully intending to steal');
      reasons.push(`Haul worth ${v} coins`);
      if (f.warningsIgnored){ level += 1; reasons.push('You ignored a warning'); }
      if (f.returned){ level -= 1; reasons.push('You returned the goods'); }
      break;
    }
    case 'shoplifting': {
      level = v < 100 ? 2 : 3; reasons.push(`Goods worth ${v} coins taken from a shop`);
      if (f.returned){ level -= 1; reasons.push('You returned the goods'); }
      break;
    }
    case 'property_damage': {
      if (v < 50){ level = 2; } else if (v < 200){ level = 3; } else { level = 4; }
      reasons.push(`Damage estimated at ${v} coins`);
      if (f.compensated){ level -= 1; reasons.push('You paid for the damage'); }
      break;
    }
    case 'antisocial': {
      level = 2; reasons.push('Disruptive public conduct');
      if (prior >= 1){ level += 1; reasons.push('Repeated behaviour'); }
      break;
    }
    case 'drunk_disorderly': {
      if (!f.disruptiveAction){ return { level: 0, label: severityLabel(0), reasons: ['Having a drink is not an offence — no further action'] }; }
      level = 2; reasons.push('Disorderly conduct while intoxicated');
      if (f.warningsIgnored){ level += 1; reasons.push('You ignored a warning'); }
      break;
    }
    case 'financial': {
      if (v < 100){ level = 3; } else if (v < 500){ level = 4; } else { level = 5; }
      reasons.push(`Financial loss around ${v} coins`);
      if (f.concealed){ level += 0; reasons.push('Records were falsified to conceal it'); }
      break;
    }
    default:
      level = 2; reasons.push('Public nuisance');
  }

  if (prior >= 1 && offenceId !== 'trespassing'){ level += Math.min(1, prior); reasons.push(`${prior} previous active offence${prior > 1 ? 's' : ''} on record`); }
  if (f.concealed && offenceId !== 'financial'){ level += 1; reasons.push('You tried to conceal it'); }

  level = clampLevel(level);
  return { level, label: severityLabel(level), reasons };
}

// ---- Strike points -------------------------------------------------------
// Warning 0 · minor 0.5 · moderate 1 · serious 2 · major 3. Not one-per-offence.
export function strikePointsFor(level: number): number {
  return [0, 0, 0.5, 1, 2, 3][clampLevel(level)];
}
export const STRIKE_ESCALATION_THRESHOLD = 3;

// Escalation: three active strike points, OR a single very serious (major) offence.
export function shouldEscalate(activeStrikePoints: number, level: number): boolean {
  return (activeStrikePoints || 0) >= STRIKE_ESCALATION_THRESHOLD || level >= 5;
}
export function legalStatus(activeStrikePoints: number): string {
  const s = activeStrikePoints || 0;
  if (s <= 0) return 'Clear record';
  if (s < 1.5) return 'Caution';
  if (s < STRIKE_ESCALATION_THRESHOLD) return 'At risk';
  return 'Case escalated';
}

// ---- Immediate consequences ----------------------------------------------
export interface Consequence {
  kind: string;              // warning | fine | restitution | detention | escalated
  warningOnly: boolean;
  fine: number;              // payable to the authorities
  compensation: number;      // payable to the victim
  confiscate: boolean;       // seize stolen goods
  community: number;         // community-service units assigned (0 = none)
  detain: boolean;
  escalate: boolean;
  summary: string;           // short plain-language line
}
// Money can't erase the record: fines/comp are proportionate but the incident and
// any escalation remain until it becomes spent through time + rehabilitation.
export function consequenceFor(offenceId: string, level: number, ctx: { value?: number; hasGoods?: boolean; activeStrikePoints?: number } = {}): Consequence {
  const v = Math.max(0, ctx.value || 0);
  const escalate = shouldEscalate((ctx.activeStrikePoints || 0) + strikePointsFor(level), level);
  const c: Consequence = { kind: 'warning', warningOnly: true, fine: 0, compensation: 0, confiscate: false, community: 0, detain: false, escalate, summary: '' };
  if (level <= 1){ c.kind = 'warning'; c.summary = 'Verbal warning — no further action for now.'; if (ctx.hasGoods){ c.confiscate = true; c.summary = 'Formal warning; anything taken is returned.'; } return c; }
  c.warningOnly = false;
  const isProperty = OFFENCES[offenceId]?.category === 'property';
  const isFinancial = OFFENCES[offenceId]?.category === 'financial';
  c.fine = Math.round((level - 1) * (isFinancial ? 60 : 25) + v * (isFinancial ? 0.25 : 0.1));
  if (isProperty || isFinancial){ c.compensation = Math.round(v * (isFinancial ? 1.0 : 0.75)); }
  if (ctx.hasGoods){ c.confiscate = true; }
  if (level >= 3){ c.community = level >= 4 ? 8 : 5; }
  if (level >= 4){ c.detain = true; }
  c.kind = escalate ? 'escalated' : (c.fine || c.compensation ? 'fine' : 'restitution');
  c.summary = escalate ? 'Case escalated to the Featherstone Magistrate.'
    : level >= 3 ? 'Fine, compensation and community service.'
    : 'Fine and compensation.';
  if (c.escalate) c.detain = true;
  return c;
}

// ---- Spent / rehabilitation ----------------------------------------------
// Days before an incident may become spent, scaled by severity and reduced by
// completed rehabilitation (never below a floor, and never while debt is unpaid).
export function spentDaysFor(offenceId: string, level: number, rehabReductionDays = 0): number {
  const base = (OFFENCES[offenceId]?.baseSpentDays || 4) + Math.max(0, level - 2) * 2;
  return Math.max(2, base - Math.max(0, rehabReductionDays));
}
export interface IncidentLike { day: number; level: number; type: string; finePaid?: boolean; compPaid?: boolean; fine?: number; compensation?: number; rehabDays?: number; escalate?: boolean; }
export function debtCleared(inc: IncidentLike): boolean {
  return (!(inc.fine) || inc.finePaid === true) && (!(inc.compensation) || inc.compPaid === true);
}
export function spentDay(inc: IncidentLike): number {
  return inc.day + spentDaysFor(inc.type, inc.level, inc.rehabDays || 0);
}
export function isSpent(inc: IncidentLike, nowDay: number): boolean {
  if (inc.escalate) return false;                 // escalated cases don't quietly lapse
  if (!debtCleared(inc)) return false;            // can't become spent with money owed
  return nowDay >= spentDay(inc);
}
export function daysUntilSpent(inc: IncidentLike, nowDay: number): number {
  return Math.max(0, spentDay(inc) - nowDay);
}

// ---- Employment eligibility (hook for future careers) --------------------
export type RoleSensitivity = 'money' | 'security' | 'public' | 'general';
export interface EligibilityResult { eligible: boolean; reason: string; }
// activeIncidents: only the player's ACTIVE (non-spent) incidents.
export function roleEligibility(activeIncidents: Array<{ type: string; category?: string; level: number }>, sensitivity: RoleSensitivity): EligibilityResult {
  const active = activeIncidents || [];
  const anySerious = active.some(i => i.level >= 4);
  if (sensitivity === 'money'){
    const fin = active.find(i => (i.category || OFFENCES[i.type]?.category) === 'financial' && i.level >= 4);
    if (fin) return { eligible: false, reason: 'This role requires a clear active financial record. Your current financial conviction prevents application until it becomes spent or rehabilitation is completed.' };
  }
  if (sensitivity === 'security'){
    const theft = active.find(i => (i.type === 'theft' || i.type === 'burglary') && i.level >= 3);
    if (theft) return { eligible: false, reason: 'This security-sensitive role needs a clear theft record. Your active theft conviction prevents application until it is spent or rehabilitated.' };
  }
  if (sensitivity === 'public'){
    if (anySerious && active.length >= 2) return { eligible: false, reason: 'This public-trust role is unavailable while you have multiple serious active offences. Complete rehabilitation to become eligible again.' };
  }
  return { eligible: true, reason: 'Your record does not affect this role.' };
}

// ---- Criminal career ladder ----------------------------------------------
// A cumulative, lifetime measure of how committed a criminal the player is — it
// rewards SUSTAINED, serious wrongdoing rather than a single slip. Reaching the
// top rank ("Kingpin") is what marks someone out as underworld, and it gates the
// "Con" strip-club music. Warnings (level<=1) never count; graver offences count
// far more, so the top is only reachable through consistent unethical behaviour.
export interface CriminalRank { id: string; name: string; min: number; }
// Ordered low → high. `min` is the notoriety needed to hold that rank.
export const CRIMINAL_RANKS: CriminalRank[] = [
  { id: 'clean',   name: 'Clean record',    min: 0 },
  { id: 'petty',   name: 'Petty offender',  min: 1 },
  { id: 'repeat',  name: 'Repeat offender', min: 8 },
  { id: 'career',  name: 'Career criminal', min: 20 },
  { id: 'fixer',   name: 'Underworld fixer', min: 40 },
  { id: 'kingpin', name: 'Kingpin',         min: 70 },
];
// Per-incident notoriety weight by severity level [warning..major]. Warnings = 0.
const NOTORIETY_WEIGHT = [0, 0, 1, 3, 6, 10];
export interface RankIncident { level: number; }
// Lifetime notoriety across ALL recorded incidents (spent or not — a rap sheet is
// cumulative history, and a reformed kingpin was still a kingpin).
export function criminalNotoriety(incidents: Array<RankIncident> = []): number {
  return (incidents || []).reduce((s, i) => s + (NOTORIETY_WEIGHT[clampLevel(i?.level || 0)] || 0), 0);
}
export function criminalRankIndex(incidents: Array<RankIncident> = []): number {
  const n = criminalNotoriety(incidents);
  let idx = 0;
  for (let i = 0; i < CRIMINAL_RANKS.length; i++){ if (n >= CRIMINAL_RANKS[i].min) idx = i; }
  return idx;
}
export function criminalRank(incidents: Array<RankIncident> = []): CriminalRank {
  return CRIMINAL_RANKS[criminalRankIndex(incidents)];
}
export const TOP_CRIMINAL_RANK_INDEX = CRIMINAL_RANKS.length - 1;
// True only at the very top of the ladder — the trigger for the "Con" venue music.
export function atTopOfCriminalPath(incidents: Array<RankIncident> = []): boolean {
  return criminalRankIndex(incidents) === TOP_CRIMINAL_RANK_INDEX;
}
// How far to the next rank (null at the top) — for a progress readout.
export function nextCriminalRank(incidents: Array<RankIncident> = []): CriminalRank | null {
  return CRIMINAL_RANKS[criminalRankIndex(incidents) + 1] || null;
}

// ---- Community service ----------------------------------------------------
export interface CommunityTask { id: string; ic: string; label: string; units: number; }
export const COMMUNITY_TASKS: CommunityTask[] = [
  { id: 'litter',    ic: '🗑️', label: 'Clean up litter on the green',   units: 5 },
  { id: 'spill',     ic: '🧽', label: 'Mop spills at the market hall',   units: 5 },
  { id: 'repair',    ic: '🔧', label: 'Repair the public benches',        units: 6 },
  { id: 'warehouse', ic: '📦', label: 'Help sort the community warehouse', units: 6 },
  { id: 'repaint',   ic: '🖌️', label: 'Repaint the scuffed railings',     units: 6 },
  { id: 'park',      ic: '🌳', label: 'Tidy the valley park',             units: 7 },
];
export function communityTaskById(id: string): CommunityTask | null { return COMMUNITY_TASKS.find(t => t.id === id) || null; }
// Rehabilitation-days credit for finishing a service order (capped; never erases
// serious misconduct outright — it only shortens the spent period).
export function communityRehabDays(units: number): number {
  return Math.min(4, Math.round((units || 0) / 2));
}
