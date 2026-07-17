# Contract-to-Cash — authoritative gameplay state engine

The pure state model lives in **`src/data/c2cEngine.ts`**; the real-world adapter
(persistence, game-time, inventory/wallet effects, reservations) lives in
`src/main.ts`. This milestone builds the **state model** — the stepwise clickable
pipeline UI is deliberately deferred (see *Follow-up UI* below).

It **extends** the existing flagship systems — it does not fork them: it drives the
same `FLAGSHIP_ORDER` / `SUPPLIER_OFFERS` / `DELIVERY_OPTIONS` data
(`src/data/contractToCash.ts`), settles money through the existing wallet
(`credit`/`debit` ledger), moves the existing inventory (`S.items`/`addItem`),
updates the existing reputation (`S.contractRep`) and reuses the QC rating
(`S.qc.rating`) as finished-goods quality.

## The 17-stage state machine

| # | Stage | Advances by | Effect |
|---|-------|-------------|--------|
| 1 | `customer_request` | **decision** `accept_request` | — |
| 2 | `quotation_review` | **decision** `accept_quote` / `decline_quote` | — |
| 3 | `supplier_selection` | **decision** `select_supplier(offer, qty, delivery)` | drafts the PO |
| 4 | `purchase_order_raised` | **decision** `raise_po(now)` | commits PO; pays prepaid + inbound freight; schedules the inbound timeline |
| 5 | `supplier_in_progress` | time `tick` (≥ `supplierReadyAt`) | rolls supplier on-time / shortfall |
| 6 | `inbound_transport` | time `tick` (≥ `inboundArriveAt`) | — |
| 7 | `goods_received` | auto `tick` | **real inbound inventory movement** + reserve; pays supplier if `on_delivery` |
| 8 | `goods_in_qc` | auto `tick` | rolls incoming defects → accepted vs quarantined |
| 9 | `materials_accepted_or_quarantined` | **decision** `resolve_materials(scrap\|rework\|hold)` | scrap removes stock; rework upgrades quarantine → accepted |
| 10 | `production` | **decision** `run_production` | **consumes accepted material, creates real finished goods** |
| 11 | `final_qc` | auto `tick` | classifies produced → good / reworkable / scrapped (scrap leaves inventory) |
| 12 | `dispatch_decision` | **decision** `dispatch(rework, now)` | optional finished rework; **ships goods out of inventory**; schedules outbound |
| 13 | `outbound_transport` | time `tick` (≥ `outboundArriveAt`) | evaluates on-time vs the deadline |
| 14 | `delivered` | auto `tick` | settles any net-15 supplier bill now due |
| 15 | `invoiced` | **decision** `send_invoice(now)` | sets `payDueAt` from the **customer** terms |
| 16 | `paid` | time `tick` (≥ `payDueAt`) | computes realised revenue (short/defect/late penalties) and **credits it once** |
| 17 | `closed` | terminal | writes a performance record to history |

`DECISION_STAGES` is the source of truth for which stages block auto-advance;
`tick()` returns `changed:false` on any decision stage, so **no player decision is
ever skipped**.

## Invariants

- **Inventory is the source of truth.** Every material/finished-goods change is a
  real `S.items` movement via an emitted effect; buckets on the contract only
  *describe* those movements. Goods receipt, production and dispatch each make an
  actual movement.
- **Reservations prevent double-use.** Received material and produced goods are
  reserved to the contract (`S.c2cReserved`); `availableItem(id) = itemCount − reserved`
  gates manual selling. Quarantined stock is reserved but **never** consumable by
  production (production draws only from `accepted`).
- **Determinism.** All randomness is `seededUnit(seed, salt)` (mulberry32) with
  fixed per-roll salts; outcomes are stored on first roll, so a reload replays
  identically.
- **Game-time, not wall-clock.** Deadlines/lead/transport/terms compare against a
  persisted, monotonic `S.gameClock` (`gameNow()` in game-minutes), advanced by the
  sim loop — never a `setTimeout`/RAF timer.
- **No double effects.** Every action asserts its expected stage and money/inventory
  steps are guarded by one-shot `did.*` flags; every wallet effect carries a stable
  idempotency key (`c2c:<id>:<tag>`) so the ledger dedupes re-application. Duplicate
  actions and extra ticks are rejected no-ops.
- **Planned vs actual P&L** (`plannedPnl` / `actualPnl`) both report revenue,
  material cost, inbound logistics, production/rework cost, outbound logistics,
  penalties, gross profit and margin %.
- **Safe recovery.** A genuine attempt earns a 40 % goodwill revenue floor; a poor
  order teaches, it never wipes the save.

## Persistence & migration

Serialisable save fields: `S.c2c` (the active contract, or `null`), `S.c2cReserved`
(reservation ledger), `S.c2cHistory` (closed-order performance records), `S.gameClock`.

`migrateContract(raw)` (versioned by `C2C_ENGINE_VERSION`) brings any older/partial
contract up to the current shape — missing buckets, timing markers, flags and
customer terms default safely; an unknown stage is coerced to `customer_request`;
unrecognisable data returns `null` (safely dropped). On load, `main.ts` migrates
`S.c2c`, seeds the ledger/history/clock for pre-engine saves, and **rebuilds
`S.c2cReserved` from the authoritative contract** so a reload can never leave
phantom or missing reservations.

## Tests

- `tests/c2cEngine.test.ts` — 21 domain tests via an in-memory world adapter:
  happy path, late supplier, short delivery, poor-quality receipt, rejected batch,
  production defect, rework, partial shipment, late delivery, customer rejection,
  payment-on-delivery, Net-15, reload-safety at every stage, duplicate-action
  protection, save migration, determinism, planned P&L, reservations.
- `e2e/c2c-engine.spec.ts` — integration through the real main.ts adapter:
  real inventory movements, reservations, mid-pipeline refresh persistence, and
  pay-once (no double payment on extra ticks).

## Presentation layer (now built)

The flagship order is now the **live** engine-driven pipeline — the one-shot
`_resolveFlagship` has been removed; every screen dispatches a real engine action.

- **Stepwise pipeline modal** (`_renderC2C` / `openFlagshipOrder`): one card per
  stage with its decision controls — review quote, compare suppliers, plan +
  place PO (with planned-margin preview and an affordability gate), goods-in QC
  (accept / rework / scrap quarantine), run production, final-QC + optional rework
  + dispatch, send invoice, and a **planned-vs-actual P&L review** on close. Waiting
  stages (supplier, inbound, outbound, payment) show a **live ETA** and a
  **deadline countdown**; they auto-advance via the sim-loop tick while the modal
  polls for changes. Resuming reopens at the exact current stage.
- **Fair game-time**: the clock advances only while an order is in a *waiting*
  stage, so the deadline counts operational time (lead + transit + shipping), never
  the player's thinking time.
- **Performance-history view** (`openC2CHistory`, reachable from the Contracts
  panel): per-order grade / on-time / satisfaction / realised margin, plus a
  supplier-performance tally (on-time record + total margin), backed by
  `S.c2cHistory`.
- **Repeatable**: the order is available whenever the tutorial is done. Finishing
  one (`Done`) clears the active contract so the next open starts a fresh order
  with a new seed (new supplier/quality/logistics outcomes); the completed order
  stays in the history and grows client reputation (which sweetens future payouts).
  `S.flagshipDone` now only records "completed ≥ 1" (stats/tests), never a lock.

## Dev/debug surface (`window.__gate`, DEV-only)

`c2cStart`, `c2cAction`, `c2cTick`, `c2cState`, `c2cReserved`, `c2cAvailable`,
`c2cInv`, `c2cHistory`, `c2cGameNow`, `c2cAdvanceClock`, `c2cForceRolls`,
`c2cFreezeClock`.

## Possible future work

- Generalise the engine to the standard contract board (currently it powers the
  one authored, now-repeatable order).
- Per-order variation (qty/client/deadline) so repeats feel fresh beyond the
  seeded outcome randomness.
- Controller/keyboard focus polish for the stepwise modal.
- Richer history analytics (trend of margin/on-time over many orders).
