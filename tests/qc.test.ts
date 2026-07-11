import { describe, it, expect } from 'vitest';
import {
  QC_GRADES, gradeFor, gradeById, QC_TIERS, qcTierDef, nextQCTier,
  baseDefectRate, inspectBatch, reworkCost, scrapRefund,
  updateRating, ratingSellMult, ratingContractMult, ratingLabel,
} from '../src/data/qc.ts';

const constRng = (v: number) => () => v;

describe('QC — grades', () => {
  it('maps defect fraction to the right grade', () => {
    expect(gradeFor(0).id).toBe('A');
    expect(gradeFor(0.03).id).toBe('A');
    expect(gradeFor(0.05).id).toBe('B');
    expect(gradeFor(0.12).id).toBe('C');
    expect(gradeFor(0.5).id).toBe('R');
  });

  it('better grades carry a higher rating delta; reject is negative', () => {
    expect(gradeById('A').ratingDelta).toBeGreaterThan(gradeById('B').ratingDelta);
    expect(gradeById('R').ratingDelta).toBeLessThan(0);
  });
});

describe('QC — calibration tiers & defect rate', () => {
  it('tiers get cheaper defect rates as they get pricier', () => {
    for (let i = 1; i < QC_TIERS.length; i++) {
      expect(QC_TIERS[i].rate).toBeLessThan(QC_TIERS[i - 1].rate);
      expect(QC_TIERS[i].cost).toBeGreaterThan(QC_TIERS[i - 1].cost);
    }
    expect(nextQCTier(QC_TIERS.length - 1)).toBeNull();
    expect(qcTierDef(99)).toBe(QC_TIERS[QC_TIERS.length - 1]);
  });

  it('defect rate falls with Manufacturing level and better tiers, clamped', () => {
    expect(baseDefectRate(0, 0)).toBeGreaterThan(baseDefectRate(50, 0));   // level helps
    expect(baseDefectRate(10, 0)).toBeGreaterThan(baseDefectRate(10, 3));  // calibration helps
    expect(baseDefectRate(999, 3)).toBeGreaterThanOrEqual(0.02);           // floor
    expect(baseDefectRate(0, 0)).toBeLessThanOrEqual(0.30);               // ceiling
  });
});

describe('QC — inspection', () => {
  it('counts defects deterministically under a seeded rng', () => {
    expect(inspectBatch(20, 1, constRng(0)).defects).toBe(20);   // rng 0 < rate 1 → all defective
    expect(inspectBatch(20, 0, constRng(0.5)).defects).toBe(0);  // rate 0 → none
    const clean = inspectBatch(20, 0, constRng(0.9));
    expect(clean.grade).toBe('A');
    expect(clean.defectFrac).toBe(0);
  });

  it('handles an empty batch without dividing by zero', () => {
    const r = inspectBatch(0, 0.2, constRng(0));
    expect(r.inspected).toBe(0);
    expect(r.defectFrac).toBe(0);
  });
});

describe('QC — rework / scrap economics', () => {
  it('rework costs more than scrap refunds (fixing beats binning in value)', () => {
    expect(reworkCost(5, 30)).toBeGreaterThan(scrapRefund(5, 30));
    expect(reworkCost(0, 30)).toBe(0);
  });
});

describe('QC — rating & multipliers', () => {
  it('rating moves by grade and clamps to [0,100]', () => {
    expect(updateRating(50, 'A')).toBe(56);
    expect(updateRating(50, 'R')).toBe(45);
    expect(updateRating(98, 'A')).toBe(100);   // clamp high
    expect(updateRating(2, 'R')).toBe(0);       // clamp low
    expect(updateRating(null as any, 'C')).toBe(50);
  });

  it('sell & contract multipliers are neutral at the default 50 and monotonic', () => {
    expect(ratingSellMult(50)).toBe(1);
    expect(ratingContractMult(50)).toBe(1);
    expect(ratingSellMult(100)).toBeGreaterThan(1);
    expect(ratingSellMult(0)).toBeLessThan(1);
    expect(ratingContractMult(100)).toBeGreaterThan(ratingContractMult(50));
    expect(ratingSellMult(null as any)).toBe(1);   // undefined rating = neutral
  });

  it('labels climb with rating', () => {
    expect(ratingLabel(90)).toBe('Exceptional');
    expect(ratingLabel(10)).toBe('Poor');
  });
});
