# Nightclub Asset Manifest

Honest inventory of what Club Featherstone renders from, and what proper separated art is
still missing. **The reference render (`references/nightclub/nightclub-final-reference.png`)
is a development reference only** — it is not imported, bundled, converted, or drawn at
runtime (guarded by `tests/nightclubAssets.test.ts`).

## How the scene is assembled today
The nightclub is a **canvas-drawn, separated-entity 2.5D scene** (`drawNightclub` in
`src/main.ts`) in the game's established interior art style — the same hand-drawn canvas
approach every other BuyrWorld interior uses. Nothing is baked into a photo; every
gameplay entity is drawn independently and can move/react/change state.

| Layer | Source | Status |
|---|---|---|
| Architecture (walls, trusses, floor) | canvas primitives | placeholder-grade (game style) |
| DJ stage / screen / speakers / LED columns | canvas primitives + `drawClubScreen` (theme-driven) | functional, stylised |
| Bar + back-bar + stools | canvas primitives | functional, stylised |
| Lounge booths / VIP mezzanine / railing | canvas primitives | functional, stylised |
| Foreground crates / planters / conveyor | canvas primitives | functional, stylised |
| Dynamic lighting (beat washes, spotlights, haze) | canvas, deterministic beat | functional |
| **Frosty (DJ)** | `drawPerson` — human (white, ~34, short black hair, stubble) | canonical, no snowman |
| Player, bartender, bouncer, Roxy, VIP guests | `drawPerson` (the game's ~24px character renderer) | functional, consistent with the game |
| Decorative dancer crowd | pooled `drawPerson` (deterministic) | functional |
| Contextual prompts | HTML overlay | functional |

## Existing reusable assets (public/assets/)
`characters/` (mini-* people PNGs), `buildings/`, `nature/`, `factory/`, `interior/`
(`roguelikeIndoor` tilesheet), `UI/`. The character PNGs and the indoor tilesheet could
back a higher-fidelity pass but are not yet wired into the nightclub.

## Missing final art (be honest — these do NOT exist as separated assets)
To reach the reference's fidelity, the following separated, clean-edged assets are needed
and are **not present**:

- Empty warehouse-club architecture plate (no people)
- Separate stage platform, DJ booth, speaker towers
- Long bar + back-bar shelving art
- Lounge booth set + VIP balcony art
- Entrance/security gate art, foreground crate/railing/plant props
- Photo-booth prop
- Lighting overlay textures + haze overlay
- **Human Frosty sprite sheet** (idle / DJ-mixing / talking / celebrating / concerned / walking) + dialogue portrait
- Bartender / bouncer / Roxy sprite sheets
- Dancer sprite variants at scene scale
- Player-scale contact shadows

Until those exist, the current canvas primitives + `drawPerson` sprites are **placeholder-
grade** — consistent with the rest of the game, but not "premium" separated artwork. They
are deliberately not presented as final.

## What a real art pass needs
Commission/produce the separated layers above at a consistent master resolution and
perspective, then swap them in layer-by-layer behind the existing navigation, collision,
interaction and event systems (which are already entity-driven and do not depend on any
baked image).
