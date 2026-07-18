// Authored dialogue graphs. Beats are short (1–3 sentences), voice-distinct, and every
// consequential choice carries typed, uniquely-identified effects. Three pilots are
// deep (Frosty, Perry, Edna); other NPCs use greetingGraph() as a safe fallback.
import type { DialogueGraph } from '../types.ts';
import { PRIORITY_TIERS as P } from '../types.ts';

export const GRAPHS: DialogueGraph[] = [
  // ======================= FROSTY =======================
  {
    id: 'frosty_first', npc: 'frosty', entry: 'a', priority: P.RELATIONSHIP, once: true, version: 1,
    when: { op: 'first_meeting' },
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'happy', text: "New face in the valley! I'm Frosty — I help newcomers find their feet. Source, make, deliver. That's the whole game.",
        choices: [
          { id: 'keen', text: "I'm ready to graft.", tone: 'firm', effects: [{ id: 'frosty_first:keen:respect', kind: 'relationship', dim: 'respect', delta: 6 }, { id: 'frosty_first:keen:flag', kind: 'flag', key: 'met_frosty', value: true }], next: 'b' },
          { id: 'unsure', text: "Honestly? A bit lost.", tone: 'apologetic', effects: [{ id: 'frosty_first:unsure:warmth', kind: 'relationship', dim: 'warmth', delta: 6 }, { id: 'frosty_first:unsure:flag', kind: 'flag', key: 'met_frosty', value: true }], next: 'b' },
        ] },
      { id: 'b', speaker: 'npc', expression: 'neutral', text: "Everyone starts somewhere. Take a contract off the board, fill it honest, and the valley'll warm to you. Stay frosty." },
    ],
  },
  {
    id: 'frosty_pipeline_risk', npc: 'frosty', entry: 'a', priority: P.URGENT_CONTRACT, cooldownDays: 1, version: 1,
    when: { op: 'all', of: [{ op: 'contract_active' }, { op: 'supplier_short' }] },
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'concerned', text: "Word is one of your suppliers is short. Don't let it sink the order — chase them, or gather the shortfall yourself.",
        choices: [
          { id: 'thanks', text: "Good shout — I'll sort it.", tone: 'firm', effects: [{ id: 'frosty_risk:thanks:trust', kind: 'relationship', dim: 'trust', delta: 3 }] },
          { id: 'shrug', text: "It'll be fine.", tone: 'reckless', effects: [{ id: 'frosty_risk:shrug:concern', kind: 'memory', write: { id: 'mem:frosty:warned_shortage', category: 'business', subject: 'player', summaryKey: 'Shrugged off a supplier warning', emotion: -20, strength: 55, source: 'experienced', confidence: 90, tags: ['advice'] } }] },
        ] },
    ],
  },
  {
    id: 'frosty_contract_fail', npc: 'frosty', entry: 'a', priority: P.IMMEDIATE_CONSEQUENCE, cooldownDays: 1, version: 1,
    when: { op: 'contract_expired_recently' },
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'disappointed', text: "Heard an order lapsed on you. Happens to everyone once. What matters is the next one lands.",
        choices: [
          { id: 'own', text: "My fault. Won't happen again.", tone: 'apologetic', effects: [{ id: 'frosty_fail:own:trust', kind: 'relationship', dim: 'trust', delta: 5 }, { id: 'frosty_fail:own:mem', kind: 'memory', write: { id: 'mem:frosty:owned_failure', category: 'business', subject: 'player', summaryKey: 'Owned up to a failed delivery', emotion: 15, strength: 60, source: 'experienced', confidence: 95, tags: ['character'] } }] },
          { id: 'blame', text: "The supplier stitched me up.", tone: 'firm', effects: [{ id: 'frosty_fail:blame:respect', kind: 'relationship', dim: 'respect', delta: -3 }] },
        ] },
    ],
  },
  {
    id: 'frosty_promise', npc: 'frosty', entry: 'a', priority: P.RELATIONSHIP, once: true, version: 1,
    when: { op: 'all', of: [{ op: 'flag', key: 'met_frosty' }, { op: 'tut_done' }] },
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'neutral', text: "Do me one favour while you're finding your feet — deliver a contract on time, in full. Come tell me when you have.",
        choices: [
          { id: 'promise', text: "You have my word.", tone: 'firm',
            effects: [
              { id: 'frosty_promise:mem', kind: 'memory', write: { id: 'mem:frosty:otif_promise', category: 'promise', subject: 'player', summaryKey: 'Promised Frosty an on-time, in-full delivery', emotion: 10, strength: 90, source: 'experienced', confidence: 100, tags: ['promise', 'otif'] } },
              { id: 'frosty_promise:flag', kind: 'flag', key: 'frosty_promise_open', value: true },
              { id: 'frosty_promise:followup', kind: 'followup', graph: 'frosty_promise_followup', afterDays: 0 },
            ] },
          { id: 'decline', text: "No promises.", tone: 'neutral', effects: [{ id: 'frosty_promise:decline:warmth', kind: 'relationship', dim: 'warmth', delta: -2 }] },
        ] },
    ],
  },
  {
    id: 'frosty_promise_followup', npc: 'frosty', entry: 'a', priority: P.PROMISE_FOLLOWUP, version: 1,
    when: { op: 'all', of: [{ op: 'flag', key: 'frosty_promise_open' }, { op: 'has_memory', tag: 'promise' }] },
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'happy', text: "You gave me your word about an on-time, in-full delivery. I remember. Have you managed it?",
        choices: [
          { id: 'done', text: "On time, in full. Done.", tone: 'firm',
            effects: [
              { id: 'frosty_fu:done:respect', kind: 'relationship', dim: 'respect', delta: 10 },
              { id: 'frosty_fu:done:trust', kind: 'relationship', dim: 'trust', delta: 8 },
              { id: 'frosty_fu:done:flag', kind: 'flag', key: 'frosty_promise_open', value: false },
              { id: 'frosty_fu:done:mem', kind: 'memory', write: { id: 'mem:frosty:kept_promise', category: 'promise', subject: 'player', summaryKey: 'Kept the OTIF promise', emotion: 40, strength: 95, source: 'experienced', confidence: 100, tags: ['promise', 'kept'] } },
              { id: 'frosty_fu:done:radio', kind: 'radio_unlock', label: 'A Frosty track, on the house' },
            ], next: 'praise' },
          { id: 'notyet', text: "Not yet — still working on it.", tone: 'neutral', effects: [{ id: 'frosty_fu:notyet:none', kind: 'flag', key: 'frosty_promise_seen', value: true }] },
        ] },
      { id: 'praise', speaker: 'npc', expression: 'happy', text: "That's a proper job. Knew you had it in you. Put the radio on — one's on me." },
    ],
  },
  {
    id: 'frosty_flavour', npc: 'frosty', entry: 'a', priority: P.FLAVOUR, cooldownDays: 1, version: 1,
    when: { op: 'returning' },
    nodes: [
      { id: 'a', speaker: 'npc',
        text: [
          { when: { op: 'crime_suspicion', gte: 40 }, text: "I hear things, you know. Keep it clean, eh? A good name's worth more than a quick coin." },
          { when: { op: 'time_of_day', is: 'morning' }, text: "Morning! Kettle's on. No rest for the busy — what's the plan today?" },
          { when: { op: 'time_of_day', is: 'night' }, text: "Late one? Mind how you go. The valley keeps till morning." },
          { text: "Ticking along nicely, by the look of you. Stay frosty." },
        ],
        expression: 'neutral', choices: [{ id: 'ok', text: "Cheers, Frosty.", tone: 'kind' }] },
    ],
  },

  // ======================= PERRY (logistics) =======================
  {
    id: 'perry_first', npc: 'perry', entry: 'a', priority: P.RELATIONSHIP, once: true, version: 1,
    when: { op: 'first_meeting' },
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'neutral', text: "Perry. Freight agent, Port Salvo. If it moves through this coast, it moves through me. What do you need?",
        choices: [
          { id: 'intro', text: "Just introducing myself.", tone: 'neutral', effects: [{ id: 'perry_first:intro:warmth', kind: 'relationship', dim: 'warmth', delta: 2 }] },
          { id: 'business', text: "Straight to business — who's reliable?", tone: 'shrewd', effects: [{ id: 'perry_first:biz:respect', kind: 'relationship', dim: 'respect', delta: 4 }], next: 'b' },
        ] },
      { id: 'b', speaker: 'npc', expression: 'happy', text: "Now that I can work with. Prove you don't waste my time and I'll point you at the good suppliers." },
    ],
  },
  {
    id: 'perry_shortage', npc: 'perry', entry: 'a', priority: P.SUPPLIER_INTEL, cooldownDays: 2, version: 1,
    when: { op: 'supplier_short' },
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'concerned', text: "Heads up — a supplier's running short this week. You can chase them, or cover the shortfall yourself and keep the order clean.",
        choices: [
          { id: 'cover', text: "I'll cover it myself.", tone: 'firm',
            effects: [
              { id: 'perry_short:cover:respect', kind: 'relationship', dim: 'respect', delta: 6 },
              { id: 'perry_short:cover:flag', kind: 'flag', key: 'perry_helped', value: true },
              { id: 'perry_short:cover:mem', kind: 'memory', write: { id: 'mem:perry:handled_disruption', category: 'business', subject: 'player', summaryKey: 'Covered a supplier shortfall cleanly', emotion: 30, strength: 75, source: 'witnessed', confidence: 95, tags: ['disruption', 'reliable'] } },
              { id: 'perry_short:cover:intel', kind: 'supplier_intel', offer: 'premium', note: "Featherstone Foundry rarely short-ships — worth the premium." },
            ], next: 'b' },
          { id: 'chase', text: "I'll lean on the supplier.", tone: 'neutral', effects: [{ id: 'perry_short:chase:trust', kind: 'relationship', dim: 'trust', delta: 2 }] },
        ] },
      { id: 'b', speaker: 'npc', expression: 'happy', text: "That's the difference between a trader and a chancer. I'll remember this." },
    ],
  },
  {
    id: 'perry_priority_freight', npc: 'perry', entry: 'a', priority: P.SUPPLIER_INTEL, once: true, version: 1,
    // Only reachable BECAUSE the player earlier chose to cover a shortfall — a prior
    // dialogue decision changes this later opportunity.
    when: { op: 'flag', key: 'perry_helped' },
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'happy', text: "You covered that shortfall without whinging. Tell you what — I'll put your orders on priority freight. Faster inbound, no charge.",
        choices: [
          { id: 'accept', text: "Appreciated, Perry.", tone: 'kind',
            effects: [
              { id: 'perry_pf:accept:trust', kind: 'relationship', dim: 'trust', delta: 8 },
              { id: 'perry_pf:accept:flag', kind: 'flag', key: 'perry_priority_freight', value: true },
              { id: 'perry_pf:accept:log', kind: 'log', text: '📦 Perry granted you priority freight — a standing perk from a good turn.', tone: 'good' },
            ] },
        ] },
    ],
  },

  // ======================= EDNA (town resident) =======================
  {
    id: 'edna_first', npc: 'edna', entry: 'a', priority: P.RELATIONSHIP, once: true, version: 1,
    when: { op: 'first_meeting' },
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'happy', text: "Ooh, a new neighbour! I'm Edna. If you ever need a hand — or a cuppa — you know where I am.",
        choices: [
          { id: 'warm', text: "That's very kind, Edna.", tone: 'kind', effects: [{ id: 'edna_first:warm:warmth', kind: 'relationship', dim: 'warmth', delta: 6 }] },
          { id: 'busy', text: "Cheers. Bit rushed just now.", tone: 'neutral', effects: [{ id: 'edna_first:busy:warmth', kind: 'relationship', dim: 'warmth', delta: 1 }] },
        ] },
    ],
  },
  {
    id: 'edna_request', npc: 'edna', entry: 'a', priority: P.ACTIVE_REQUEST, once: true, version: 1,
    when: { op: 'all', of: [{ op: 'returning' }, { op: 'not', expr: { op: 'flag', key: 'edna_request_done' } }] },
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'concerned', text: "Actually, love — my mantel looks so bare. If you ever came across a nice vase, I'd be ever so grateful. No rush, mind.",
        choices: [
          { id: 'promise', text: "Leave it with me.", tone: 'kind',
            effects: [
              { id: 'edna_req:promise:mem', kind: 'memory', write: { id: 'mem:edna:vase_promise', category: 'promise', subject: 'player', summaryKey: 'Promised Edna a vase for her mantel', emotion: 20, strength: 85, source: 'experienced', confidence: 100, tags: ['promise', 'request'] } },
              { id: 'edna_req:promise:flag', kind: 'flag', key: 'edna_request_active', value: true },
              { id: 'edna_req:promise:fu', kind: 'followup', graph: 'edna_request_followup', afterDays: 0 },
            ] },
          { id: 'maybe', text: "I'll keep an eye out.", tone: 'neutral', effects: [{ id: 'edna_req:maybe:flag', kind: 'flag', key: 'edna_request_active', value: true }] },
        ] },
    ],
  },
  {
    id: 'edna_request_followup', npc: 'edna', entry: 'a', priority: P.PROMISE_FOLLOWUP, version: 1,
    when: { op: 'flag', key: 'edna_request_active' },
    nodes: [
      { id: 'a', speaker: 'npc',
        text: [
          { when: { op: 'has_item', item: 'vase', gte: 1 }, text: "Is that — oh, you remembered! A vase! You dear thing." },
          { text: "Any luck with that vase, love? No pressure at all." },
        ], expression: 'happy',
        choices: [
          { id: 'give', text: "Here you are, Edna.", tone: 'kind', when: { op: 'has_item', item: 'vase', gte: 1 },
            effects: [
              { id: 'edna_fu:give:take', kind: 'take_item', item: 'vase', qty: 1 },
              { id: 'edna_fu:give:coins', kind: 'grant_coins', amount: 60 },
              { id: 'edna_fu:give:warmth', kind: 'relationship', dim: 'warmth', delta: 12 },
              { id: 'edna_fu:give:trust', kind: 'relationship', dim: 'trust', delta: 8 },
              { id: 'edna_fu:give:done', kind: 'flag', key: 'edna_request_done', value: true },
              { id: 'edna_fu:give:active', kind: 'flag', key: 'edna_request_active', value: false },
              { id: 'edna_fu:give:mem', kind: 'memory', write: { id: 'mem:edna:kept_vase', category: 'gift', subject: 'player', summaryKey: 'Brought Edna the vase she wanted', emotion: 50, strength: 90, source: 'experienced', confidence: 100, tags: ['kept', 'gift'] } },
            ], next: 'thanks' },
          { id: 'soon', text: "Still looking — soon.", tone: 'apologetic' },
        ] },
      { id: 'thanks', speaker: 'npc', expression: 'happy', text: "It's perfect. Here, take this for your trouble — and put the kettle on next time you're passing." },
    ],
  },
  {
    id: 'edna_flavour', npc: 'edna', entry: 'a', priority: P.FLAVOUR, cooldownDays: 1, version: 1,
    when: { op: 'returning' },
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'neutral',
        text: [
          { when: { op: 'rel', dim: 'warmth', gte: 60 }, text: "There's my favourite neighbour! The whole street's been asking after you." },
          { text: "Lovely to see a friendly face. Mind how you go, love." },
        ], choices: [{ id: 'ok', text: "You too, Edna.", tone: 'kind' }] },
    ],
  },
];

// A safe, contextual greeting fallback for any NPC without authored content — keeps
// every interaction working without shallow bulk dialogue.
export function greetingGraph(npcId: string): DialogueGraph {
  return {
    id: `greet_${npcId}`, npc: npcId, entry: 'a', priority: 9, version: 1,
    nodes: [
      { id: 'a', speaker: 'npc', expression: 'neutral',
        text: [
          { when: { op: 'time_of_day', is: 'morning' }, text: 'Morning! Grand day for it.' },
          { when: { op: 'time_of_day', is: 'evening' }, text: "Evening. Winding down, are we?" },
          { text: 'Good to see you. Keeping busy?' },
        ], choices: [{ id: 'bye', text: 'Take care.', tone: 'kind' }] },
    ],
  };
}

export const ALL_GRAPHS = GRAPHS;
