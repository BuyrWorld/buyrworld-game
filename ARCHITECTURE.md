# ARCHITECTURE.md — BuyrWorld Technical Structure (v1)

## Stack (target)
- **Client:** Vite + TypeScript, vanilla modules (no framework — canvas game, DOM UI). Deployed static on Vercel.
- **Persistence:** localStorage (primary) + export strings; Supabase cloud saves at M12+.
- **Server:** Vercel serverless `/api/*` only where required (AI features, later shared economy). Nothing server-side before then.
- **Audio:** Web Audio chiptune engine (exists) behind an AudioManager.
- **Tests:** headless Node sims (exist, 48 tests) → migrate to Vitest during M2.

## Migration path (from single index.html)
- M2 splits the working file into modules **without behaviour change**; sims must pass before/after.
- Never a big-bang rewrite. index.html remains the deployable artifact (Vite builds it).

## Module map
```
/src
  engine/     tick.ts (pure), xp.ts, save.ts (versioned migrations), rng.ts, events.ts (pub/sub bus)
  data/       items.json, actions.json, buildings.json, districts.json, npcs.json,
              quests.json, achievements.json, tracks.json, dialogue.json
  world/      map.ts, camera.ts, collision.ts, actors.ts, interact.ts, weather.ts, daynight.ts
  render/     tiles.ts, sprites.ts, interiors.ts, fx.ts, minimap.ts, titlefx.ts
  systems/    contracts.ts, market.ts, companions.ts, upgrades.ts, tutorial.ts,
              achievements.ts, economy.ts (M13+), questlog.ts
  ui/         panels.ts, hud.ts, toast.ts, log.ts
  audio/      music.ts, ambience.ts, sfx.ts
  ai/         mentor.ts, memory.ts, news.ts, questgen.ts (Phase-gated; see AI_SYSTEMS.md)
/api          mentor.ts, news.ts (serverless, Phase B only)
/tests        engine + system sims
```

## Core patterns (non-negotiable)
- **Pure tick:** `newState = tick(state, dt)` — offline progress, tests and determinism depend on it.
- **Data-driven registries:** adding a product, building, NPC, district, quest or track = editing JSON. Code reads registries; never hardcode content in logic.
- **Event bus:** systems publish (`action:complete`, `level:up`, `contract:delivered`, `time:hour`); UI/audio/achievements/quests subscribe. Kills cross-system spaghetti.
- **Save versioning:** integer `v` + ordered migration functions. Never break an existing save.
- **Render layers:** ground → objects → extras → actors → fx → weather → UI overlays. Camera transform wraps world layers only.
- **Game clock:** one in-game time source (day/night, routines, ambience, events) derived from real time + offset; serialised in save.

## Performance budgets
- First load < 1.5s on 4G; bundle < 300KB gz (no heavy libs).
- 60fps target, 30fps floor on mid phones; cull draws to camera viewport (exists).
- Audio nodes pooled; max ~24 concurrent.

## Content pipeline
- JSON schemas documented at top of each data file.
- Validation script (`npm run check:data`) run in CI before deploy — invalid content can't ship.

## Analytics (M12)
- Plausible custom events: session_start, tutorial_complete, milestone_reached, d1/d7 via cohort queries.

## Security/safety
- No third-party calls from client except own /api. AI outputs schema-validated + profanity/child-safety filtered server-side. Cost caps per endpoint.
