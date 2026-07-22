# ROADMAP.md — BuyrWorld Milestones (v2, updated 05 Jul 2026)

## Rules (unchanged, binding)
- One milestone per prompt/session. Game fully playable after each.
- Every milestone MUST end with a visible change (screenshot-able).
- Claude Code: before coding, give a 5-bullet plan and WAIT for approval. Build ONLY the named milestone, then stop.
- Keep npm test, npm run check:data and npm run dev green.

## Completed
- [x] **M1 — Identity Pack** · logo + "My name is" badge
- [x] **M2 — Modular Migration** · Vite+TS src/ structure
- [x] **M3 — Data-Driven Content** · JSON registries, Quinn, new products
- [x] **M4–M4.6 — Zones, day/night, customisation, asset pipeline** · enterable buildings, transitions
- [x] **VF1–VF3 — Visual fix rounds (Claude chat, surgical)** · cosy Harvest-Moon interiors (all 8 rooms furnished + collision), compact 320×200 rooms, two-column room+panel layout, slim market stalls with goods + vendors that bob/turn, fountain/benches/planters/picket fence, height-normalised building sprites, lamp redesign (day-off/night-glow), 09:15 session start + capped night darkness, clock HUD, room name plates, action SFX (tink/clang/tick/thock), per-room music with slower 88bpm village theme, crisp HTML labels, no head halo, no floating name tag, "I can't swim… yet", forklift/racking/livery Depot, podium+10-chair Town Hall, pet-furnished Barn, log-pile Sawmill with goods shelf, 3× character preview
- [x] **Character-creator wizard** · title screen guided one-step-at-a-time flow (gender → face close-ups → whole-body clothing → name); zoomed face preview; real walk-cycle animation (arms + legs)
- [x] **HX2 — Asset-Led House Interior Overhaul** · data-driven per-home interiors (`data/homeInteriors.ts`), 17 households each with a distinct palette + personality props, hybrid render (verified Roguelike Interior tiles + canvas props); collision-safe zones; see HOUSE_INTERIOR_ASSET_GUIDE.md
- [x] **HX3 — Normal Home Layout Pass** · parametric `buildLayout` zone engine — every home reads as a real floorplan (entrance / kitchen-dining / living / sleeping / storage / personality) with zone floor patches + a bedroom divider; per-home collision generated from the same data (retired the stale shared home collision); BFS reachability test guards circulation; see HOUSE_INTERIOR_LAYOUT_GUIDE.md
- [x] **Living Economy (LE1–LE4)** · supply/demand + mean-reverting drift, macro business cycle + news network, supply-chain cost-push propagation, net-worth dashboard — all in a pure tested `data/economy.ts`. See LIVING_ECONOMY_DESIGN.md
- [x] **Districts v1** · data-driven district registry (`data/districts.ts`) grouping existing buildings into live + planned districts; Town Directory modal (🗺️ HUD button + map sign) with status/buildings and fast-travel; on-map "you're in" chip + hub banners; Harbour gated at total lvl 100
- [x] **Robotics & Automation Campus** · new district (east high street), gated at total lvl 150; the Automation Lab lets you build helper **automatons** (`data/automatons.ts`) from crafted parts and assign one per skill for a passive, idle-safe speed / bonus-yield boost (wired like pets, capped). Mechanical bots only — the AI-mentor features stay behind the AI_SYSTEMS gate.
- [x] **Energy & Data Centre** · final GAME_BIBLE district, gated at total lvl 200; the Data Centre's **Power Grid** (`data/grid.ts`) upgrades in 4 tiers (coins + advanced parts) for a town-wide, idle-safe action-speed boost (−4%→−16%). All 8 bible districts + Harbour now built/gated on the data-driven registry.
- [x] **HX4 — Public interior consistency pass** · wall-depth shell (skirting/corner posts) moved into shared `room()` so all cosy interiors match the homes; matching counter/bar collision for the 7 core public rooms (pub, café, bank, furniture shop, retail, post office, estate agent) via `data/interiorCollision.ts`; BFS walkability/exit guard test

## Next milestones (build in order, one at a time)
- [x] **M5 — Tools & Fishing** · Tool tiers (wood→stone→iron→gold→diamond) for pick/axe/rod, colour-coded, bought/crafted, speed per tier; Fishing skill at the pier (rod spots, 5 fish types by level); Fishmonger NPC stall buys/sells catch; beach birds scatter when approached, occasionally land afar. Visible: new tools on character, fish in warehouse, fishmonger on beach.
- [x] **M6 — The Big Map & Living Villagers** · Map ~3× (grow east/south in chunks); 15 named NPCs with unique palettes; each has a furnished home (shared basics, individual touches, some multi-occupant); schedule 06:30–18:30 work / evening leisure / night in bed; speech bubbles docked at screen-bottom that minimise when NPC walks away; night wildlife (fox in woods, owls in trees, shark fin offshore). Visible: villagers commuting, homes enterable.
- [x] **M7 — Player House & Furniture** · Own house on the map; furniture placement (bed, TV, sofa, sink, shower, toilet, fridge, table+chairs, rugs); furniture trader stall; hats + extra clothing colours; items craftable in Sawmill/Workshop feed into furniture. Visible: decorated house saved/loaded.
- [x] **M8 — The Rose & Pallet (Pub)** · British pub: bar with pumps, pool table, wooden furniture, red carpet with black dots; NPCs visit after 18:30; landlord with rotating banter. Visible: pub interior, evening crowd.
- [x] **M9 — Title Screen & Character Creator** · Exciting animated intro with floating feature-words; improved mascot; full character customisation BEFORE starting; name required — red "Enter a name" if bypass attempted. Visible: new intro flow.
- [x] **M10 — Mischief & The Law** · Trespassing indicator (red, bottom-left) inside homes; sneak-steal small fridge items; sleeping NPCs wake if within 2 tiles → "GET OUT OR I'M CALLING THE POLICE!"; 10s to flee else Police arrive → holding cell 24h game-time (48h if carrying stolen goods); Police Station with 3 officers, cell, rotating comedy cellmate. Tone: cartoon/comedic, no violence. Visible: full loop working.
- [x] **M11 — Nightclub Themed Nights** · Club venue; aesthetic + NPC outfits + dialogue rotate every 7 game days: pop → rock → hip hop → trance → 80s; matching chiptune per theme. Visible: first two themes.
- [x] **Villager Conversations + board legibility** · when two villagers meet they now trade lines back and forth (openers by name → replies → small talk) in alternating speech bubbles — `convoLine()` in `data/dialogue.ts`, mutual-nearest pairing + deterministic turn timing in main.ts, capped for legibility with ambient solo chatter for everyone else. Also a legibility pass: new `fitText()` shrinks board/sign captions to sit within their panel (fixed the overflowing seasonal "SUMMER FETE" billboard, the retail stall specials board, HIGH STREET sign, boat-hire/furniture/pub signs and the Wanted poster) for couch/Xbox reading.
- [x] **Dialogue System v2** · situational, legible NPC speech (`data/dialogue.ts`, pure/tested). Villagers now mix their personal quips with lines that fit the moment (time of day / weather / season), and **speak in crisp floating speech bubbles** over their heads — legible both outdoors (nearest few, ambient/staggered) and indoors (public rooms + home occupant), with a couch/fullscreen size bump. `speechLine()`/`isSpeaking()` drive a continuous, staggered town chatter; the bottom dock (chat/gift) and interior tap-chat use the same situational lines. Guarded by `tests/dialogue.test.ts`.
- [x] **M14 — The Village Kitchen (Cooking)** · a data-driven cooking system (`data/cooking.ts`, 8 progressive recipes) that turns what you grow/catch/forage into 8 premium meal items (`items.json`). Cook at the Café **and** your home cottage; **Eat** a meal for a timed buff (speed / XP / sell, one active at a time via `mealBuffMult` wired into `speedMult`/`grantXp`/`sellPrice`) or **Serve** it for a premium. Recipes unlock by total level; sizzle SFX; achievements (Home Cook, Village Chef, Full Menu). Guarded by `tests/cooking.test.ts`. Closes the gather→cook→reward loop so exploring the valley pays off.
- [x] **M13 — The Founder's Journey** · an ordered, narrative quest chain (`data/journey.ts`) spanning the whole game — 11 milestones from "A New Beginning" to "Legend of Featherstone", each with a coin reward and an earned **Title** shown on the HUD "My name is…" badge. 🧭 HUD button (J key / gamepad X) opens the track (✓ done / current-with-progress-bar / locked + Claim); the button pulses when a milestone is ready. Auto-detected from live state; guarded by `tests/journey.test.ts`.
- [x] **M12 — Active Swing Mode (design-gated)** · Optional click-to-swing on rocks/trees (fewer clicks per resource at higher tool tiers) layered ON TOP of idle mode. Approved additive-only design: swings add progress to the current gathering action, route through completeAction (no bonus yield), never touch tick()/applyOffline (idle & offline moat intact), and are cooldown-capped vs autoclickers. Click an active tree/rock in the village, or the 🪓 SWING button in the quarry/sawmill/forager panels. Logic in `data/swing.ts`, guarded by `tests/swing.test.ts`.

## NEXT VALUE-BUILDING MILESTONES
Added after a code-verified implementation audit (see NEXT_SAFE_CLAUDE_PROMPT.md).
These are the depth/value milestones that turn BuyrWorld from "a cosy sim with many
features" into "a unique supply-chain life-sim with a defensible moat". The living
economy is already moat-grade and tested; the supply-chain *middle* (procure → QC →
warehouse → logistics) and the commercial layer (companies, careers, analytics) are
the real gaps. Build in order, one at a time, additive-only. **None is complete until
it is genuinely in code AND fun in gameplay — not when the checkbox is ticked.**

- [ ] **M16 — Contracts 2.0** *(recommended next)*
  - **Why:** completes the game's #1 named moat ("living economy + procedural contracts") — the economy half is done, contracts are the shallow half.
  - **Exists:** `genContract` → `{client,item,qty,coins,xp}` + 25-coin reroll.
  - **Missing:** deadlines, per-client reputation, contract tiers (standard/rush/bulk), economy-linked pay, expiry penalty.
  - **Scope:** pure `rollContract()` in `contracts.ts`; deadline countdown; `S.contractRep` map; tier selection; coin value scaled by live macro demand/drift; richer Contracts tab.
  - **Files:** `src/data/contracts.ts`, contract fns + Contracts-tab renderer in `src/main.ts`, `freshState()`/`load()` migration, new `tests/contracts.test.ts`.
  - **Acceptance:** live countdown + expiry; visible client rep rising/falling; tiered offers; pay moves with the economy; old saves load clean and still deliver; pure fns unit-tested; test/check/build green.
  - **Don't touch:** `tick()`/`applyOffline()`, economy internals, exported symbols other systems use.
  - **Risk:** Low-Med. **Visible:** countdown timers + client-rep badges in the Contracts tab.
- [ ] **M15 — First 30-Minute Fun Pass**
  - **Why:** retention — huge content exists but the opening under-showcases it.
  - **Exists:** heartbeat scheduler + daily challenge. **Missing:** curated escalating first-session arc; heartbeat needs agency, not just flavour.
  - **Scope:** sequence early unlocks/rewards; reward heartbeat beats. **Files:** `main.ts` (heartbeat/journey), `journey.ts`.
  - **Acceptance:** a fresh save hits ≥6 distinct "wow" beats in 30 min. **Don't touch:** save/tick. **Risk:** Med. **Visible:** paced unlock cadence.
- [ ] **M13 — First Impression, Frost Pathing & Map Polish**
  - **Why:** screenshot-recognisability + first 10 seconds. **Exists:** Frost, title FX. **Missing:** guided first-path, landmark framing.
  - **Scope:** Frost walks you to the first action; camera intro. **Files:** `main.ts` (intro/Frost). **Acceptance:** new player reaches first gather in <30s guided. **Don't touch:** save/tick. **Risk:** Low. **Visible:** cinematic open.
- [ ] **M14 — Steam/Xbox Usability Foundation**
  - **Why:** platform reach. **Exists:** electron + electron-builder scripts + gamepad hooks. **Missing:** full controller nav of every panel, safe-area, pause.
  - **Scope:** audit focus/D-pad nav across all panels. **Files:** `main.ts` input. **Acceptance:** whole game playable on gamepad. **Don't touch:** unrelated systems. **Risk:** Med. **Visible:** on-screen button prompts.
- [ ] **M17 — Procurement & Supplier System**
  - **Why:** the unfakeable "real buyer (MCIPS)" moat — currently absent. **Exists:** instant buy from trader stalls. **Missing:** suppliers with reliability, lead time, MOQ; sourcing choices.
  - **Scope:** `data/suppliers.ts` + purchase-order flow feeding existing crafting inputs. **Files:** new `data/suppliers.ts`, `main.ts` trade tab, migration, test. **Acceptance:** supplier choice changes cost/speed/risk. **Don't touch:** economy internals. **Risk:** Med. **Visible:** supplier picker + PO tracker.
- [ ] **M18 — Quality Control**
  - **Why:** named bible supply-chain stage, currently only an XP-perk name. **Missing:** inspection/defect/reject loop.
  - **Scope:** `data/qc.ts` — post-manufacture inspection roll/minigame; defects → rework/scrap; quality tiers affect sale price + contract acceptance. **Files:** new `data/qc.ts`, `main.ts` manufacturing, migration, test. **Acceptance:** quality visibly affects revenue. **Risk:** Med. **Visible:** QC lab + grade stamps.
- [ ] **M19 — Warehouse Management**
  - **Why:** makes storage a decision (today `S.items` is uncapped). **Scope:** capacity tiers, category slotting, upgrade sink. **Files:** new `data/warehouse.ts`, migration (careful — touches inventory), test. **Acceptance:** capacity constrains + rewards planning; old saves migrate safely. **Risk:** Med. **Visible:** fill gauge + racks.
- [ ] **M20 — Logistics Decisions**
  - **Why:** routing trade-offs. **Scope:** delivery method (speed vs cost vs risk) on contracts, tie to `fleet.ts`. **Files:** `contracts.ts`, `main.ts`. **Acceptance:** method changes payout/time. **Risk:** Med. **Visible:** route picker.
- [x] **M21 — Business Licence & Company Ownership** · `data/company.ts` — buy a licence to own one of 4 businesses (Corner Shop → Haulage Firm), hire/lay off staff up to slots, and run it for a real, visible **P&L** (revenue − wages − upkeep) that banks to the wallet over time via the wallet service (idle/offline-safe, timestamp accrual, ±10% daily market conditions). Dashboard in the Town Hall "🏢 Business Registry"; achievements Entrepreneur/Conglomerate; guarded by `tests/company.test.ts`. *(Note: M17 Procurement, M18 QC and M19 Warehouse were found already implemented — roadmap checkboxes above were stale.)*
  - **Why:** delivers the "build businesses/industries" promise. **Scope:** buy a licence → own a shop/factory with P&L, hire passive NPC staff. **Files:** new `data/company.ts`, migration, test. **Acceptance:** a company produces a visible P&L. **Risk:** High. **Visible:** company dashboard.
- [ ] **M22 — Career Paths**
  - **Why:** structure + seat for AI mentors later. **Scope:** data-driven paths (Buyer/Engineer/Trader/Roboticist) over existing skills, perks per rank. **Files:** new `data/careers.ts`, migration, test. **Risk:** Med. **Visible:** career track UI.
- [x] **M23 — Daily Newspaper / Business News Network** · `data/news.ts` — **The Featherstone Chronicle**, a broadsheet compiled once per game-day from the LIVING economy (macro-cycle climate lead, Movers & Shakers from item price-pressure, Market Watch from the econ news feed, Around the Valley from season/festival) **plus the player's own headlines** (big contract landed, business licence bought, Journey milestone) captured via `pushHeadline`. 📰 HUD button with an unread-dot; economy read-only; edition cached per `_gameDay()`; guarded by `tests/news.test.ts`.
  - **Why:** surfaces the living economy + seeds moat #2. **Scope:** newspaper compiling macro news + player events (reuse `economy.ts` strings). **Files:** new `data/news.ts`, `main.ts`. **Risk:** Low. **Visible:** readable daily paper.
- [ ] **M24 — Town Evolution**
  - **Why:** "player success visibly changes the world." **Scope:** net-worth/renown thresholds that add buildings/props systemically. **Files:** `districts.ts`, `main.ts`. **Risk:** Med. **Visible:** town visibly grows with you.
- [ ] **M25 — Analytics & Retention Tracking**
  - **Why:** acquisition-readiness; currently building retention blind. **Scope:** local session/day tracking → D1/D7/D30 + funnel counters (privacy-safe, no PII). **Files:** new `data/analytics.ts`. **Risk:** Low. **Visible:** dev stats panel.

### Depth passes to reopen (foundation complete, not deep)
- **M13 Founder's Journey** — titles don't yet gate or change systems (tie into M22 careers).
- **Districts v1** — several districts gate shallow loops; give each an exclusive loop per TOWN_DESIGN.
- **Robotics & Automation** — passive boost only; bible endgame is automated *production lines*.
- **Energy & Data Centre** — passive boost only; no real grid/energy management.

## Parking lot
Weather/seasons · districts rollout (TOWN_DESIGN.md) · Bank/net-worth · living economy · analytics + cloud saves gate · AI Phase B (AI_SYSTEMS.md) · commissioned art pack drop-in (pipeline ready).
