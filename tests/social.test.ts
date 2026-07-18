import { describe, it, expect } from 'vitest';
import { defaultRelationship, applyDelta, applyDeltas, relationshipStage, touchInteraction, moodLabel } from '../src/data/social/relationships.ts';
import { makeMemory, writeMemory, forgetMemory, recallMemories, hasMemory, decayMemories, capMemories, rumourFromEvent, MEMORY_CAP_PER_NPC } from '../src/data/social/memory.ts';
import { evaluate, collectOps, type SocialCtx } from '../src/data/social/conditions.ts';
import { selectGraph, isEligible } from '../src/data/social/priority.ts';
import { resolveText, availableChoices, nodeById } from '../src/data/social/engine.ts';
import { validateGraphs, validationErrors } from '../src/data/social/validate.ts';
import { duplicateEffectIds } from '../src/data/social/effects.ts';
import { ALL_GRAPHS, greetingGraph } from '../src/data/social/content/graphs.ts';
import { PROFILE_IDS } from '../src/data/social/content/profiles.ts';
import type { DialogueGraph } from '../src/data/social/types.ts';

function ctx(over: Partial<SocialCtx> = {}): SocialCtx {
  return {
    npc: 'frosty', day: 1, timeOfDay: 'morning', season: 'spring', location: 'village', mood: 'Neutral',
    rel: defaultRelationship(), memories: [], flags: {}, choseIds: {}, seenNodes: {}, cooldowns: {}, tutDone: false,
    contract: { active: false, deliverable: false, expiredRecently: false, stage: null },
    customerRep: {}, supplierShort: {}, items: {}, cash: 0, skills: {}, businesses: {},
    economy: { phase: 'steady', demand: 1 }, crimeSuspicion: 0, companion: null, homeTier: 0, ...over,
  };
}

describe('relationships — bounded, multi-dimensional', () => {
  it('stays within 0..100 on any delta', () => {
    let r = defaultRelationship();
    expect(applyDelta(r, 'warmth', 999).rel.warmth).toBe(100);
    expect(applyDelta(r, 'trust', -999).rel.trust).toBe(0);
    expect(applyDelta(r, 'warmth', 10).actual).toBe(10);
    expect(applyDelta(defaultRelationship({ startWarmth: 98 }), 'warmth', 10).actual).toBe(2);   // clamped actual
  });
  it('models orthogonal feelings: likes but distrusts; respects but cold', () => {
    const likesDistrusts = { ...defaultRelationship(), warmth: 80, trust: 20, respect: 40, suspicion: 30 };
    expect(likesDistrusts.warmth).toBeGreaterThan(likesDistrusts.trust);
    const respectsCold = { ...defaultRelationship(), warmth: 20, respect: 80 };
    expect(moodLabel(respectsCold as any)).toBe('Respectful');
  });
  it('suspicion dominates the stage when high', () => {
    expect(relationshipStage({ ...defaultRelationship(), warmth: 30, suspicion: 75 } as any)).toBe('hostile');
    expect(relationshipStage({ ...defaultRelationship(), warmth: 85, trust: 80, suspicion: 5, interactionCount: 5 } as any)).toBe('confidant');
  });
  it('interaction count increments once per day', () => {
    let r = defaultRelationship();
    r = touchInteraction(r, 3); r = touchInteraction(r, 3); expect(r.interactionCount).toBe(1);
    r = touchInteraction(r, 4); expect(r.interactionCount).toBe(2);
  });
});

describe('memory — create, dedupe, recall, decay, cap', () => {
  it('writes are idempotent by id (no duplicates on re-write)', () => {
    let list = writeMemory([], makeMemory('frosty', 1, { id: 'm1', category: 'promise', subject: 'player', summaryKey: 'x' }));
    list = writeMemory(list, makeMemory('frosty', 2, { id: 'm1', category: 'promise', subject: 'player', summaryKey: 'x', strength: 90 }));
    expect(list.filter(m => m.id === 'm1')).toHaveLength(1);
    expect(list[0].strength).toBe(90);
  });
  it('recalls by category/subject/tag, salience-first', () => {
    const list = [
      makeMemory('a', 1, { id: 'p', category: 'promise', subject: 'player', summaryKey: 'p', strength: 90 }),
      makeMemory('a', 1, { id: 'b', category: 'business', subject: 'player', summaryKey: 'b', strength: 40, tags: ['deal'] }),
    ];
    expect(recallMemories(list, { category: 'promise' })).toHaveLength(1);
    expect(hasMemory(list, { tag: 'deal' })).toBe(true);
    expect(recallMemories(list)[0].id).toBe('p');   // strongest first
  });
  it('flavour decays and is forgotten; promises/crime persist', () => {
    const flavour = makeMemory('a', 0, { id: 'f', category: 'lifestyle', subject: 'player', summaryKey: 'f', strength: 20 });
    const promise = makeMemory('a', 0, { id: 'p', category: 'promise', subject: 'player', summaryKey: 'p', strength: 20 });
    const after = decayMemories([flavour, promise], 30);
    expect(after.find(m => m.id === 'f')).toBeUndefined();   // faded
    expect(after.find(m => m.id === 'p')).toBeTruthy();      // kept
  });
  it('caps per-NPC memory, keeping persistent + strongest', () => {
    const many = [];
    for (let i = 0; i < MEMORY_CAP_PER_NPC + 10; i++) many.push(makeMemory('a', 1, { id: 'm' + i, category: 'lifestyle', subject: 'player', summaryKey: 'x', strength: i }));
    many.push(makeMemory('a', 1, { id: 'crime', category: 'crime', subject: 'player', summaryKey: 'c', strength: 5 }));
    const capped = capMemories(many, 1);
    expect(capped.length).toBeLessThanOrEqual(MEMORY_CAP_PER_NPC);
    expect(capped.find(m => m.id === 'crime')).toBeTruthy();   // persistent kept despite low strength
  });
  it('forget removes a memory', () => {
    const list = writeMemory([], makeMemory('a', 1, { id: 'm', category: 'gift', subject: 'p', summaryKey: 'g' }));
    expect(forgetMemory(list, 'm')).toHaveLength(0);
  });
});

describe('conditions — typed evaluation', () => {
  it('first meeting vs returning', () => {
    expect(evaluate({ op: 'first_meeting' }, ctx())).toBe(true);
    expect(evaluate({ op: 'returning' }, ctx({ rel: { ...defaultRelationship(), interactionCount: 3 } }))).toBe(true);
  });
  it('relationship dimension bounds', () => {
    expect(evaluate({ op: 'rel', dim: 'warmth', gte: 50 }, ctx({ rel: { ...defaultRelationship(), warmth: 60 } }))).toBe(true);
    expect(evaluate({ op: 'rel', dim: 'suspicion', gte: 40 }, ctx({ crimeSuspicion: 0 }))).toBe(false);
  });
  it('memory, flags, contract state, and logical combinators', () => {
    const c = ctx({ memories: [makeMemory('frosty', 1, { id: 'm', category: 'promise', subject: 'player', summaryKey: 'x', tags: ['promise'] })], flags: { met: true }, contract: { active: true, deliverable: false, expiredRecently: false, stage: 'production' } });
    expect(evaluate({ op: 'has_memory', tag: 'promise' }, c)).toBe(true);
    expect(evaluate({ op: 'flag', key: 'met' }, c)).toBe(true);
    expect(evaluate({ op: 'flag', key: 'nope' }, c)).toBe(false);
    expect(evaluate({ op: 'all', of: [{ op: 'contract_active' }, { op: 'pipeline_stage', is: 'production' }] }, c)).toBe(true);
    expect(evaluate({ op: 'not', expr: { op: 'contract_active' } }, c)).toBe(false);
    expect(evaluate({ op: 'any', of: [{ op: 'flag', key: 'nope' }, { op: 'contract_active' }] }, c)).toBe(true);
  });
  it('collectOps walks nested expressions', () => {
    const ops = collectOps({ op: 'all', of: [{ op: 'flag', key: 'a' }, { op: 'not', expr: { op: 'contract_active' } }] });
    expect(ops.has('flag')).toBe(true); expect(ops.has('contract_active')).toBe(true);
  });
});

describe('priority — graph selection', () => {
  const g = (id: string, priority: number, when?: any, once?: boolean): DialogueGraph => ({ id, npc: 'frosty', entry: 'a', priority, when, once, version: 1, nodes: [{ id: 'a', text: 'hi', choices: [{ id: 'x', text: 'bye' }] }] });
  it('urgent contract outranks flavour', () => {
    const graphs = [g('flav', 8, { op: 'returning' }), g('urgent', 1, { op: 'contract_active' })];
    const sel = selectGraph(graphs, ctx({ contract: { active: true, deliverable: false, expiredRecently: false, stage: null }, rel: { ...defaultRelationship(), interactionCount: 2 } }), {});
    expect(sel?.id).toBe('urgent');
  });
  it('once-only graphs are not eligible after being played', () => {
    const once = g('first', 5, { op: 'first_meeting' }, true);
    expect(isEligible(once, ctx(), {})).toBe(true);
    expect(isEligible(once, ctx(), { playedDay: 1 })).toBe(false);
  });
  it('cooldown blocks replay until enough days pass', () => {
    const cd: DialogueGraph = { ...g('f', 8, { op: 'returning' }), cooldownDays: 3 };
    const c = ctx({ rel: { ...defaultRelationship(), interactionCount: 2 } });
    expect(isEligible(cd, { ...c, day: 2 }, { playedDay: 1 })).toBe(false);
    expect(isEligible(cd, { ...c, day: 5 }, { playedDay: 1 })).toBe(true);
  });
});

describe('engine — text variants + choice availability', () => {
  it('picks the first matching text variant', () => {
    const node = { id: 'a', text: [{ when: { op: 'time_of_day', is: 'night' } as any, text: 'late' }, { text: 'default' }] } as any;
    expect(resolveText(node, ctx({ timeOfDay: 'night' }))).toBe('late');
    expect(resolveText(node, ctx({ timeOfDay: 'morning' }))).toBe('default');
  });
  it('hides unavailable choices, shows disabled with a reason when asked', () => {
    const node = { id: 'a', text: 'hi', choices: [
      { id: 'ok', text: 'always' },
      { id: 'gated', text: 'need item', when: { op: 'has_item', item: 'vase', gte: 1 } },
      { id: 'skill', text: 'need skill', requireSkill: { skill: 'trading', lvl: 5 }, showDisabled: true },
    ] } as any;
    const noItem = availableChoices(node, ctx());
    expect(noItem.map(c => c.id)).toEqual(['ok', 'skill']);           // gated hidden, skill shown-disabled
    expect(noItem.find(c => c.id === 'skill')!.available).toBe(false);
    const withItem = availableChoices(node, ctx({ items: { vase: 1 }, skills: { trading: 9 } }));
    expect(withItem.map(c => c.id)).toEqual(['ok', 'gated', 'skill']);
  });
});

describe('content validation — the authored pilot graphs are sound', () => {
  it('all pilot + greeting graphs pass validation with zero errors', () => {
    const graphs = [...ALL_GRAPHS, greetingGraph('marge')];
    const issues = validateGraphs(graphs, PROFILE_IDS);
    const errors = validationErrors(issues);
    if (errors.length) console.log('VALIDATION ERRORS', JSON.stringify(errors, null, 2));
    expect(errors).toHaveLength(0);
  });
  it('all effect ids across pilot content are globally unique', () => {
    const effs = ALL_GRAPHS.flatMap(g => g.nodes.flatMap(n => [...(n.autoEffects || []), ...((n.choices || []).flatMap(c => c.effects || []))]));
    expect(duplicateEffectIds(effs)).toEqual([]);
  });
  it('catches missing targets, dup ids, dup effect ids and no-exit graphs', () => {
    const bad: DialogueGraph[] = [{ id: 'bad', npc: 'ghost', entry: 'a', priority: 5, version: 1, nodes: [
      { id: 'a', text: 'hi', choices: [{ id: 'x', text: 'go', next: 'missing', effects: [{ id: 'dup', kind: 'flag', key: 'k', value: true }] }] },
      { id: 'a', text: 'dup node', next: 'b', autoEffects: [{ id: 'dup', kind: 'flag', key: 'k2', value: true }] },
    ] }];
    const codes = validateGraphs(bad, new Set()).map(i => i.code);
    expect(codes).toContain('missing_profile');
    expect(codes).toContain('missing_target');
    expect(codes).toContain('dup_node');
    expect(codes).toContain('dup_effect');
    expect(codes).toContain('no_exit');
  });
});

describe('rumours — controlled, sourced propagation', () => {
  it('a rumour is heard, lower-confidence, and keeps its source + truth', () => {
    const origin = makeMemory('perry', 5, { id: 'evt', category: 'crime', subject: 'player', summaryKey: 'saw a theft', strength: 80, source: 'witnessed', confidence: 95, truth: true });
    const r = rumourFromEvent(origin, 'edna', 6);
    expect(r.source).toBe('heard');
    expect(r.confidence).toBeLessThan(origin.confidence);
    expect(r.truth).toBe(true);
    expect(r.tags).toContain('rumour');
    expect(r.npc).toBe('edna');
  });
});
