// Typed effect registry. Effects are DESCRIPTORS (serialisable, no functions). main.ts
// holds adapters that apply each kind idempotently by its stable `id`. This module is
// the pure catalogue + helpers the validator and adapters share.
import type { Effect } from './types.ts';

export const SUPPORTED_EFFECT_KINDS = [
  'relationship', 'memory', 'forget', 'flag', 'log', 'followup', 'radio_unlock',
  'grant_coins', 'grant_item', 'take_item', 'reputation', 'contract_offer',
  'supplier_intel', 'crime_suspicion', 'rumour',
] as const;
export type EffectKind = typeof SUPPORTED_EFFECT_KINDS[number];

export function isSupportedEffect(e: Effect): boolean { return (SUPPORTED_EFFECT_KINDS as readonly string[]).includes(e.kind); }

// The relationship deltas an effect list implies (for the after-commit summary).
export function relationshipSummary(effects: Effect[] | undefined): Array<{ dim: string; delta: number }> {
  return (effects || []).filter(e => e.kind === 'relationship').map(e => ({ dim: (e as any).dim, delta: (e as any).delta }));
}

// Every effect must carry a stable, unique id (idempotency). Returns the offending ids.
export function duplicateEffectIds(effects: Effect[]): string[] {
  const seen = new Set<string>(), dups = new Set<string>();
  for (const e of effects) { if (seen.has(e.id)) dups.add(e.id); seen.add(e.id); }
  return [...dups];
}
