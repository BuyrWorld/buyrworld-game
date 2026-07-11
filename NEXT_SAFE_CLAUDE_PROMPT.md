# NEXT_SAFE_CLAUDE_PROMPT.md

The exact prompt to paste into Claude Code for the next build session.
It builds **one** milestone (**M16 — Contracts 2.0**), enhances the existing
contract system only, touches no working feature, and is save-safe.

---

## PROMPT TO RUN

You are Claude Code working in my BuyrWorld project
(`C:\Users\joshu\OneDrive\Desktop\buyrworld-game`).

Build **ONE** milestone only: **M16 — Contracts 2.0**.

This is an **additive depth pass on the EXISTING contract system**. The living
economy (`src/data/economy.ts`) is already deep and tested; contracts are the
shallow half of the game's #1 named moat ("living economy + procedural
contracts"). Your job is to make contracts procedural, time-pressured,
reputation-driven and economy-linked — WITHOUT rebuilding anything.

### Before you write any code
1. Read `src/data/contracts.ts`, the contract functions in `src/main.ts`
   (`genContract`, `fillContracts`, `deliverContract`, `rerollContract`,
   `contractSlots`, and the contracts-tab renderer), `src/data/economy.ts`,
   and `tests/data.test.ts`.
2. Give me a **5-bullet plan** and the exact new state fields you'll add.
3. **WAIT for my approval. Do not code before I say go.**

### Scope (do exactly this, nothing more)
- Move contract generation into a pure, testable module
  (extend `src/data/contracts.ts`, e.g. `rollContract(seed, playerLevels, rep, econ)`)
  so it can be unit-tested. Keep `CLIENTS` / `CONTRACT_POOL` working.
- Add real depth to each contract, all additive to the existing
  `{client,item,qty,coins,xp}` shape:
  - **Deadline** (game-time ticks/days) with a live countdown in the UI.
  - **Client reputation**: delivering on time raises rep with that client;
    expiring/abandoning lowers it. Higher rep → better offers, more slots,
    bonus payout. Store per-client rep in a new `S.contractRep` map (migrated).
  - **Contract tiers / rush jobs**: standard, rush (short deadline, higher pay),
    and bulk (large qty, lower unit pay) variants chosen procedurally.
  - **Economy link**: contract coin value scales with the live macro demand /
    item drift from `economy.ts` (boom pays more), so contracts breathe with
    the economy.
  - **Penalty on expiry**: a contract that passes its deadline expires and dents
    that client's reputation (no coin loss — keep it child-safe and forgiving).
- Surface it in the existing **Contracts tab**: countdown, client rep badge,
  tier label, and a short "why this pays what it pays" economy hint. Reuse the
  existing panel styling — do not restyle the game.
- Add 1 achievement or journey hook only if it fits the existing arrays
  cleanly (optional; skip if risky).

### Hard constraints
- **Do NOT** rebuild the game, the economy, the trade system, or the UI shell.
- **Do NOT** change `tick()` / `applyOffline()` idle/offline behaviour.
- **Do NOT** break saves: every new state field (`S.contractRep`, new contract
  props, any counters) MUST be added to `freshState()` AND guarded in the
  `load()` migration block. Old contracts without a deadline must still deliver.
- **Do NOT** touch unrelated systems (farming, fishing, pub, nightclub, BR,
  automatons, grid, etc.).
- **Do NOT** rename or remove `CLIENTS`, `CONTRACT_POOL`, `deliverContract`,
  or any exported symbol other systems use.
- Keep it deterministic where seeded so it can be tested.

### Definition of done (acceptance criteria)
- [ ] Contracts now show a **live deadline countdown** and expire when it runs out.
- [ ] Each client has a **visible reputation** that rises on delivery and falls on expiry.
- [ ] Contract offers vary by **tier (standard / rush / bulk)** and their pay reflects the tier.
- [ ] Contract coin value **moves with the living economy** (boom pays more, downturn less).
- [ ] All new state is in `freshState()` and migration-guarded; **an old save loads with zero errors and its existing contracts still deliver**.
- [ ] New **pure functions in `contracts.ts` are unit-tested** in `tests/` (rep math, tier selection, deadline/expiry, economy scaling).
- [ ] `npm test`, `npm run check:data`, and `npm run build` (via the full
      `node.exe` paths — npm isn't on PATH) all pass.
- [ ] A **visible in-game change** (the richer Contracts tab) — screenshot-able.

### Finish by
- Running tests + data check + build and pasting the results.
- Listing every file changed and every new state field + its migration guard.
- Committing and pushing with a clear message, then telling me what changed and
  what the next milestone (M15 — First 30-Minute Fun Pass) should tackle.

---

*Runner notes:* build commands use the full node path
(`"/c/Program Files/nodejs/node.exe" node_modules/vite/bin/vite.js build`,
`… node_modules/vitest/vitest.mjs run`, `… scripts/check-data.js`) because npm
is not on PATH. Watch the `public/` vs `Public/` case-collision when adding any
asset. Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
