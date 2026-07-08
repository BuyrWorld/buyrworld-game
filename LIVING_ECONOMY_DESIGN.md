# LIVING_ECONOMY_DESIGN.md

Design for BuyrWorld's **living economy** — the GAME_BIBLE's #1 hard-to-copy moat
("living economy + procedural contracts"). Read alongside `GAME_BIBLE.md` (source
of truth). This is a **design doc for sign-off**, not yet implemented.

Goal: turn prices from a decorative random walk into a **simulated market** where
supply, demand, the supply chain, and a macro business cycle all move prices —
and the player can *see why*. It must deepen the defining supply-chain mechanic,
stay child-safe (market/procurement framing, no gambling), teach economics by
stealth, and **never weaken the idle/offline core loop**.

---

## What exists today (build on, don't rewrite)

- **Per-NPC/per-item drift** `S.market.drift[npc][item] ∈ [0.65, 1.45]` — a pure
  multiplicative random walk in `rollMarket()`, stepped by elapsed time (already
  offline-safe, capped at 24 steps).
- **Price** = `ITEMS[it].v × drift × margin(1.35 buy / 0.80 sell) × eventMult ×
  seasonMult × tradeBonus` (`buyPrice`/`sellPrice`).
- **World events** (`eventMult`) and **seasons** (`seasonMult`) already nudge
  prices; the **Exchange** speculates on 5 commodities via `avgDrift`.
- **The recipe graph already exists**: every action's `in`/`out` defines the
  supply chain (raw → processed → manufactured). We can *derive* propagation from
  it rather than hand-authoring links.

**The gap:** drift has no memory of supply/demand, no macro cycle, no chain
linkage, and no narration. That's exactly what "living economy" adds.

---

## The model — four layers

### 1. Supply & demand pressure (per item)
`S.econ.pressure[it]` (~[0.55, 1.7], starts 1.0) is the demand/scarcity signal:
- **Player floods the market** → selling `qty` nudges pressure **down**
  (saturation): `pressure ×= 1 − k·qty/baseDemand[it]`. Dumping 200 iron tanks
  the iron price; this pushes the player toward **diversifying and distributing**
  (the retail/logistics loop) instead of one-item grinding.
- **Scarcity** (contracts, NPC/town consumption, input buying) nudges pressure
  **up**.
- **Recovery**: each market step, pressure mean-reverts toward 1.0 (`pressure +=
  (1−pressure)·recover`). Prices heal over time — dumping is a temporary dip, not
  permanent ruin.

### 2. Mean-reverting drift (the key change)
`rollMarket()` stops free-walking and instead pulls drift toward an **equilibrium**:
```
eq[it]   = macroDemand × pressure[it] × chainCost[it]     (all ~1.0-centred)
drift   += (eq − drift)·revert + smallNoise               (clamped [0.55,1.55])
```
This makes prices **responsive** (they chase real signals) yet **bounded** (no
inflation/deflation runaway) — the single most important stability property.

### 3. Supply-chain propagation (cost-push, from the recipe graph)
For any item that is *produced* by an action with inputs, its equilibrium carries
an input-cost term:
```
chainCost[it] = clamp( margin × Σ(inputEqPrice) / ITEMS[it].v )
```
computed by walking `act.in → act.out`. So a **raw-ore shortage raises bar prices,
which raises tool/part prices** — visible cost-push inflation up the chain. This
is the supply-chain mechanic made economic, and a genuine procurement lesson.

### 4. Macro business cycle + news network
`S.econ.phase` cycles a town index on a slow oscillation + random shocks:

| Phase | macroDemand | Feel |
|---|---|---|
| **Boom** | 1.15 | high demand, good sell prices, pricey inputs |
| **Steady** | 1.00 | baseline |
| **Downturn** | 0.85 | soft demand, cheap to buy, hard to sell high |
| **Recovery** | 0.95 | climbing back |

Phases last several game days and are announced by the **news network** — an
economic feed that *explains* moves ("🪨 Ore glut — mining output up, prices
soft", "⚙️ Machinery boom — parts demand +20%", "📉 Downturn eases into
Recovery"). News ties cause → effect on a ticker + the Notice Board, so the market
never feels arbitrary. This is the "living world / news" moat and the stealth
economics teacher.

---

## Player impact ("player success visibly changes the world")
- Selling volume visibly **moves the price you get** → rewards spreading output
  across items and using distribution/retail, not dumping one good.
- Buying **scarce inputs costs more**; timing purchases to Downturns and sales to
  Booms becomes a real, learnable decision.
- Big producers **reshape their local market** — the world reacts to you.

## Idle/offline protection (non-negotiable)
- The economy advances **deterministically by elapsed time**, exactly like drift
  and bank interest already do (stepped, capped). No active input required.
- Offline production applies its supply pressure during `applyOffline()` catch-up,
  so returning players see a coherent market, not a frozen one.
- Idle income keeps flowing; the economy changes *how much*, never *whether* the
  loop runs. Selling saturation is bounded and self-healing, so idle never dead-ends.

---

## Data model
```ts
S.econ = {
  phase: 'steady', phaseUntil: <ms>, index: 1.0,     // macro
  pressure: { [itemId]: number },                    // supply/demand, ~1.0
  news: [ { t, icon, text } ],                        // rolling feed (cap ~20)
  updatedAt: <ms>,
}
```
- New pure module `src/data/economy.ts`: `baseDemand`, elasticity/`k`, `recover`,
  `revert`, macro phase table, and pure functions `stepEconomy(econ, dtSteps,
  chainCost)`, `applySale(econ,item,qty)`, `macroDemand(phase)`,
  `nextPhase(now)`. Pure = unit-testable (bounds, mean-reversion, determinism).
- `chainCost` derived once from `SKILLS[*].actions` (the recipe graph).
- Migration: absent `S.econ` → initialise (pressures 1.0, phase steady). Prices
  still computed by the existing `buyPrice`/`sellPrice`, with drift now shaped by
  the economy — **no change to callers**.

---

## Phasing (each increment shippable, tested, reversible)

- **LE1 — Supply/demand + mean-reverting drift.** ✅ **Shipped.** `S.econ.pressure`,
  sale-saturation (`_econSale` on every player sell), a mean-reverting `rollMarket`
  (drift now chases each item's equilibrium instead of random-walking), an immediate
  price nudge on sale, and time-based pressure recovery. Offline-safe (stepped),
  migration-guarded. Logic in `src/data/economy.ts`, guarded by
  `tests/economy.test.ts` (bounds, mean-reversion, no runaway, self-healing). The
  existing trader trend labels (▲ high / ▼ low / ▬ fair) are now economically driven.
  *Visible:* dumping a stack drops its price; prices recover over the following minutes.
- **LE2 — Macro cycle + news network.** Boom/Downturn phases + `macroDemand`, an
  economy-phase HUD chip, and the news ticker on the Notice Board. *Visible:* the
  town cycles through booms and downturns with explained headlines.
- **LE3 — Supply-chain propagation + market report.** Cost-push from the recipe
  graph; a "Market Report" view (per-item trend + driver + your price impact),
  reusing the Exchange styling. *Visible:* a raw shortage raises processed-good
  prices.
- **LE4 — Net-worth dashboard (optional).** Assets + cash + market value over
  time; feeds the acquisition-readiness retention/telemetry story.

---

## Risks & mitigations
- **Inflation/deflation runaway** → mean-reversion + hard clamps on drift,
  pressure, and eq; unit-tested bounds over long random runs.
- **Weakening idle** → time-based deterministic stepping, offline catch-up,
  bounded/self-healing saturation; idle income always flows.
- **Illegible "why did my price move?"** → the news network + trend arrows +
  driver labels make every move explainable.
- **Save breakage** → additive `S.econ` with migration; price callers unchanged.
- **Scope/balance** → ship LE1 alone first and tune constants against the test
  harness before layering LE2+.
- **Child-safety** → "market report"/procurement language, no gambling framing
  (consistent with Casino→Exchange ruling).

## Success criteria ("visible change")
Selling volume visibly moves your price; prices recover over days; the town shows
a boom/downturn phase with explained news; a raw-material shortage visibly lifts
downstream prices. Economics taught by playing.
