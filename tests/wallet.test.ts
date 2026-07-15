import { describe, it, expect } from 'vitest';
import {
  createLedger, normalizeLedger, applyTxn, hasApplied,
  ledgerTail, ledgerTotalBySource, LEDGER_MAX,
} from '../src/data/wallet.ts';

describe('Wallet — single balance & structured entries', () => {
  it('credits and debits move ONE balance and record the resulting balance', () => {
    const l = createLedger(100);
    const a = applyTxn(l, { amount: 50, sourceType: 'quest', sourceId: 'q1', key: 'quest:q1', ts: 1 });
    expect(a.applied).toBe(true);
    expect(a.balance).toBe(150);
    expect(l.balance).toBe(150);
    const b = applyTxn(l, { amount: -30, sourceType: 'purchase', sourceId: 'seed', ts: 2 });
    expect(b.balance).toBe(120);
    expect(l.balance).toBe(120);
  });

  it('every entry carries key, sourceType, sourceId, amount, ts and resulting balance', () => {
    const l = createLedger(0);
    const r = applyTxn(l, { amount: 40, sourceType: 'achievement', sourceId: 'first_swing', key: 'ach:first_swing', ts: 123 });
    expect(r.entry).toEqual({ key: 'ach:first_swing', idempotent: true, sourceType: 'achievement', sourceId: 'first_swing', amount: 40, ts: 123, balance: 40 });
  });

  it('a keyless one-off still gets a unique key but is not persisted to the idempotency set', () => {
    const l = createLedger(100);
    const a = applyTxn(l, { amount: -10, sourceType: 'purchase', sourceId: 'seed', ts: 5 });
    const b = applyTxn(l, { amount: -10, sourceType: 'purchase', sourceId: 'seed', ts: 5 });
    expect(a.entry!.key).toBeTruthy();
    expect(b.entry!.key).toBeTruthy();
    expect(a.entry!.key).not.toBe(b.entry!.key);         // unique per occurrence
    expect(a.entry!.idempotent).toBe(false);
    expect(Object.keys(l.seen).length).toBe(0);          // one-offs never bloat `seen`
  });
});

describe('Wallet — idempotency (no double rewards)', () => {
  it('a keyed transaction applies once; repeats are refused as duplicates', () => {
    const l = createLedger(0);
    const first = applyTxn(l, { amount: 150, sourceType: 'contract', sourceId: 'tut', key: 'contract:tutorial', ts: 1 });
    const again = applyTxn(l, { amount: 150, sourceType: 'contract', sourceId: 'tut', key: 'contract:tutorial', ts: 2 });
    const third = applyTxn(l, { amount: 150, sourceType: 'contract', sourceId: 'tut', key: 'contract:tutorial', ts: 3 });
    expect(first.applied).toBe(true);
    expect(again.applied).toBe(false);
    expect(again.duplicate).toBe(true);
    expect(third.duplicate).toBe(true);
    expect(l.balance).toBe(150);                 // granted exactly once
    expect(l.entries.length).toBe(1);
    expect(hasApplied(l, 'contract:tutorial')).toBe(true);
  });

  it('unkeyed one-offs always apply (a purchase can repeat)', () => {
    const l = createLedger(1000);
    applyTxn(l, { amount: -10, sourceType: 'purchase' });
    applyTxn(l, { amount: -10, sourceType: 'purchase' });
    expect(l.balance).toBe(980);
    expect(l.entries.length).toBe(2);
  });

  it('survives a reload: seen keys restored from a persisted ledger block duplicates', () => {
    const l = createLedger(500);
    applyTxn(l, { amount: 100, sourceType: 'tutorial', key: 'tut:bonus', ts: 1 });
    const persisted = JSON.parse(JSON.stringify(l));        // save → reload round-trip
    const restored = normalizeLedger(persisted);
    const dup = applyTxn(restored, { amount: 100, sourceType: 'tutorial', key: 'tut:bonus', ts: 2 });
    expect(dup.applied).toBe(false);
    expect(restored.balance).toBe(600);                     // not 700
  });
});

describe('Wallet — safety & bounds', () => {
  it('debits clamp at zero (balance never goes negative)', () => {
    const l = createLedger(20);
    const r = applyTxn(l, { amount: -75, sourceType: 'fee', key: 'fee:x' });
    expect(r.balance).toBe(0);
    expect(r.entry!.amount).toBe(-20);        // only what was affordable is recorded
  });

  it('a zero-amount keyed event records nothing but burns its key', () => {
    const l = createLedger(10);
    const r = applyTxn(l, { amount: 0, sourceType: 'quest', key: 'quest:noop' });
    expect(r.applied).toBe(false);
    expect(r.duplicate).toBe(false);
    expect(l.entries.length).toBe(0);
    expect(hasApplied(l, 'quest:noop')).toBe(true);
  });

  it('history is bounded to LEDGER_MAX', () => {
    const l = createLedger(0);
    for (let i = 0; i < LEDGER_MAX + 60; i++) applyTxn(l, { amount: 1, sourceType: 'passive' });
    expect(l.entries.length).toBe(LEDGER_MAX);
    expect(l.balance).toBe(LEDGER_MAX + 60);   // balance is exact even though history is trimmed
  });

  it('ledgerTail + ledgerTotalBySource support the debug view', () => {
    const l = createLedger(0);
    applyTxn(l, { amount: 40, sourceType: 'quest', ts: 1 });
    applyTxn(l, { amount: 60, sourceType: 'quest', ts: 2 });
    applyTxn(l, { amount: -25, sourceType: 'purchase', ts: 3 });
    expect(ledgerTail(l, 2).map(e => e.ts)).toEqual([2, 3]);
    expect(ledgerTotalBySource(l, 'quest')).toBe(100);
    expect(ledgerTotalBySource(l, 'purchase')).toBe(-25);
  });
});

describe('Wallet — normalizeLedger migration', () => {
  it('builds a valid ledger from a legacy save that only had a coins number', () => {
    const l = normalizeLedger(undefined, 850);
    expect(l.balance).toBe(850);
    expect(l.seen).toEqual({});
    expect(l.entries).toEqual([]);
  });
  it('trims an over-long persisted history on load', () => {
    const entries = Array.from({ length: LEDGER_MAX + 40 }, (_, i) => ({ key: null, sourceType: 'passive', sourceId: null, amount: 1, ts: i, balance: i + 1 }));
    const l = normalizeLedger({ balance: 999, seen: { 'x': true }, entries }, 0);
    expect(l.balance).toBe(999);
    expect(l.entries.length).toBe(LEDGER_MAX);
    expect(l.seen.x).toBe(true);
  });
});
