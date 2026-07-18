// Runtime helpers that resolve a node's text variant and its available choices for a
// given context. Pure — the UI renders whatever these return.
import type { DialogueGraph, DialogueNode, DialogueChoice } from './types.ts';
import { evaluate, type SocialCtx } from './conditions.ts';

export function nodeById(g: DialogueGraph, id: string): DialogueNode | null { return g.nodes.find(n => n.id === id) || null; }

// The text to show — first matching conditional variant, else the plain string.
export function resolveText(node: DialogueNode, ctx: SocialCtx): string {
  if (typeof node.text === 'string') return node.text;
  for (const v of node.text) if (evaluate(v.when, ctx)) return v.text;
  return node.text.length ? node.text[node.text.length - 1].text : '';
}

export interface ResolvedChoice extends DialogueChoice { available: boolean; reason?: string; }

// Choices to present: hide unavailable ones unless they opt to show disabled with a
// reason (so a locked-but-visible option reads as "needs X").
export function availableChoices(node: DialogueNode, ctx: SocialCtx): ResolvedChoice[] {
  const out: ResolvedChoice[] = [];
  for (const c of (node.choices || [])) {
    const condOk = evaluate(c.when, ctx);
    const skillOk = !c.requireSkill || (ctx.skills[c.requireSkill.skill] || 0) >= c.requireSkill.lvl;
    const available = condOk && skillOk;
    if (available) { out.push({ ...c, available: true }); }
    else if (c.showDisabled) {
      const reason = !skillOk && c.requireSkill ? `Needs ${c.requireSkill.skill} ${c.requireSkill.lvl}` : (c.disabledReason || 'Not available yet');
      out.push({ ...c, available: false, reason });
    }
  }
  return out;
}
