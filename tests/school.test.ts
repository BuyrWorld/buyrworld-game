import { describe, it, expect } from 'vitest';
import { SCHOOL_UPGRADES, cumulativeCost, schoolTier, nextUpgrade, isSchoolComplete } from '../src/data/school.ts';

describe('School fund — upgrades', () => {
  it('lists the equipment tiers with rising costs', () => {
    expect(SCHOOL_UPGRADES.length).toBeGreaterThanOrEqual(6);
    for (const u of SCHOOL_UPGRADES) { expect(u.id && u.ic && u.name).toBeTruthy(); expect(u.cost).toBeGreaterThan(0); }
    for (let i = 1; i < SCHOOL_UPGRADES.length; i++) expect(SCHOOL_UPGRADES[i].cost).toBeGreaterThan(SCHOOL_UPGRADES[i - 1].cost);
  });

  it('cumulativeCost adds up the tiers', () => {
    expect(cumulativeCost(0)).toBe(SCHOOL_UPGRADES[0].cost);
    expect(cumulativeCost(1)).toBe(SCHOOL_UPGRADES[0].cost + SCHOOL_UPGRADES[1].cost);
  });
});

describe('School fund — tier from money raised', () => {
  it('buys the next tier once the cumulative total is met', () => {
    expect(schoolTier(0)).toBe(0);
    expect(schoolTier(SCHOOL_UPGRADES[0].cost - 1)).toBe(0);
    expect(schoolTier(SCHOOL_UPGRADES[0].cost)).toBe(1);
    expect(schoolTier(cumulativeCost(1))).toBe(2);
    expect(schoolTier(cumulativeCost(SCHOOL_UPGRADES.length - 1))).toBe(SCHOOL_UPGRADES.length);
  });

  it('nextUpgrade reports progress toward the following tier, null when done', () => {
    const n0 = nextUpgrade(0)!;
    expect(n0.upgrade.id).toBe(SCHOOL_UPGRADES[0].id);
    expect(n0.have).toBe(0);
    expect(n0.need).toBe(SCHOOL_UPGRADES[0].cost);
    const mid = cumulativeCost(0) + 20;             // 20 into the 2nd tier
    const n1 = nextUpgrade(mid)!;
    expect(n1.upgrade.id).toBe(SCHOOL_UPGRADES[1].id);
    expect(n1.have).toBe(20);
    expect(nextUpgrade(cumulativeCost(SCHOOL_UPGRADES.length - 1))).toBeNull();
  });

  it('isSchoolComplete once every tier is funded', () => {
    expect(isSchoolComplete(0)).toBe(false);
    expect(isSchoolComplete(cumulativeCost(SCHOOL_UPGRADES.length - 1))).toBe(true);
  });
});
