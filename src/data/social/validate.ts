// Content validation — catches authoring mistakes at build/test time so broken
// dialogue can never ship. Pure.
import type { DialogueGraph, DialogueNode, Effect, Expr } from './types.ts';
import { SUPPORTED_OPS, collectOps } from './conditions.ts';
import { SUPPORTED_EFFECT_KINDS, isSupportedEffect } from './effects.ts';

export interface ValidationIssue { graph: string; node?: string; severity: 'error' | 'warn'; code: string; msg: string; }

function nodeText(n: DialogueNode): boolean {
  if (typeof n.text === 'string') return n.text.trim().length > 0;
  return Array.isArray(n.text) && n.text.length > 0 && n.text.every(v => typeof v.text === 'string' && v.text.trim().length > 0);
}
function exprOps(e?: Expr): string[] { return [...collectOps(e)]; }

// Validate a set of graphs against the profiles that exist. Returns all issues.
export function validateGraphs(graphs: DialogueGraph[], profileIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (graph: string, severity: ValidationIssue['severity'], code: string, msg: string, node?: string) => issues.push({ graph, node, severity, code, msg });
  const allEffectIds = new Set<string>();

  const graphIds = new Set<string>();
  for (const g of graphs) {
    if (graphIds.has(g.id)) add(g.id, 'error', 'dup_graph', `Duplicate graph id "${g.id}"`);
    graphIds.add(g.id);
    if (!profileIds.has(g.npc)) add(g.id, 'error', 'missing_profile', `No NPC profile for "${g.npc}"`);

    const ids = new Set<string>();
    const targets = new Set<string>();
    let hasExit = false;
    for (const n of g.nodes) {
      if (ids.has(n.id)) add(g.id, 'error', 'dup_node', `Duplicate node id "${n.id}"`, n.id);
      ids.add(n.id);
      if (!nodeText(n)) add(g.id, 'error', 'missing_text', `Node "${n.id}" has no text`, n.id);

      // condition ops supported?
      const ops = [...exprOps(n.when), ...(Array.isArray(n.text) ? n.text.flatMap(v => exprOps(v.when)) : [])];
      for (const c of (n.choices || [])) ops.push(...exprOps(c.when));
      for (const op of ops) if (!SUPPORTED_OPS.includes(op as any)) add(g.id, 'error', 'bad_condition', `Unsupported condition op "${op}"`, n.id);

      // effect ids unique + supported
      const effs: Effect[] = [...(n.autoEffects || []), ...((n.choices || []).flatMap(c => c.effects || []))];
      for (const e of effs) {
        if (!isSupportedEffect(e)) add(g.id, 'error', 'bad_effect', `Unsupported effect kind "${(e as any).kind}"`, n.id);
        if (!e.id) add(g.id, 'error', 'effect_no_id', `Effect on node "${n.id}" has no id`, n.id);
        else if (allEffectIds.has(e.id)) add(g.id, 'error', 'dup_effect', `Duplicate effect id "${e.id}"`, n.id);
        else allEffectIds.add(e.id);
      }

      // targets + exits
      if (n.next) targets.add(n.next);
      const hasChoices = (n.choices || []).length > 0;
      if (hasChoices) {
        for (const c of n.choices!) {
          if (c.next) targets.add(c.next);
          const ends = !c.next;                       // a choice with no next ends the conversation
          const doesSomething = ends || !!c.next || (c.effects && c.effects.length > 0);
          if (!doesSomething) add(g.id, 'warn', 'choice_no_outcome', `Choice "${c.id}" leads nowhere and has no effect`, n.id);
          if (ends) hasExit = true;
        }
      } else if (!n.next) {
        hasExit = true;                                // a terminal node is an exit
      }
    }
    // every referenced target must exist
    for (const t of targets) if (!ids.has(t)) add(g.id, 'error', 'missing_target', `Node target "${t}" does not exist`);
    // entry must exist
    if (!ids.has(g.entry)) add(g.id, 'error', 'missing_entry', `Entry node "${g.entry}" does not exist`);
    // reachability from entry
    const reachable = new Set<string>();
    const stack = [g.entry];
    while (stack.length) {
      const id = stack.pop()!; if (reachable.has(id) || !ids.has(id)) continue; reachable.add(id);
      const n = g.nodes.find(x => x.id === id)!;
      if (n.next) stack.push(n.next);
      for (const c of (n.choices || [])) if (c.next) stack.push(c.next);
    }
    for (const n of g.nodes) if (!reachable.has(n.id)) add(g.id, 'warn', 'unreachable', `Node "${n.id}" is unreachable from entry`, n.id);
    if (!hasExit) add(g.id, 'error', 'no_exit', `Graph "${g.id}" has no exit node`);
    // once-only graphs must be persistable (they are — flagged here only if version missing)
    if (typeof g.version !== 'number') add(g.id, 'error', 'no_version', `Graph "${g.id}" has no content version`);
  }
  return issues;
}

export function validationErrors(issues: ValidationIssue[]): ValidationIssue[] { return issues.filter(i => i.severity === 'error'); }
