# NPC Dialogue, Relationship & Memory System — Authoring Guide

A data-driven, deterministic, console-safe conversation system. All content is authored
TypeScript data (no runtime AI, no executable strings). The pure engine lives in
`src/data/social/`; `main.ts` owns runtime state (`S.social`) and the adapters.

## Architecture at a glance
- `types.ts` — the whole typed data model (`NpcProfile`, `NpcRelationship`, `NpcMemory`,
  `DialogueGraph`/`Node`/`Choice`, `Expr` conditions, `Effect` descriptors, priority tiers).
- `relationships.ts` — bounded multi-dimensional bonds (warmth/trust/respect/suspicion),
  stage + mood derivation.
- `memory.ts` — per-NPC memory: create/dedupe/recall/decay/cap + rumour derivation.
- `conditions.ts` — `evaluate(expr, ctx)`; `ctx` is a plain `SocialCtx` snapshot.
- `effects.ts` — the supported-effect catalogue + helpers.
- `priority.ts` — `selectGraph()` picks the highest-priority eligible graph.
- `engine.ts` — `resolveText()` / `availableChoices()` for the UI.
- `validate.ts` — `validateGraphs()` catches authoring mistakes (run in tests).
- `content/profiles.ts`, `content/graphs.ts` — the authored NPCs + conversations.

`main.ts`: `_buildSocialCtx(npc)` builds the snapshot; `openConversation(npc)` selects and
renders the cinematic screen; `_applySocEffect` applies each effect **once** (keyed by the
effect's stable `id` in `S.social.applied`) and appends to `S.social.history`.

## Add an NPC
1. Add a `NpcProfile` to `PROFILES` in `content/profiles.ts` (id, displayName, occupation,
   organisation, `portrait` emoji, `expressions`, a `VoiceProfile`, and `relationshipConfig`
   start values). The voice profile is your writing brief — it keeps NPCs distinct.
2. That's enough for a working NPC: without any graph, `greetingGraph(id)` gives a safe,
   contextual fallback greeting.

## Add a conversation graph
Append a `DialogueGraph` to `GRAPHS` in `content/graphs.ts`:
```ts
{ id: 'edna_first', npc: 'edna', entry: 'a', priority: PRIORITY_TIERS.RELATIONSHIP,
  once: true, version: 1, when: { op: 'first_meeting' },
  nodes: [ { id: 'a', speaker: 'npc', expression: 'happy', text: "…",
    choices: [ { id: 'warm', text: "…", tone: 'kind', effects: [ /* … */ ] } ] } ] }
```
- `priority`: lower wins (1 urgent … 9 greeting). Use `PRIORITY_TIERS`.
- `once` / `cooldownDays`: replay control.
- Every graph needs an **exit** (a terminal node, or a choice with no `next`) and a `version`.

## Add conditions
Use the typed `Expr` union anywhere `when` is accepted (graph, node, text variant, choice):
`{ op: 'rel', dim: 'trust', gte: 40 }`, `{ op: 'has_memory', tag: 'promise' }`,
`{ op: 'contract_active' }`, `{ op: 'supplier_short' }`, `{ op: 'flag', key: 'met_frosty' }`,
combined with `{ op: 'all'|'any'|'not', … }`. Only ops in `SUPPORTED_OPS` are allowed (the
validator rejects the rest). To add a new op: extend `Expr`, handle it in `evaluate`, add it
to `SUPPORTED_OPS`, and extend `_buildSocialCtx` to supply the data.

## Add consequences (effects)
Attach typed `Effect[]` to a choice (`effects`) or node (`autoEffects`). Every effect needs a
**globally-unique, stable `id`** — that is what makes it idempotent. Kinds:
`relationship`, `memory`, `forget`, `flag`, `log`, `followup`, `radio_unlock`, `grant_coins`,
`grant_item`, `take_item`, `reputation`, `contract_offer`, `supplier_intel`, `crime_suspicion`,
`rumour`. To add a new kind: extend `Effect`, add it to `SUPPORTED_EFFECT_KINDS`, and add an
adapter case in `_applySocEffect` (main.ts).

## Create a remembered choice
Write a memory from the choice, then read it later:
```ts
effects: [{ id: 'edna_req:promise:mem', kind: 'memory',
  write: { id: 'mem:edna:vase_promise', category: 'promise', subject: 'player',
           summaryKey: 'Promised Edna a vase', emotion: 20, strength: 85, source: 'experienced',
           confidence: 100, tags: ['promise', 'request'] } }]
```
Gate a later node/choice on it with `{ op: 'has_memory', tag: 'promise' }`. Because the memory
id is stable, re-writing it never duplicates. Promises/betrayals/crime/contracts persist;
low-value flavour memories decay (`decayMemories`, daily).

## Create a delayed follow-up
From the first choice: `{ id: '…:fu', kind: 'followup', graph: 'edna_request_followup', afterDays: 0 }`
plus a flag (`{ kind:'flag', key:'edna_request_active', value:true }`). Author the follow-up
graph at `priority: PRIORITY_TIERS.PROMISE_FOLLOWUP` with `when: { op:'flag', key:'edna_request_active' }`.
It becomes the selected conversation next time the player talks to that NPC.

## Connect dialogue to a contract or supplier
Read live business state via conditions: `contract_active`, `contract_deliverable`,
`contract_expired_recently`, `pipeline_stage`, `customer_rep`, `supplier_short`. Affect it via
effects: `reputation`, `contract_offer`, `supplier_intel`. (See `frosty_pipeline_risk` and
`perry_shortage`.)

## Add portrait expressions
Set `expressions` on the profile (`{ happy: '😊', concerned: '😟', … }`) and reference one per
node with `expression: 'happy'`. The seven supported expressions are neutral / happy /
concerned / angry / suspicious / surprised / disappointed. Emoji tokens are placeholders —
swap in real art by changing the render in `_renderConversation`.

## Test a dialogue graph
- Unit: add cases to `tests/social.test.ts`. `validateGraphs([...GRAPHS], PROFILE_IDS)` must
  return **zero errors** — this runs in the suite and blocks broken content.
- Integration: drive it through the DEV gates in `e2e/social-dialogue.spec.ts`
  (`socOpen`, `socComplete`, `socChoose`, `socAdvance`, `socClose`, `socMem`, `socRel`,
  `socFlag`). Save/reload between beats to prove persistence and no reward duplication.

## Save compatibility
`S.social` is created with safe defaults for old saves in the load migration (versioned by
`SOCIAL_CONTENT_VERSION`). Applied-effect ids are preserved, so a migration never replays a
reward. Missing/renamed content is handled gracefully (unknown graphs fall back to the
greeting; unknown effects are ignored by the adapter).
