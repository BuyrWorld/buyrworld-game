import { describe, it, expect } from 'vitest';
import {
  CLIENTS, CONTRACT_POOL, CONTRACT_TIERS, tierById, pickTier,
  contractDeadlineMs, repDeltaOnDeliver, repDeltaOnExpire,
  repRank, repPayBonus, repSlotBonus, demandPayFactor, rollContract, isExpired,
} from '../src/data/contracts.ts';

// A deterministic rng that replays a fixed sequence (looping) — lets us pin
// every random draw so pay/tier/qty are reproducible.
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

const baseOpts = (over: any = {}) => ({
  pool: CONTRACT_POOL,
  clients: CLIENTS,
  itemValue: (_id: string) => 100,
  mLvl: 10,
  repOf: (_c: string) => 0,
  demand: 1,
  now: 1_000_000,
  ...over,
});

describe('Contracts 2.0 — tiers', () => {
  it('has standard, rush and bulk with sane relationships', () => {
    const ids = CONTRACT_TIERS.map(t => t.id).sort();
    expect(ids).toEqual(['bulk', 'rush', 'standard']);
    const rush = tierById('rush'), std = tierById('standard'), bulk = tierById('bulk');
    expect(rush.payMult).toBeGreaterThan(std.payMult);   // rush pays a premium
    expect(bulk.qtyMult).toBeGreaterThan(std.qtyMult);    // bulk is a bigger order
    expect(bulk.payMult).toBeLessThan(std.payMult);       // …at a thinner unit rate
  });

  it('rush deadlines are tighter than standard, standard tighter than bulk', () => {
    const now = 0;
    expect(contractDeadlineMs('rush', now)).toBeLessThan(contractDeadlineMs('standard', now));
    expect(contractDeadlineMs('standard', now)).toBeLessThan(contractDeadlineMs('bulk', now));
  });

  it('tierById falls back to standard for junk', () => {
    expect(tierById('nonsense').id).toBe('standard');
  });

  it('pickTier is deterministic and covers all tiers across the range', () => {
    expect(pickTier(0).id).toBe('standard');
    expect(pickTier(0.99).id).toBe('bulk');
    expect(pickTier(0.5)).toBe(pickTier(0.5));
  });
});

describe('Contracts 2.0 — reputation', () => {
  it('ranks climb with reputation', () => {
    expect(repRank(0).stars).toBe(0);
    expect(repRank(100).stars).toBeGreaterThan(repRank(10).stars);
    expect(repRank(1000).stars).toBe(4);
  });

  it('pay bonus is monotonic non-decreasing and capped at +25%', () => {
    expect(repPayBonus(0)).toBe(1);
    expect(repPayBonus(50)).toBeGreaterThan(repPayBonus(0));
    expect(repPayBonus(100000)).toBeCloseTo(1.25, 5);
    expect(repPayBonus(-5)).toBe(1);   // never negative
  });

  it('a bonus slot unlocks once total reputation is high enough', () => {
    expect(repSlotBonus(0)).toBe(0);
    expect(repSlotBonus(39)).toBe(0);
    expect(repSlotBonus(40)).toBe(1);
  });

  it('delivering earns reputation, expiring loses it', () => {
    expect(repDeltaOnDeliver('standard')).toBeGreaterThan(0);
    expect(repDeltaOnExpire('standard')).toBeLessThan(0);
    expect(repDeltaOnDeliver('rush')).toBeGreaterThan(repDeltaOnDeliver('standard'));
  });
});

describe('Contracts 2.0 — economy link', () => {
  it('demand factor is clamped to a gentle ±20%', () => {
    expect(demandPayFactor(1)).toBe(1);
    expect(demandPayFactor(5)).toBe(1.2);
    expect(demandPayFactor(0.5)).toBe(0.8);            // clamped floor
    expect(demandPayFactor(0)).toBe(1);                // 0/undefined treated as neutral, not a pay wipe
    expect(demandPayFactor(0.85)).toBeCloseTo(0.85, 5);
  });

  it('a boom pays more than a downturn for the same roll', () => {
    const rng1 = seq(0.5), rng2 = seq(0.5);
    const boom = rollContract(rng1, baseOpts({ demand: 1.15 }));
    const bust = rollContract(rng2, baseOpts({ demand: 0.85 }));
    expect(boom.coins).toBeGreaterThan(bust.coins);
  });

  it('a valued client pays more than a stranger for the same roll', () => {
    const loyal = rollContract(seq(0.5), baseOpts({ repOf: () => 100 }));
    const stranger = rollContract(seq(0.5), baseOpts({ repOf: () => 0 }));
    expect(loyal.coins).toBeGreaterThan(stranger.coins);
  });
});

describe('Contracts 2.0 — rollContract shape & expiry', () => {
  it('produces a fully-formed contract with a future deadline', () => {
    const c = rollContract(seq(0.3, 0.1, 0.7, 0.4), baseOpts());
    expect(CLIENTS).toContain(c.client);
    expect(CONTRACT_POOL.map(p => p.item)).toContain(c.item);
    expect(c.qty).toBeGreaterThanOrEqual(2);
    expect(c.coins).toBeGreaterThan(0);
    expect(c.xp).toBeGreaterThan(0);
    expect(['standard', 'rush', 'bulk']).toContain(c.tier);
    expect(c.deadline).toBeGreaterThan(baseOpts().now);
  });

  it('isExpired only fires once the deadline passes', () => {
    const c = { deadline: 1000 };
    expect(isExpired(c, 999)).toBe(false);
    expect(isExpired(c, 1000)).toBe(true);
    expect(isExpired({}, 9e9)).toBe(false);        // legacy contract with no deadline never auto-expires here
  });
});
