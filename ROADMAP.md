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

## Next milestones (build in order, one at a time)
- [x] **M5 — Tools & Fishing** · Tool tiers (wood→stone→iron→gold→diamond) for pick/axe/rod, colour-coded, bought/crafted, speed per tier; Fishing skill at the pier (rod spots, 5 fish types by level); Fishmonger NPC stall buys/sells catch; beach birds scatter when approached, occasionally land afar. Visible: new tools on character, fish in warehouse, fishmonger on beach.
- [x] **M6 — The Big Map & Living Villagers** · Map ~3× (grow east/south in chunks); 15 named NPCs with unique palettes; each has a furnished home (shared basics, individual touches, some multi-occupant); schedule 06:30–18:30 work / evening leisure / night in bed; speech bubbles docked at screen-bottom that minimise when NPC walks away; night wildlife (fox in woods, owls in trees, shark fin offshore). Visible: villagers commuting, homes enterable.
- [x] **M7 — Player House & Furniture** · Own house on the map; furniture placement (bed, TV, sofa, sink, shower, toilet, fridge, table+chairs, rugs); furniture trader stall; hats + extra clothing colours; items craftable in Sawmill/Workshop feed into furniture. Visible: decorated house saved/loaded.
- [x] **M8 — The Rose & Pallet (Pub)** · British pub: bar with pumps, pool table, wooden furniture, red carpet with black dots; NPCs visit after 18:30; landlord with rotating banter. Visible: pub interior, evening crowd.
- [x] **M9 — Title Screen & Character Creator** · Exciting animated intro with floating feature-words; improved mascot; full character customisation BEFORE starting; name required — red "Enter a name" if bypass attempted. Visible: new intro flow.
- [ ] **M10 — Mischief & The Law** · Trespassing indicator (red, bottom-left) inside homes; sneak-steal small fridge items; sleeping NPCs wake if within 2 tiles → "GET OUT OR I'M CALLING THE POLICE!"; 10s to flee else Police arrive → holding cell 24h game-time (48h if carrying stolen goods); Police Station with 3 officers, cell, rotating comedy cellmate. Tone: cartoon/comedic, no violence. Visible: full loop working.
- [ ] **M11 — Nightclub Themed Nights** · Club venue; aesthetic + NPC outfits + dialogue rotate every 7 game days: pop → rock → hip hop → trance → 80s; matching chiptune per theme. Visible: first two themes.
- [ ] **M12 — Active Swing Mode (design-gated)** · Optional click-to-swing on rocks/trees (fewer clicks per resource at higher tool tiers) layered ON TOP of idle mode, not replacing it. Requires design sign-off: protect the idle/offline core loop.

## Parking lot
Weather/seasons · districts rollout (TOWN_DESIGN.md) · Bank/net-worth · living economy · analytics + cloud saves gate · AI Phase B (AI_SYSTEMS.md) · commissioned art pack drop-in (pipeline ready).
