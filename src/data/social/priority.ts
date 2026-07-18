// Conversation selection: pick the single most-appropriate graph for an NPC by the
// nine-tier priority, honouring once-only + cooldowns + graph guards. Pure.
import type { DialogueGraph } from './types.ts';
import { evaluate, type SocialCtx } from './conditions.ts';

export interface GraphState { playedDay?: number; }   // per-graph runtime record

// Is a graph eligible right now? (guard passes, not exhausted, off cooldown)
export function isEligible(g: DialogueGraph, ctx: SocialCtx, state: GraphState | undefined): boolean {
  if (g.npc !== ctx.npc) return false;
  if (g.once && state && state.playedDay !== undefined) return false;
  if (g.cooldownDays && state && state.playedDay !== undefined && ctx.day < state.playedDay + g.cooldownDays) return false;
  return evaluate(g.when, ctx);
}

// The best graph to open now, or null. Lower `priority` number wins; ties break by the
// most recently authored (higher version) then by id for determinism.
export function selectGraph(graphs: DialogueGraph[], ctx: SocialCtx, states: Record<string, GraphState>): DialogueGraph | null {
  const eligible = graphs.filter(g => isEligible(g, ctx, states[g.id]));
  if (!eligible.length) return null;
  eligible.sort((a, b) => (a.priority - b.priority) || (b.version - a.version) || (a.id < b.id ? -1 : 1));
  return eligible[0];
}

// All eligible graphs, best-first (for a "topics" LB/RB list at the same NPC).
export function eligibleTopics(graphs: DialogueGraph[], ctx: SocialCtx, states: Record<string, GraphState>): DialogueGraph[] {
  return graphs.filter(g => isEligible(g, ctx, states[g.id]))
    .sort((a, b) => (a.priority - b.priority) || (b.version - a.version) || (a.id < b.id ? -1 : 1));
}
