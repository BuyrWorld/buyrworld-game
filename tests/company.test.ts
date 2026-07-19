import { describe, it, expect } from 'vitest';
import {
  COMPANIES, companyById, companiesForLevel, dailyPnL, hireCost, accrueCompany, paybackDays,
} from '../src/data/company.ts';
import { DAY_DURATION_MS } from '../src/world/daynight.ts';

describe('M21 company model', () => {
  it('has well-formed, ordered businesses', () => {
    expect(COMPANIES.length).toBeGreaterThanOrEqual(3);
    let lastLvl = -1, lastLic = -1;
    for (const c of COMPANIES) {
      expect(c.id && c.n && c.ic).toBeTruthy();
      expect(c.slots).toBeGreaterThanOrEqual(1);
      expect(c.revPerStaff).toBeGreaterThan(c.wagePerStaff);   // a staff member must be worth their wage
      expect(c.licence).toBeGreaterThan(0);
      expect(c.hireFee).toBeGreaterThan(0);
      expect(c.unlockLvl).toBeGreaterThanOrEqual(lastLvl);     // gated in ascending order
      expect(c.licence).toBeGreaterThan(lastLic);              // pricier as they unlock
      lastLvl = c.unlockLvl; lastLic = c.licence;
    }
  });

  it('an idle (0-staff) company neither earns nor bleeds; a staffed one at least breaks even', () => {
    for (const c of COMPANIES) {
      expect(dailyPnL(c, 0)).toEqual({ revenue: 0, wages: 0, upkeep: 0, net: 0 });
      expect(dailyPnL(c, 1).net).toBeGreaterThanOrEqual(0);    // one staff never runs at a loss
      expect(dailyPnL(c, c.slots).net).toBeGreaterThan(dailyPnL(c, 1).net); // scaling adds profit
    }
  });

  it('dailyPnL clamps staff to [0, slots] and applies upkeep only while operating', () => {
    const c = COMPANIES[0];
    expect(dailyPnL(c, 99).net).toBe(dailyPnL(c, c.slots).net);   // over-slots clamps
    expect(dailyPnL(c, -5)).toEqual(dailyPnL(c, 0));
    const one = dailyPnL(c, 1);
    expect(one.upkeep).toBe(c.upkeep);
    expect(one.net).toBe(one.revenue - one.wages - one.upkeep);
  });

  it('demand multiplier scales revenue (and net) deterministically', () => {
    const c = COMPANIES[1];
    const base = dailyPnL(c, c.slots, 1);
    const hi = dailyPnL(c, c.slots, 1.15);
    expect(hi.revenue).toBeGreaterThan(base.revenue);
    expect(hi.wages).toBe(base.wages);          // wages/upkeep unaffected by demand
    expect(hi.net).toBeGreaterThan(base.net);
  });

  it('accrueCompany books whole coins and carries the sub-coin remainder', () => {
    // net 0 or no time → nothing
    expect(accrueCompany(0, DAY_DURATION_MS)).toEqual({ coins: 0, consumedMs: 0 });
    expect(accrueCompany(100, 0)).toEqual({ coins: 0, consumedMs: 0 });
    // a full day at net 100 → 100 coins, consuming ~a full day
    const full = accrueCompany(100, DAY_DURATION_MS);
    expect(full.coins).toBe(100);
    expect(full.consumedMs).toBe(DAY_DURATION_MS);
    // a tiny slice yields 0 coins and consumes 0 time (so it accumulates, never lost)
    const tiny = accrueCompany(100, 1000);
    expect(tiny.coins).toBe(0);
    expect(tiny.consumedMs).toBe(0);
    // half a day at net 200 → 100 coins, ~half a day consumed
    const half = accrueCompany(200, DAY_DURATION_MS / 2);
    expect(half.coins).toBe(100);
    expect(half.consumedMs).toBe(DAY_DURATION_MS / 2);
  });

  it('lookups + payback behave', () => {
    expect(companyById('corner_shop')!.id).toBe('corner_shop');
    expect(companyById('nope')).toBeNull();
    expect(companiesForLevel(0).length).toBe(0);
    expect(companiesForLevel(999).length).toBe(COMPANIES.length);
    expect(hireCost(COMPANIES[0])).toBe(COMPANIES[0].hireFee);
    for (const c of COMPANIES) expect(paybackDays(c)).toBeGreaterThan(0);   // finite + positive (all profit at full staff)
  });
});
