// Multi-dimensional NPC relationships — bounded, consistently updated. Pure.
import type { NpcRelationship, RelationshipDim, RelationshipStage } from './types.ts';

export const REL_DIMS: RelationshipDim[] = ['warmth', 'trust', 'respect', 'suspicion'];
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function defaultRelationship(cfg: { startWarmth?: number; startTrust?: number; startRespect?: number; startSuspicion?: number } = {}): NpcRelationship {
  const r: NpcRelationship = {
    warmth: clamp(cfg.startWarmth ?? 15),
    trust: clamp(cfg.startTrust ?? 15),
    respect: clamp(cfg.startRespect ?? 15),
    suspicion: clamp(cfg.startSuspicion ?? 5),
    lastInteractionDay: -1,
    interactionCount: 0,
    stage: 'stranger',
  };
  r.stage = relationshipStage(r);
  return r;
}

// A single stage that captures the headline of a multi-dimensional bond. Suspicion
// dominates when high (wary/hostile) so "likes but distrusts" reads correctly.
export function relationshipStage(r: NpcRelationship): RelationshipStage {
  if (r.suspicion >= 70 && r.warmth < 40) return 'hostile';
  if (r.suspicion >= 55 && r.suspicion > r.warmth) return 'wary';
  const bond = (r.warmth + r.trust) / 2;
  if (bond >= 80 && r.trust >= 70) return 'confidant';
  if (bond >= 60) return 'friend';
  if (bond >= 38) return 'familiar';
  if (bond >= 20 || r.interactionCount > 0) return 'acquaintance';
  return 'stranger';
}

// Apply a bounded delta to one dimension, returning a NEW relationship + the clamped
// actual change (so the UI can show the true movement, not the requested one).
export function applyDelta(rel: NpcRelationship, dim: RelationshipDim, delta: number): { rel: NpcRelationship; actual: number } {
  const before = rel[dim];
  const next: NpcRelationship = { ...rel, [dim]: clamp(before + delta) } as NpcRelationship;
  next.stage = relationshipStage(next);
  return { rel: next, actual: next[dim] - before };
}

export function applyDeltas(rel: NpcRelationship, deltas: Array<{ dim: RelationshipDim; delta: number }>): { rel: NpcRelationship; actual: Partial<Record<RelationshipDim, number>> } {
  let cur = rel; const actual: Partial<Record<RelationshipDim, number>> = {};
  for (const d of deltas) { const r = applyDelta(cur, d.dim, d.delta); cur = r.rel; actual[d.dim] = (actual[d.dim] || 0) + r.actual; }
  return { rel: cur, actual };
}

// Record an interaction on a given day (dedupes multiple beats in one day for count).
export function touchInteraction(rel: NpcRelationship, day: number): NpcRelationship {
  const next = { ...rel };
  if (rel.lastInteractionDay !== day) next.interactionCount = rel.interactionCount + 1;
  next.lastInteractionDay = day;
  next.stage = relationshipStage(next);
  return next;
}

// A short, human mood label from the relationship (for the portrait header).
export function moodLabel(rel: NpcRelationship): string {
  if (rel.suspicion >= 70) return 'Wary';
  if (rel.suspicion >= 50 && rel.suspicion > rel.warmth) return 'Guarded';
  if (rel.warmth >= 75) return 'Warm';
  if (rel.respect >= 70 && rel.warmth < 50) return 'Respectful';
  if (rel.warmth >= 45) return 'Friendly';
  if (rel.warmth < 20 && rel.interactionCount === 0) return 'Reserved';
  return 'Neutral';
}
