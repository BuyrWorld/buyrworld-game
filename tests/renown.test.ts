import { describe, it, expect } from 'vitest';
import {
  RENOWN_UPGRADES, renownForAch, upgradeById, isBought, renownSpent, renownAvailable,
  canBuy, locked, renownXpMult, renownSellMult, renownSpeedMult, renownContractBonus, renownOfflineHours,
} from '../src/data/renown.ts';

describe('Renown — data', () => {
  it('upgrades are well-formed with unique ids', () => {
    expect(new Set(RENOWN_UPGRADES.map(u => u.id)).size).toBe(RENOWN_UPGRADES.length);
    for (const u of RENOWN_UPGRADES) {
      expect(u.ic && u.name && u.desc).toBeTruthy();
      expect(u.cost).toBeGreaterThan(0);
      expect(typeof u.effect.val).toBe('number');
    }
  });
  it('every prerequisite points at a real upgrade', () => {
    for (const u of RENOWN_UPGRADES) if (u.req) expect(upgradeById(u.req)).toBeTruthy();
  });
  it('renownForAch gives a bonus point to big achievements', () => {
    expect(renownForAch(500)).toBe(1);
    expect(renownForAch(1000)).toBe(2);
    expect(renownForAch(5000)).toBe(2);
  });
});

describe('Renown — economy', () => {
  it('spent and available track the bought set', () => {
    const b = { diligent: true };            // cost 3
    expect(isBought(b, 'diligent')).toBe(true);
    expect(renownSpent(b)).toBe(3);
    expect(renownAvailable(10, b)).toBe(7);
    expect(renownAvailable(2, b)).toBe(0);   // clamped at 0
  });
  it('canBuy respects affordability, ownership and prerequisites', () => {
    expect(canBuy(3, {}, 'diligent')).toBe(true);
    expect(canBuy(2, {}, 'diligent')).toBe(false);           // too poor
    expect(canBuy(99, { diligent: true }, 'diligent')).toBe(false); // already owned
    expect(canBuy(99, {}, 'diligent2')).toBe(false);         // prereq missing
    expect(locked({}, 'diligent2')).toBe(true);
    expect(canBuy(99, { diligent: true }, 'diligent2')).toBe(true);
    expect(locked({ diligent: true }, 'diligent2')).toBe(false);
  });
});

describe('Renown — effects', () => {
  it('multipliers stack from owned upgrades', () => {
    expect(renownXpMult({})).toBe(1);
    expect(renownXpMult({ diligent: true })).toBeCloseTo(1.05);
    expect(renownXpMult({ diligent: true, diligent2: true })).toBeCloseTo(1.13);
    expect(renownSellMult({ shrewd: true, shrewd2: true })).toBeCloseTo(1.13);
    expect(renownSpeedMult({ rested: true })).toBeCloseTo(0.96);
    expect(renownContractBonus({ pockets: true })).toBe(1);
    expect(renownOfflineHours({ nightowl: true })).toBe(4);
  });
});
