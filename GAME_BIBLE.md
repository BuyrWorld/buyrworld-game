# GAME_BIBLE.md — BuyrWorld Master Reference (v1)
Source of truth. Update only on design change. All other docs defer to this.

## Positioning
- "The first life-sim RPG where you build careers, businesses and industries through realistic supply chains, automation and a living economy."
- Browser-first, mobile-friendly, later wrappable as native app.
- Educational by stealth: economics, procurement, logistics, manufacturing, investing.
- Founder moat: built by a chartered procurement professional (MCIPS) — authenticity no competitor can fake.

## Pillars
1. The town IS the game — every area rewards exploration, progression or discovery.
2. Supply chain is the defining mechanic: raw → process → manufacture → QC → warehouse → distribute → retail → revenue.
3. Something interesting every 20–30 seconds (unlock, event, NPC, discovery).
4. Player success visibly changes the world.
5. Ethical monetisation: cosmetics + convenience only. Never pay-to-win. Child-safe throughout.
6. Modular & data-driven: new careers/districts/products = data, not code rewrites.

## Current shipped state (v0.6 — do not rebuild)
- Single index.html, ~2,000 lines, deployed GitHub→Vercel at buyrworld.com.
- 5 skills 1–99 (Mining, Steelworks, Manufacturing, Logistics, Trading), RS XP curve.
- 36×22 walkable pixel world: quarry, town, market, beach+pier, farm; camera, minimap, directional sprites, work animations, pickup VFX, dust.
- 6 buildings with animated interiors; 3 trader NPCs + Frost + 2 wanderers; tutorial (Frost); 21 achievements; 6 companions; contracts; drifting market; upgrades with in-world visuals (van→lorry→train); tier-based town evolution; 5 original location-based chiptune tracks; offline progress; save/export; title FX.
- 48 headless engine tests (sim*.js) — keep green.

## Content adaptations (child-safe ruling)
- Casino → **Exchange Floor** (stock/commodity risk-play, no gambling framing).
- ~~Nightclub → Arcade & Music Hall~~ → **Nightclub kept** (Club Featherstone, M11). Explicit decision 2026-07-08 to build a literal nightclub with rotating genre nights (pop/rock/hip-hop/trance/80s). Kept tasteful/cartoon and PG — neon, DJ, dance floor, mocktail bar; no alcohol emphasis, no adult content — so it stays within the child-safe pillar.
- Rationale: earlier directive "fun for children"; also broadens audience and avoids app-store/gambling friction. Revisit further only with explicit decision.

## Long-term systems map (target)
- Life sim layer: energy, character needs (light-touch), housing, education (University), fitness (Gym).
- Economy: simulated supply/demand, commodity prices, macro events, booms/recessions, fictional stock exchange.
- Careers: data-driven paths (Buyer, Engineer, Trader, Roboticist…), each with AI mentor.
- Automation endgame: robotics, lights-out factories, automated warehouses.
- Districts (8): Financial; Manufacturing Quarter; Robotics & AI Campus; Logistics Hub; Retail High Street; Residential & Leisure; University & Research Park; Energy & Data Centre.
- Multiplayer phased: AI competitors → profiles/social → real-time trade/co-op.

## Hard-to-copy moats (build in this order of leverage)
1. Living economy + procedural contracts (extends existing systems).
2. AI mentors / NPC memory / news network (see AI_SYSTEMS.md).
3. District breadth on a data-driven registry.
4. Brand: recognisable art direction + "real procurement pro" story.

## Acquisition-readiness criteria
- Retention metrics (D1/D7/D30) instrumented from Milestone 12+.
- Clean modular codebase (ARCHITECTURE.md), documented data schemas.
- Content pipeline where non-coders could add products/quests (JSON).
- Recognisable brand from a single screenshot.

## Development rules (binding)
- One polished milestone at a time; game playable after every milestone.
- Every prompt/milestone ends with a **visible change in index.html** (the "noticeable achievement" rule).
- Modify only necessary files; never rewrite working systems; keep sims green; explain changes.
- No AI features until Phase gates in AI_SYSTEMS.md are met.
