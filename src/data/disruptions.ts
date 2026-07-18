// ============================================================================
// PRODUCTION BATCH MODES + SEEDED DISRUPTIONS — pure, deterministic, testable.
// ----------------------------------------------------------------------------
// Batch modes let the player trade production speed against defect risk. Each
// introductory flagship order also carries exactly ONE seeded disruption (from a
// fixed set of five) that reshapes the deterministic outcome rolls and surfaces a
// clear alert with sensible responses. Nothing here can make the order unwinnable
// — every disruption is bounded and every response is a real, affordable choice.
// No DOM, no game state; c2cEngine + main.ts wire these in.
// ============================================================================

// ---- Production batch modes -----------------------------------------------
export type BatchMode = 'standard' | 'fast' | 'careful';
export interface BatchDef { id: BatchMode; label: string; icon: string; defectAdd: number; timeMult: number; blurb: string; }
export const BATCH_MODES: BatchDef[] = [
  { id: 'standard', label: 'Standard batch', icon: '⚙️', defectAdd: 0,     timeMult: 1.0, blurb: 'Balanced — the quoted time and quality.' },
  { id: 'fast',     label: 'Fast batch',     icon: '⚡', defectAdd: 0.10,  timeMult: 0.6, blurb: 'Rush the line — quicker, but more defects slip through.' },
  { id: 'careful',  label: 'Careful batch',  icon: '🎯', defectAdd: -0.06, timeMult: 1.5, blurb: 'Slow and precise — fewer defects, but it takes longer.' },
];
export function batchDef(id: BatchMode): BatchDef { return BATCH_MODES.find(b => b.id === id) || BATCH_MODES[0]; }

// ---- Disruptions ----------------------------------------------------------
export type DisruptionId = 'supplier_delay' | 'defective_materials' | 'machine_slowdown' | 'expedite_request' | 'partial_shortage';
export interface DisruptionDef {
  id: DisruptionId; icon: string; title: string; stage: string;   // stage at which it surfaces
  blurb: string; responses: string[];                             // suggested plain-language responses
}
// The alert surfaces at `stage`; the listed responses map to existing engine
// actions (expedite / rework / smaller shipment / extend deadline / accept).
export const DISRUPTIONS: DisruptionDef[] = [
  { id: 'supplier_delay', icon: '🐌', title: 'Supplier delay', stage: 'supplier_in_progress',
    blurb: 'Your supplier hit a snag — the batch is running late.',
    responses: ['Expedite the freight', 'Renegotiate the deadline', 'Wait it out'] },
  { id: 'defective_materials', icon: '🔧', title: 'Defective materials', stage: 'materials_accepted_or_quarantined',
    blurb: 'A big chunk of the batch arrived out of spec.',
    responses: ['Rework the bad bars', 'Scrap and ship short', 'Accept a margin hit'] },
  { id: 'machine_slowdown', icon: '🏭', title: 'Machine slowdown', stage: 'production',
    blurb: 'The line is running slow today — production will take longer.',
    responses: ['Run a Fast batch', 'Renegotiate the deadline', 'Accept the wait'] },
  { id: 'expedite_request', icon: '📣', title: 'Rush request', stage: 'quotation_review',
    blurb: 'The client needs it sooner — a tighter deadline, but a bonus if you hit it.',
    responses: ['Expedite inbound', 'Run a Fast batch', 'Accept a margin hit if late'] },
  { id: 'partial_shortage', icon: '📦', title: 'Partial shortage', stage: 'materials_accepted_or_quarantined',
    blurb: 'The valley is short on bars — your supplier could only part-fill.',
    responses: ['Gather your own stock', 'Produce a smaller shipment', 'Accept a margin hit'] },
];
export function disruptionDef(id: DisruptionId | null | undefined): DisruptionDef | null {
  return id ? (DISRUPTIONS.find(d => d.id === id) || null) : null;
}

function _mul(a: number) { a >>>= 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Deterministically pick the one disruption for an order from its seed. */
export function disruptionFor(seed: number): DisruptionId {
  const r = _mul((seed >>> 0) ^ 0x9e3779b9)();
  return DISRUPTIONS[Math.floor(r * DISRUPTIONS.length) % DISRUPTIONS.length].id;
}

// ---- Deterministic, BOUNDED effect modifiers ------------------------------
// Applied to the order's timeline + outcome rolls. Every value is capped so the
// order stays winnable (the engine's goodwill floor is the final safety net).
export interface DisruptionMods {
  leadAddMin: number;        // extra supplier lead (game-min)
  incomingDefectAdd: number; // added to the incoming-defect fraction (0..1)
  productionTimeMult: number;// multiplies production time
  deadlineMult: number;      // multiplies the customer deadline (<1 = tighter)
  forceShortfallFrac: number;// forces at least this supplier shortfall (0..1)
}
export function disruptionMods(id: DisruptionId | null | undefined): DisruptionMods {
  const base: DisruptionMods = { leadAddMin: 0, incomingDefectAdd: 0, productionTimeMult: 1, deadlineMult: 1, forceShortfallFrac: 0 };
  switch (id) {
    case 'supplier_delay':      return { ...base, leadAddMin: 4 };
    case 'defective_materials': return { ...base, incomingDefectAdd: 0.30 };
    case 'machine_slowdown':    return { ...base, productionTimeMult: 2 };
    case 'expedite_request':    return { ...base, deadlineMult: 0.7 };
    case 'partial_shortage':    return { ...base, forceShortfallFrac: 0.25 };
    default:                    return base;
  }
}

// ---- Quality inspection snapshot ------------------------------------------
export interface Inspection { sampleSize: number; passed: number; defective: number; qualityScore: number; }
/** A concise goods-in / final inspection read: sample a share of the batch, report
 *  passed vs defective and a 0..100 quality score. Deterministic (derives the
 *  sample from the batch + defect count, no extra rolls). */
export function inspect(total: number, defects: number): Inspection {
  const t = Math.max(0, total | 0), d = Math.max(0, Math.min(t, defects | 0));
  const sampleSize = Math.max(1, Math.min(t, Math.ceil(t * 0.25)));   // inspect ~a quarter
  const sampleDefective = t > 0 ? Math.round((d / t) * sampleSize) : 0;
  const qualityScore = t > 0 ? Math.round((1 - d / t) * 100) : 100;
  return { sampleSize, passed: sampleSize - sampleDefective, defective: sampleDefective, qualityScore };
}
