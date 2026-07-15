// ============================================================================
// THE ONE AUTHORITATIVE WALLET / TRANSACTION SERVICE
// ----------------------------------------------------------------------------
// Every coin change in BuyrWorld flows through applyTxn(). It keeps ONE balance,
// records a structured ledger entry per change (idempotency key, source type,
// source id, amount, timestamp, resulting balance) and refuses to apply the same
// keyed transaction twice — so a reward can never be double-granted after a
// reload, a double-click, or a repeated event dispatch. Pure & testable: no
// game-state, DOM or timer access. The main.ts wrapper owns S.coins + S.ledger
// and the UI subscriptions.
// ============================================================================

export type TxnSource =
  | 'quest' | 'contract' | 'journal' | 'achievement' | 'passive' | 'tutorial'
  | 'purchase' | 'refund' | 'wager' | 'winnings' | 'fee' | 'fine' | 'sale'
  | 'adjust' | 'uncategorized';

export interface Txn {
  key: string;             // unique idempotency key (caller-supplied stable key, or auto-generated per occurrence)
  idempotent: boolean;     // true when the key is a caller-supplied stable key (persisted in `seen`, dedups repeats)
  sourceType: TxnSource;   // what kind of change
  sourceId: string | null; // which quest/contract/item/etc.
  amount: number;          // signed: >0 credit, <0 debit
  ts: number;              // Date.now() when applied
  balance: number;         // resulting balance AFTER this transaction
}

export interface Ledger {
  balance: number;                 // the single source of truth for coins
  seen: Record<string, true>;      // idempotency keys already applied
  entries: Txn[];                  // bounded transaction history (newest last)
}

// Keep memory + save size bounded; history is for debugging, not accounting.
export const LEDGER_MAX = 250;

// Monotonic counter so auto-generated keys are unique even within the same ms.
let _seq = 0;
function autoKey(ts: number): string { return `tx_${ts.toString(36)}_${(_seq++).toString(36)}`; }

export function createLedger(balance = 0): Ledger {
  return { balance: Math.max(0, Math.round(balance) || 0), seen: {}, entries: [] };
}

/** Normalise any persisted/partial ledger shape into a valid Ledger. */
export function normalizeLedger(raw: any, fallbackBalance = 0): Ledger {
  const l = createLedger(typeof raw?.balance === 'number' ? raw.balance : fallbackBalance);
  if (raw && typeof raw === 'object') {
    if (raw.seen && typeof raw.seen === 'object') l.seen = { ...raw.seen };
    if (Array.isArray(raw.entries)) l.entries = raw.entries.slice(-LEDGER_MAX);
  }
  return l;
}

export interface TxnResult {
  applied: boolean;        // false if it was a duplicate (idempotency) or a no-op
  duplicate: boolean;      // true only when refused because the key was already seen
  balance: number;         // the (possibly unchanged) resulting balance
  entry: Txn | null;       // the recorded entry, when applied
}

export interface TxnInput {
  amount: number;                  // signed
  sourceType?: TxnSource;
  sourceId?: string | null;
  key?: string | null;             // stable key ⇒ idempotent; omit/null ⇒ always applies
  ts?: number;                     // injectable clock for tests
  allowNegativeBalance?: boolean;  // debits normally clamp at 0 (never go negative)
}

/**
 * Apply a transaction to the ledger IN PLACE and return the outcome.
 * - A keyed transaction whose key was already seen is refused (idempotent).
 * - A zero amount is a no-op (records nothing) but is not a "duplicate".
 * - Debits clamp so the balance never drops below 0 (unless allowNegativeBalance).
 */
export function applyTxn(ledger: Ledger, input: TxnInput): TxnResult {
  const { key = null, sourceType = 'uncategorized', sourceId = null, allowNegativeBalance = false } = input;
  const ts = input.ts ?? Date.now();
  let amount = Math.round(input.amount);

  // A caller-supplied stable key makes the transaction idempotent (dedup on repeat).
  const idempotent = !!key;
  if (idempotent && ledger.seen[key!]) {
    return { applied: false, duplicate: true, balance: ledger.balance, entry: null };
  }
  if (!amount) {
    // Still burn a stable key for a zero-value keyed event so it can't "arm" a later grant.
    if (idempotent) ledger.seen[key!] = true;
    return { applied: false, duplicate: false, balance: ledger.balance, entry: null };
  }

  let balance = ledger.balance + amount;
  if (!allowNegativeBalance && balance < 0) { balance = 0; amount = balance - ledger.balance; }

  // Every entry carries a unique key: a caller's stable key, else an auto-generated
  // per-occurrence id — so the record always has one, but only stable keys are
  // persisted to `seen` (one-off spends never bloat the idempotency set).
  const entry: Txn = { key: key ?? autoKey(ts), idempotent, sourceType, sourceId, amount, ts, balance };
  ledger.balance = balance;
  if (idempotent) ledger.seen[key!] = true;
  ledger.entries.push(entry);
  if (ledger.entries.length > LEDGER_MAX) ledger.entries.splice(0, ledger.entries.length - LEDGER_MAX);

  return { applied: true, duplicate: false, balance, entry };
}

/** Has a keyed transaction already been applied? */
export function hasApplied(ledger: Ledger, key: string): boolean {
  return !!(ledger && ledger.seen && ledger.seen[key]);
}

/** The most recent `n` transactions (newest last) — for the developer history view. */
export function ledgerTail(ledger: Ledger, n = 25): Txn[] {
  if (!ledger || !Array.isArray(ledger.entries)) return [];
  return ledger.entries.slice(-n);
}

/** Sum of applied amounts for a given source type — handy for audits/tests. */
export function ledgerTotalBySource(ledger: Ledger, sourceType: TxnSource): number {
  if (!ledger || !Array.isArray(ledger.entries)) return 0;
  return ledger.entries.filter(e => e.sourceType === sourceType).reduce((s, e) => s + e.amount, 0);
}
