// Justice System V3 — Court hearings, legal representation and proportionate
// sentencing. Pure, deterministic (narrow seeded wobble only) and testable: no
// game imports. main.ts assembles CourtCase records and drives the phased hearing
// UI; this module decides eligibility, evidence strength, verdicts and sentences.
// Fictional, game-focused justice — never real-world legal advice.

// ---- Case eligibility ----------------------------------------------------
export interface IncidentSummary { id: number; type: string; category?: string; level: number; value?: number; escalate?: boolean; confiscated?: boolean; witness?: boolean; returned?: boolean; compensated?: boolean; rehab?: string[]; }

// Why (if at all) these active incidents warrant a court case. Minor one-off
// matters never reach court.
export function caseTrigger(incidents: IncidentSummary[], activeStrikePoints: number): string | null {
  const inc = incidents || [];
  if (inc.some(i => i.escalate)) return 'escalation';
  if (inc.some(i => i.level >= 5)) return 'major';                 // a single major offence
  if ((activeStrikePoints || 0) >= 3) return 'strikes';           // three active strike points
  return null;
}
export function triggerLabel(trigger: string): string {
  return trigger === 'major' ? 'a serious offence requiring a hearing'
    : trigger === 'strikes' ? 'reaching three active strike points'
    : 'an escalated case';
}

// ---- Evidence ------------------------------------------------------------
export interface Evidence {
  type: string;
  desc: string;
  reliability: number;   // 0..1 how trustworthy
  relevance: number;     // 0..1 how relevant to the charge
  supports: boolean;     // true = supports the allegation, false = weakens/mitigates
  incidentId: number;
  challengeable: boolean;
  reviewed?: boolean;
}
// Build evidence from the recorded facts of the linked incidents (no raw logs).
export function buildEvidence(incidents: IncidentSummary[]): Evidence[] {
  const ev: Evidence[] = [];
  for (const i of incidents || []) {
    if (i.confiscated) ev.push({ type: 'recovered_item', desc: 'Stolen item recovered from your inventory.', reliability: 0.95, relevance: 0.9, supports: true, incidentId: i.id, challengeable: false });
    if (i.witness) ev.push({ type: 'witness', desc: 'A resident identified you at the scene.', reliability: 0.7, relevance: 0.8, supports: true, incidentId: i.id, challengeable: true });
    if (i.type === 'trespassing' || i.type === 'burglary') ev.push({ type: 'access_record', desc: 'You were recorded entering a private home.', reliability: 0.85, relevance: 0.7, supports: true, incidentId: i.id, challengeable: false });
    if (i.type === 'financial') ev.push({ type: 'transaction', desc: 'Irregular transaction and invoice records.', reliability: 0.8, relevance: 0.9, supports: true, incidentId: i.id, challengeable: true });
    if (i.returned || (i.rehab || []).includes('returned')) ev.push({ type: 'returned_goods', desc: 'You returned the property before the hearing.', reliability: 0.9, relevance: 0.6, supports: false, incidentId: i.id, challengeable: false });
    if (i.compensated || (i.rehab || []).includes('compensation')) ev.push({ type: 'compensation', desc: 'Compensation was paid to the affected party.', reliability: 0.9, relevance: 0.5, supports: false, incidentId: i.id, challengeable: false });
  }
  return ev;
}
export const EVIDENCE_BANDS = ['Very weak', 'Weak', 'Moderate', 'Strong', 'Overwhelming'];
// Net supporting strength 0..1, plus a band + plain-language reasons.
export function evidenceStrength(evidence: Evidence[], opts: { challenged?: string[] } = {}): { score: number; band: string; reasons: string[] } {
  const challenged = new Set(opts.challenged || []);
  let support = 0, weaken = 0; const reasons: string[] = [];
  for (const e of evidence || []) {
    const w = e.reliability * e.relevance * (challenged.has(e.type) ? 0.45 : 1);
    if (e.supports){ support += w; reasons.push(`• ${e.desc}${challenged.has(e.type) ? ' (challenged)' : ''}`); }
    else { weaken += w; reasons.push(`• ${e.desc} (in your favour)`); }
  }
  const raw = support - weaken * 0.6;
  const score = Math.max(0, Math.min(1, raw / 2.2));
  const band = EVIDENCE_BANDS[Math.max(0, Math.min(4, Math.floor(score * 4.999)))];
  return { score, band, reasons };
}

// ---- Plea ----------------------------------------------------------------
export const PLEAS = ['admit', 'contest', 'partial'] as const;
export type Plea = typeof PLEAS[number];

// ---- Representation ------------------------------------------------------
export interface RepDef { id: string; name: string; cost: number; baseCompetence: number; blurb: string; }
export const REPRESENTATION: Record<string, RepDef> = {
  self:      { id: 'self',      name: 'Represent yourself',     cost: 0,   baseCompetence: 0,    blurb: 'No cost — effectiveness depends on your Legal Knowledge and preparation.' },
  duty:      { id: 'duty',      name: 'Duty solicitor',         cost: 0,   baseCompetence: 0.45, blurb: 'Free, competent basics — guards against the worst procedural mistakes.' },
  solicitor: { id: 'solicitor', name: 'High-street solicitor',  cost: 150, baseCompetence: 0.65, blurb: 'Moderate cost; better preparation and mitigation.' },
  barrister: { id: 'barrister', name: 'Senior advocate',        cost: 600, baseCompetence: 0.85, blurb: 'High cost; strong analysis of weak evidence and persuasive mitigation.' },
};
export function repById(id: string): RepDef | null { return REPRESENTATION[id] || null; }
// Effective competence 0..1. Self-representation scales with Legal Knowledge but is
// capped below a barrister; hired reps get a small preparation bonus.
export function repCompetence(repId: string, legalKnowledge = 0, prep = 0): number {
  const base = repId === 'self'
    ? Math.min(0.78, 0.12 + (legalKnowledge || 0) * 0.055)
    : (REPRESENTATION[repId]?.baseCompetence || 0.45);
  return Math.max(0, Math.min(0.95, base + prep * 0.12));
}
// Duty (and better) representation sets a floor so lack of money never forces the
// very worst outcome.
export function outcomeFloorRaised(repId: string): boolean { return repId !== 'self'; }

// ---- Preparation ---------------------------------------------------------
export interface PrepAction { id: string; label: string; }
export const PREP_ACTIONS: PrepAction[] = [
  { id: 'review_evidence', label: 'Review the evidence bundle' },
  { id: 'read_charges',    label: 'Read the charges carefully' },
  { id: 'statement',       label: 'Prepare a personal statement' },
  { id: 'legal_reading',   label: 'Read a relevant legal book' },
];
export function prepCompleteness(done: string[]): { pct: number; remaining: string[] } {
  const set = new Set(done || []);
  const remaining = PREP_ACTIONS.filter(a => !set.has(a.id)).map(a => a.label);
  return { pct: Math.round((PREP_ACTIONS.length - remaining.length) / PREP_ACTIONS.length * 100), remaining };
}
export function prepFactor(done: string[]): number { return (done || []).filter(d => PREP_ACTIONS.some(a => a.id === d)).length / PREP_ACTIONS.length; }

// ---- Verdict -------------------------------------------------------------
export type Finding = 'proven' | 'lesser' | 'not_proven' | 'dismissed';
export interface Verdict { finding: Finding; reasons: string[]; }
// Deterministic + a narrow seeded wobble that can never override overwhelming
// evidence. `elementsMet` = whether the offence's legal elements are actually met.
export function computeVerdict(ctx: { strength: number; plea: Plea; competence: number; prep: number; contradiction?: boolean; elementsMet?: boolean; seed?: number }): Verdict {
  const reasons: string[] = [];
  const elementsMet = ctx.elementsMet !== false;
  if (!elementsMet){ return { finding: 'dismissed', reasons: ['The legal elements of the offence were not made out.'] }; }
  if (ctx.plea === 'admit'){ return { finding: 'proven', reasons: ['You admitted the offence.'] }; }
  if (ctx.plea === 'partial'){ return { finding: 'lesser', reasons: ['You admitted part of the allegation; a lesser offence is found proven.'] }; }
  // contest: mount a defence against the evidence
  const defence = ctx.competence * 0.5 + ctx.prep * 0.25 + (ctx.contradiction ? 0.3 : 0);
  const wobble = seededWobble(ctx.seed ?? 0) * 0.06;   // ±0.06, testable, narrow
  const margin = ctx.strength - defence + wobble;
  reasons.push(`Evidence strength weighed against your defence.`);
  if (ctx.strength >= 0.85){ reasons.push('The evidence was overwhelming.'); return { finding: 'proven', reasons }; }
  if (margin < 0.05){ reasons.push('The evidence did not meet the required standard.'); return { finding: ctx.strength < 0.25 ? 'dismissed' : 'not_proven', reasons }; }
  if (margin < 0.28){ reasons.push('Only a lesser offence was made out.'); return { finding: 'lesser', reasons }; }
  reasons.push('The allegation was proven on the evidence.');
  return { finding: 'proven', reasons };
}
// Deterministic pseudo-random in [-1,1] from an integer seed.
export function seededWobble(seed: number): number {
  let s = ((seed | 0) * 1664525 + 1013904223) >>> 0;
  return (s / 4294967296) * 2 - 1;
}

// ---- Sentencing ----------------------------------------------------------
export interface SentenceFactorLine { text: string; delta: number; }
export interface Sentence {
  outcome: string;            // 'no_action' | 'warning' | 'fine' | 'community' | 'suspended' | 'custody'
  points: number;
  baseline: number;
  aggravating: SentenceFactorLine[];
  mitigating: SentenceFactorLine[];
  fine: number;
  compensation: number;
  community: number;          // service units
  suspendedDays: number;
  custodyDays: number;
  explanation: string;
}
export const OUTCOME_LABELS: Record<string, string> = {
  no_action: 'No further action', warning: 'Formal warning', fine: 'Fine', community: 'Community order',
  suspended: 'Suspended sentence', custody: 'Custodial sentence',
};
// Baseline points from combined severity; explainable aggravating/mitigating
// adjustments (not blunt percentages) → a proportionate outcome.
export function computeSentence(ctx: { finding: Finding; severity: number; offenceType: string; value?: number; aggravating: SentenceFactorLine[]; mitigating: SentenceFactorLine[]; repFloor?: boolean }): Sentence {
  const agg = ctx.aggravating || [], mit = ctx.mitigating || [];
  if (ctx.finding === 'not_proven' || ctx.finding === 'dismissed'){
    return { outcome: 'no_action', points: 0, baseline: 0, aggravating: [], mitigating: [], fine: 0, compensation: 0, community: 0, suspendedDays: 0, custodyDays: 0, explanation: 'No sentence — the case did not result in a finding of guilt.' };
  }
  const sev = ctx.finding === 'lesser' ? Math.max(1, ctx.severity - 1) : ctx.severity;
  let baseline = (sev - 1) * 1.6;                    // level 2→1.6, 5→6.4
  let points = baseline;
  for (const a of agg) points += a.delta;
  for (const m of mit) points += m.delta;            // mitigating deltas are negative
  let floor = ctx.repFloor ? 0 : -0.5;               // a duty rep spares you the very bottom-of-the-range harshness — modelled as a small guard elsewhere
  points = Math.max(0, points);
  const v = Math.max(0, ctx.value || 0);
  let outcome: string, fine = 0, compensation = 0, community = 0, suspendedDays = 0, custodyDays = 0;
  if (points <= 1){ outcome = 'warning'; }
  else if (points <= 3){ outcome = 'fine'; fine = Math.round(30 + points * 20 + v * 0.15); compensation = Math.round(v * 0.5); }
  else if (points <= 5){ outcome = 'community'; community = Math.round(4 + points); compensation = Math.round(v * 0.75); fine = Math.round(points * 15); }
  else if (points <= 7.5){ outcome = 'suspended'; suspendedDays = Math.round(4 + points); compensation = Math.round(v); fine = Math.round(points * 20); community = 6; }
  else { outcome = 'custody'; custodyDays = Math.round(points - 5); compensation = Math.round(v); fine = Math.round(points * 25); }
  // A represented defendant is spared a needlessly severe top-of-range custody for
  // a borderline case (bounded — never flips a clear custody threshold far down).
  if (ctx.repFloor && outcome === 'custody' && points < 8.2){ outcome = 'suspended'; suspendedDays = Math.round(6 + points); custodyDays = 0; }
  const parts = [`Baseline: ${OUTCOME_LABELS[outcome === 'warning' ? 'warning' : outcome]} (severity ${sev}).`];
  if (mit.length) parts.push('Reduced because: ' + mit.map(m => m.text).join('; ') + '.');
  if (agg.length) parts.push('Increased because: ' + agg.map(a => a.text).join('; ') + '.');
  return { outcome, points: Math.round(points * 10) / 10, baseline: Math.round(baseline * 10) / 10, aggravating: agg, mitigating: mit, fine, compensation, community, suspendedDays, custodyDays, explanation: parts.join(' ') };
}

// Extract aggravating/mitigating factor lines from the case facts + player choices.
export function factorsFor(ctx: { incidents: IncidentSummary[]; plea: Plea; priorActive: number; isHome?: boolean; value?: number; concealed?: boolean; returned?: boolean; compensated?: boolean; rehabilitated?: boolean; accidental?: boolean; abuseOfTrust?: boolean; breachedOrder?: boolean }): { aggravating: SentenceFactorLine[]; mitigating: SentenceFactorLine[] } {
  const aggravating: SentenceFactorLine[] = [], mitigating: SentenceFactorLine[] = [];
  if (ctx.priorActive >= 1) aggravating.push({ text: `${ctx.priorActive} previous active offence${ctx.priorActive > 1 ? 's' : ''}`, delta: 0.8 });
  if (ctx.isHome) aggravating.push({ text: 'the offence involved a private home', delta: 0.7 });
  if ((ctx.value || 0) >= 200) aggravating.push({ text: 'a high value was involved', delta: 0.8 });
  if (ctx.concealed) aggravating.push({ text: 'you tried to conceal it', delta: 0.7 });
  if (ctx.abuseOfTrust) aggravating.push({ text: 'you abused a position of trust', delta: 1.0 });
  if (ctx.breachedOrder) aggravating.push({ text: 'you breached an earlier order', delta: 1.2 });
  if (ctx.plea === 'admit') mitigating.push({ text: 'you admitted the offence early', delta: -0.9 });
  if (ctx.returned) mitigating.push({ text: 'the property was returned', delta: -0.7 });
  if (ctx.compensated) mitigating.push({ text: 'compensation was paid', delta: -0.6 });
  if (ctx.rehabilitated) mitigating.push({ text: 'you completed rehabilitation', delta: -0.6 });
  if (ctx.accidental) mitigating.push({ text: 'the conduct was genuinely accidental', delta: -0.8 });
  return { aggravating, mitigating };
}

// ---- Suspended sentence & custody data -----------------------------------
export interface SuspendedOrder { activeDays: number; conditions: string[]; breach: string; }
export function suspendedOrder(days: number, opts: { community?: number; compensation?: number } = {}): SuspendedOrder {
  const conditions = ['Commit no further offences'];
  if (opts.community) conditions.push(`Complete ${opts.community} community-service tasks`);
  if (opts.compensation) conditions.push(`Pay ${opts.compensation} coins compensation`);
  return { activeDays: days, conditions, breach: 'A breach activates the suspended sentence and may mean custody.' };
}
export interface CustodyData { custodyDays: number; compressedMs: number; eligibility: { education: boolean; work: boolean; rehab: boolean }; }
// Real-world compression: short and safe (never a long real wait). The prison
// milestone will consume this data.
export function custodyData(days: number): CustodyData {
  const d = Math.max(1, days | 0);
  return { custodyDays: d, compressedMs: Math.min(180000, 20000 + d * 15000), eligibility: { education: true, work: true, rehab: true } };
}

export const HEARING_PHASES = ['intro', 'charges', 'plea', 'evidence', 'challenge', 'response', 'mitigation', 'decision', 'sentence', 'result'] as const;
export type HearingPhase = typeof HEARING_PHASES[number];
