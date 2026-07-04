# ROADMAP.md — BuyrWorld Milestones (v1)

## Rules
- One milestone per prompt/session. Game fully playable after each.
- Every milestone MUST end with a **visible change in index.html** (screenshot-able).
- Keep all sims/tests green; add tests for new systems.
- Tick the checkbox + bump the version string when done.

## Milestone format
`M# — Name · visible outcome · touches`

## First 10 milestones
- [x] **M1 — Identity Pack** · Redesigned "really cool" animated logo (gradient shine, orbiting freight arrow, parallax on title); "HI, MY NAME IS ___" name-badge moment: after entering a name, badge sticker animates onto the character and shows on the HUD + hover card. Version → v0.7. · index.html only
- [x] **M2 — Modular Migration** · Split into Vite+TS modules per ARCHITECTURE.md with zero behaviour change; sims ported to Vitest and green; new pixel loading screen proves the swap. v0.8. · new /src, index.html
- [ ] **M3 — Data-Driven Content** · items/actions/buildings/npcs moved to JSON registries; prove it by adding 2 products (Sensor, Pallet Jack) + 1 trader via data only. `npm run check:data` validator. v0.9. · /src/data
- [ ] **M4 — Day/Night & Streetlights** · Game clock, sky tint curve, streetlamp glow at night, NPCs head home in the evening (first routine band). v0.10. · world/daynight, actors
- [ ] **M5 — Interactive Scenery** · Benches (rest buff), mailbox (daily reward), fruit trees (harvest), vending machine; each with cooldown + sparkle affordance. First hidden secret (alley behind Market). v0.11. · world/interact, data
- [ ] **M6 — Engagement Heartbeat** · 20–30s event scheduler (NPC lines, price alerts, companion sightings, discovery sparkles) weighted by novelty; visible event ticker. v0.12. · systems/events
- [ ] **M7 — River & Plaza Reshape** · De-grid the map: river with 2 bridges, central plaza fountain upgrade, organic paths, one landmark silhouette. v0.13. · world/map data chunks
- [ ] **M8 — Retail High Street (District 2)** · First annexed district plot: unique palette, Coffee Shop (energy + micro-quests) and Retail Centre (first cosmetics: character shirt colours, badge styles). District ambience layer. v0.14. · districts.json, audio/ambience
- [ ] **M9 — Quest Framework** · Data-driven quest system (fetch/craft/deliver/talk), quest log UI, 5 hand-written quests incl. Poppy & Sam chains; template grammar ready for AI Phase B. v0.15. · systems/questlog, data/quests
- [ ] **M10 — Bank & Net Worth (Financial seed)** · Bank building: savings interest, first loan, net-worth screen combining coins+stock+assets; news ticker stub (Phase A events shift market). v0.16. · systems/economy seed

## Parking lot (M11+ candidates, do not start)
Weather/seasons · Logistics Hub district · University courses · Housing/Estate Agent · Living-economy sim v1 · Exchange Floor · Analytics + Supabase cloud saves (M12 gate) · AI Phase B · Automation/robotics endgame · Multiplayer phase 1 (AI competitors).
