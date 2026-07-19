# Club Featherstone — Nightclub

A wide 16:9 industrial-warehouse nightclub, rebuilt to translate
`references/nightclub/nightclub-final-reference.png` into BuyrWorld's canvas engine.

## Rendering
- Canvas interior at **480×270** (`ROOM_DIMS.nightclub` in `src/data/interiorCollision.ts`),
  ~2× the standard 320×200 interior. The size is shared by art, collision and clicks via
  `INT_SIZES = ROOM_DIMS`, so everything scales together. The canvas is `width:100%` with
  `aspect-ratio`, so no white side strips at any resolution.
- `drawNightclub(ctx, t, W, H)` in `src/main.ts` draws the whole scene in depth order:
  floor → trusses/moving-heads → spotlight beams → DJ stage (theme screen, Frosty DJ,
  CDJs, LED columns, speakers) → STAY FROSTY neon → VIP → bar → lounge booths → dance
  floor → crowd → entrance framing → haze → theme pill → entry reveal.
- `drawClubScreen()` renders the DJ back-screen per theme (`globe_barcode`, `conveyor`,
  `qc_scan`, `arcade`, `freight`) with always-legible branding text.

## Zones
Entrance (BUYRWORLD mat, two bouncers, BW crates, planter + conveyor chevrons) · Dance
floor (centre) · DJ stage (elevated, Frosty snowman DJ) · Bar (left) · Lounge booths
(right) · VIP (top-right, gated with a locked-stairs teaser). Collision
(`PUBLIC_COLS.nightclub`) keeps the exit lane and every approach clear; guarded by
`tests/publicInteriors.test.ts`.

## Lighting (audio-independent)
`_clubBeat(t)` is a deterministic 124-BPM envelope — the venue is always alive even when
audio is muted/suspended. `_clubCalm()` (reduced-motion **or** the "Reduced lighting
effects" setting) drops strobes/sweeps to slow, safe washes. No unsafe rapid flashing.

## Crowd
`_clubCrowdList(theme)` — a deterministic, pooled crowd (seeded PRNG) sized by density
tier (`S.settings.crowd`: low 14 / standard 26 / high 40). Dancers live only on the dance
floor (never on essential paths), bob with the beat (static under reduced-motion), and are
purely decorative (no per-NPC state/timers, invalidated only on theme/density change).

## Themed nights (`src/data/clubThemes.ts`)
Data-driven `ClubTheme` with palette, lighting pattern, DJ screen visual, branding, crowd
energy, eligible Frosty tracks, outfit tags, reputation gate and event-effect hooks. Five
Frosty-branded nights rotate deterministically every 7 game days from a fixed epoch:
**Frosty Fridays · Neon Supply · Quality Control · Chiptune Throwback · Freight Night.**
`FALLBACK_THEME` + `clubThemeById` keep it safe. `NightclubVenueMode` is architected for
future variants but only the standard venue is exposed (no adult content).

## Audio
- Frosty mode plays the `nightclub` scenario tracks; chiptune mode plays the `club_*`
  chiptune keys (a deliberate, valid alternative — not a failure). Neither depends on the
  themed night.
- Volume steps (`VOLUME_GAINS`): Off 0 · Low 0.22 · Med 0.55 · Loud 0.90, default **Low**.
- Entry never depends on audio loading; a failed MP3 falls back to chiptune.

## Interactions (panel-driven, controller-focusable)
Dance (short, non-locking buff) · Bartender (themed drink → action buff) · Frosty DJ
(tonight's set) · Bouncer (rules + VIP teaser) · Roxy the promoter (supplier/contract lead
hook) · crowd-density + reduced-lighting controls.

## Entry reveal
`_clubStartReveal()` on entry shows a skippable themed-night card (`_clubRevealActive()`,
~2.2s, tap/key to skip), fading in and out over the scene.

## Known limitations / next
- Music swap on entry/exit is an instant hard-cut (FILEMUSIC), not a crossfade — a smooth
  fade is a follow-up in the global audio layer.
- Interaction is panel-driven (reliable + controller-safe); canvas-click hotspots on the
  DJ/bar/bouncer are a possible enhancement.
- VIP, ownership, staff, booking and supplier/contract leads are teased via hooks, not yet
  a management sim.
- Visual polish vs the reference and the full multi-resolution / controller / couch QA
  matrix need human playtest passes.
