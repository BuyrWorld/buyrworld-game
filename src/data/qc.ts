// M18 — Quality Control. The named supply-chain stage, made playable without a
// parallel "quality-tagged" inventory: you inspect a batch of finished goods,
// see its grade + defect count, then decide to rework (pay to salvage) or scrap
// (bin for a small refund). Passing inspections build a Quality Rating that
// gently lifts your sale prices and contract pay. Pure/testable here; the bench
// UI + state live in main.ts.

export interface QCGrade { id: string; label: string; ic: string; maxDefectFrac: number; ratingDelta: number; }

// Ordered best→worst; the first grade whose threshold covers the defect fraction wins.
export const QC_GRADES: QCGrade[] = [
  { id:'A', label:'Grade A', ic:'🟢', maxDefectFrac:0.03, ratingDelta:+6 },
  { id:'B', label:'Grade B', ic:'🔵', maxDefectFrac:0.08, ratingDelta:+3 },
  { id:'C', label:'Grade C', ic:'🟡', maxDefectFrac:0.15, ratingDelta:0 },
  { id:'R', label:'Reject',  ic:'🔴', maxDefectFrac:1.01, ratingDelta:-5 },
];

export function gradeFor(defectFrac: number): QCGrade {
  for (const g of QC_GRADES) if ((defectFrac || 0) <= g.maxDefectFrac) return g;
  return QC_GRADES[QC_GRADES.length - 1];
}
export function gradeById(id: string): QCGrade {
  return QC_GRADES.find(g => g.id === id) || QC_GRADES[QC_GRADES.length - 1];
}

// QC bench calibration — a coin sink that lowers your baseline defect rate.
export interface QCTier { tier: number; n: string; rate: number; cost: number; }
export const QC_TIERS: QCTier[] = [
  { tier:0, n:'Uncalibrated',   rate:0.14, cost:0     },
  { tier:1, n:'Basic Calibration', rate:0.10, cost:1500  },
  { tier:2, n:'Precision Gauges',  rate:0.07, cost:6000  },
  { tier:3, n:'Lab-Grade Bench',   rate:0.04, cost:20000 },
];
export function qcTierDef(t: number): QCTier {
  return QC_TIERS[Math.max(0, Math.min(QC_TIERS.length - 1, t | 0))];
}
export function nextQCTier(t: number): QCTier | null {
  return t + 1 < QC_TIERS.length ? QC_TIERS[t + 1] : null;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Your working defect rate: the bench's base rate, reduced by Manufacturing skill.
export function baseDefectRate(mfgLevel: number, qcTier: number): number {
  const base = qcTierDef(qcTier).rate;
  return clamp(base * (1 - (mfgLevel || 0) * 0.004), 0.02, 0.30);
}

export interface Inspection { inspected: number; defects: number; defectFrac: number; grade: string; }

// Inspect `size` units; each is defective with probability `rate`. Deterministic
// under a seeded rng so it can be unit-tested.
export function inspectBatch(size: number, rate: number, rng: () => number = Math.random): Inspection {
  const n = Math.max(0, size | 0);
  let defects = 0;
  for (let i = 0; i < n; i++) if (rng() < rate) defects++;
  const defectFrac = n > 0 ? defects / n : 0;
  return { inspected: n, defects, defectFrac, grade: gradeFor(defectFrac).id };
}

// Cost to rework (salvage) defective units, and the salvage refund for scrapping.
export function reworkCost(units: number, itemValue: number): number {
  return Math.round(Math.max(0, units) * (itemValue || 1) * 0.4);
}
export function scrapRefund(units: number, itemValue: number): number {
  return Math.round(Math.max(0, units) * (itemValue || 1) * 0.25);
}

// Quality Rating (0..100, default 50) moves by the resolved grade's delta.
export function updateRating(current: number, gradeId: string): number {
  return clamp((current == null ? 50 : current) + gradeById(gradeId).ratingDelta, 0, 100);
}

// Rating → revenue multipliers. Both are NEUTRAL (×1.0) at the default 50, so an
// untouched save's economy is unchanged; a top rating is a modest premium.
export function ratingSellMult(rating: number): number {
  return 1 + ((clamp(rating == null ? 50 : rating, 0, 100) - 50) / 50) * 0.08;
}
export function ratingContractMult(rating: number): number {
  return 1 + ((clamp(rating == null ? 50 : rating, 0, 100) - 50) / 50) * 0.06;
}

export function ratingLabel(rating: number): string {
  if (rating >= 85) return 'Exceptional';
  if (rating >= 65) return 'Strong';
  if (rating >= 45) return 'Fair';
  if (rating >= 25) return 'Shaky';
  return 'Poor';
}
