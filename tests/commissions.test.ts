import { describe, it, expect } from 'vitest';
import {
  COMMISSION_DEFS, commissionById, commissionCoins, commissionXp, commissionRep,
  repTierUnlocked, repTitle, availableCommissions, rollCommissionBoard,
  commissionProgress, commissionDone,
} from '../src/data/commissions.ts';

describe('Commissions — definitions', () => {
  it('are well-formed with unique ids and tiers 1-4', () => {
    expect(new Set(COMMISSION_DEFS.map(c => c.id)).size).toBe(COMMISSION_DEFS.length);
    for (const c of COMMISSION_DEFS) {
      expect(c.item && c.n).toBeTruthy();
      expect(c.qty).toBeGreaterThan(0);
      expect(c.tier).toBeGreaterThanOrEqual(1);
      expect(c.tier).toBeLessThanOrEqual(4);
    }
    expect(commissionById('jam').item).toBe('berry_jam');
    expect(commissionById('nope')).toBeUndefined();
  });
  it('rewards scale with qty, tier and item value', () => {
    const t1 = COMMISSION_DEFS.find(c => c.tier === 1);
    const t4 = COMMISSION_DEFS.find(c => c.tier === 4);
    expect(commissionCoins(t1, 20)).toBeGreaterThan(0);
    expect(commissionCoins({ qty: 3, tier: 4 }, 100)).toBeGreaterThan(commissionCoins({ qty: 3, tier: 1 }, 100));
    expect(commissionXp(t4)).toBeGreaterThan(commissionXp(t1));
    expect(commissionRep(t4)).toBe(4);
  });
});

describe('Commissions — reputation', () => {
  it('tiers and titles unlock with reputation', () => {
    expect(repTierUnlocked(0)).toBe(1);
    expect(repTierUnlocked(5)).toBe(2);
    expect(repTierUnlocked(15)).toBe(3);
    expect(repTierUnlocked(30)).toBe(4);
    expect(repTitle(0)).toBe('Apprentice');
    expect(repTitle(30)).toBe('Master Artisan');
    expect(availableCommissions(0).every(c => c.tier === 1)).toBe(true);
    expect(availableCommissions(30).length).toBe(COMMISSION_DEFS.length);
  });
});

describe('Commissions — board & progress', () => {
  it('rolls a deterministic board of distinct commissions for the rep', () => {
    const a = rollCommissionBoard(1234, 0, 3);
    const b = rollCommissionBoard(1234, 0, 3);
    expect(a).toEqual(b);                          // deterministic
    expect(new Set(a).size).toBe(a.length);        // distinct
    for (const id of a) expect(commissionById(id).tier).toBe(1);   // rep 0 → tier 1 only
    expect(rollCommissionBoard(9, 30, 3).length).toBe(3);
  });
  it('progress clamps and completion triggers at the target', () => {
    expect(commissionProgress(3, 5)).toBe(3);
    expect(commissionProgress(3, 1)).toBe(1);
    expect(commissionDone(3, 2)).toBe(false);
    expect(commissionDone(3, 3)).toBe(true);
  });
});
