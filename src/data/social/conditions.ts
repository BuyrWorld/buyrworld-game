// Typed condition evaluator. Pure: main.ts assembles a plain `SocialCtx` snapshot
// from live state and this decides truth — no game import, fully testable.
import type { Expr, NpcRelationship, NpcMemory } from './types.ts';
import { hasMemory } from './memory.ts';

export interface SocialCtx {
  npc: string;
  day: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  season: string;
  location: string;
  mood: string;
  rel: NpcRelationship;
  memories: NpcMemory[];
  flags: Record<string, boolean>;
  choseIds: Record<string, boolean>;        // committed choice ids (ever)
  seenNodes: Record<string, number>;        // node id -> last day seen
  cooldowns: Record<string, number>;        // key -> day it becomes available again
  tutDone: boolean;
  contract: { active: boolean; deliverable: boolean; expiredRecently: boolean; stage: string | null };
  customerRep: Record<string, number>;
  supplierShort: Record<string, boolean>;   // offerId -> is short
  items: Record<string, number>;
  cash: number;
  skills: Record<string, number>;
  businesses: Record<string, boolean>;
  economy: { phase: string; demand: number };
  crimeSuspicion: number;
  companion: string | null;
  homeTier: number;
}

const num = (v: number | undefined, dflt: number) => (v === undefined ? dflt : v);

export function evaluate(expr: Expr | undefined, ctx: SocialCtx): boolean {
  if (!expr) return true;
  switch (expr.op) {
    case 'first_meeting': return ctx.rel.interactionCount === 0;
    case 'returning': return ctx.rel.interactionCount > 0;
    case 'time_of_day': return ctx.timeOfDay === expr.is;
    case 'season': return ctx.season === expr.is;
    case 'location': return ctx.location === expr.is;
    case 'mood': return ctx.mood === expr.is;
    case 'rel': {
      const v = ctx.rel[expr.dim];
      return v >= num(expr.gte, -Infinity) && v <= num(expr.lte, Infinity);
    }
    case 'stage': return ctx.rel.stage === expr.is;
    case 'chose': return !!ctx.choseIds[expr.choice];
    case 'has_memory': return hasMemory(ctx.memories, { category: expr.category, subject: expr.subject, tag: expr.tag, minStrength: expr.minStrength });
    case 'flag': return (ctx.flags[expr.key] || false) === (expr.is ?? true);
    case 'tut_done': return ctx.tutDone;
    case 'contract_active': return ctx.contract.active;
    case 'contract_deliverable': return ctx.contract.deliverable;
    case 'contract_expired_recently': return ctx.contract.expiredRecently;
    case 'pipeline_stage': return ctx.contract.stage === expr.is;
    case 'customer_rep': { const v = ctx.customerRep[expr.client] || 0; return v >= num(expr.gte, -Infinity) && v <= num(expr.lte, Infinity); }
    case 'supplier_short': return expr.offer ? !!ctx.supplierShort[expr.offer] : Object.values(ctx.supplierShort).some(Boolean);
    case 'has_item': return (ctx.items[expr.item] || 0) >= num(expr.gte, 1);
    case 'cash': return ctx.cash >= num(expr.gte, -Infinity) && ctx.cash <= num(expr.lte, Infinity);
    case 'skill': return (ctx.skills[expr.skill] || 0) >= num(expr.gte, 0);
    case 'owns_business': return !!ctx.businesses[expr.is];
    case 'economy': return (expr.phase === undefined || ctx.economy.phase === expr.phase)
      && ctx.economy.demand >= num(expr.demand_gte, -Infinity) && ctx.economy.demand <= num(expr.demand_lte, Infinity);
    case 'crime_suspicion': return ctx.crimeSuspicion >= num(expr.gte, 0);
    case 'companion': return expr.is ? ctx.companion === expr.is : ctx.companion !== null;
    case 'home_tier': return ctx.homeTier >= num(expr.gte, 0);
    case 'seen': return ctx.seenNodes[expr.node] !== undefined;
    case 'not_seen': return ctx.seenNodes[expr.node] === undefined;
    case 'cooldown_ok': return (ctx.cooldowns[expr.key] === undefined) || ctx.day >= ctx.cooldowns[expr.key];
    case 'not': return !evaluate(expr.expr, ctx);
    case 'all': return expr.of.every(e => evaluate(e, ctx));
    case 'any': return expr.of.some(e => evaluate(e, ctx));
    default: return false;
  }
}

// Collect every distinct condition op referenced by an expression tree — used by the
// validator to detect unsupported/impossible conditions.
export const SUPPORTED_OPS: ReadonlyArray<Expr['op']> = [
  'first_meeting', 'returning', 'time_of_day', 'season', 'location', 'mood', 'rel', 'stage', 'chose',
  'has_memory', 'flag', 'tut_done', 'contract_active', 'contract_deliverable', 'contract_expired_recently',
  'pipeline_stage', 'customer_rep', 'supplier_short', 'has_item', 'cash', 'skill', 'owns_business', 'economy',
  'crime_suspicion', 'companion', 'home_tier', 'seen', 'not_seen', 'cooldown_ok', 'not', 'all', 'any',
];
export function collectOps(expr: Expr | undefined, into: Set<string> = new Set()): Set<string> {
  if (!expr) return into;
  into.add(expr.op);
  if (expr.op === 'not') collectOps(expr.expr, into);
  else if (expr.op === 'all' || expr.op === 'any') for (const e of expr.of) collectOps(e, into);
  return into;
}
