# Boot Presentation — Intro, Press Any Button & Title Menu

BuyrWorld boots through a deliberate console-style flow instead of opening straight into
character creation.

## Flow
```
boot → intro (full | short | reduced) → pressAny → titleMenu
     → Continue           → loading → playing
     → New Game → creator → loading → playing
     → Quick Start → creator → playing
```
The gameplay HUD + world stay hidden the whole time (`body.pre-game`); they are revealed
only when a game starts or continues (`_presEnterPlaying`).

## Files
- `src/data/intro.ts` — PURE, deterministic timeline (stages, durations, `stageAt`,
  `qcApproved`, `skipTo`, input guard). Unit-tested in `tests/intro.test.ts`.
- `index.html` — the `#presentation` overlay (`#intro-canvas`, `#press-any`, `#title-menu`),
  CSS (tokens, safe-areas, reduced-motion, couch), and the `window.__bwPWA` install bridge.
- `src/main.ts` — the presentation state machine (`_presState`), the programmatic pixel-art
  intro renderer (`_drawIntroFrame`), the Press-Any-Button + ambient scene, the title menu
  (`_showTitleMenu`), skip/input handling, audio hooks, `introSeen` persistence, and the
  `?pres=` dev switch. Entry point: `startPresentation()` (called once at boot).

## Intro variants
- **full** (≈7.9s, first launch): order printer → materials on the conveyor → furnace/
  processing → letter assembly → QC (one letter backwards, Frosty ❄️ fixes it, scan greens)
  → forklift + DELIVERED stamp + tagline. Drawn programmatically on a virtual 480×270 stage,
  letterboxed inside the navy backdrop (no stretch, no white strips).
- **short** (≈2.3s, returning launches): finished logo slides in → QC greens → stamp.
- **reduced** (≈1.2s, reduced-motion): static assembled logo with a gentle fade — no
  parallax/sparks/typewriter.

Variant is chosen automatically: reduced-motion → `reduced`; else first launch → `full`,
later launches → `short` (tracked by `S.settings.introSeen`, set when a game is entered).

## Skipping & input
The intro is skippable by keyboard (any key), pointer/touch (pointerdown on the layer) and
any controller **button** (polled; axes ignored, so drift never skips). Input is ignored for
the first `INPUT_GUARD_MS` (~400 ms). The skip key is captured (`preventDefault` +
`stopPropagation`) so it can never also select a title-menu item. All RAFs, intervals and
listeners are cancelled on skip/finish; a hidden tab pauses the animation (no drift/corruption).
Any draw error finishes the intro gracefully (static-logo fallback).

## Title menu
`Continue` (always listed; disabled without a save; shows a founder/coins/chapter summary),
`New Game` (confirms before overwriting an existing save), `Quick Start`, `Settings`,
`About & Credits` (with **Replay Intro**), `Install` (only when a real `beforeinstallprompt`
is available — never a dead button), `Quit` (only in a packaged desktop app with a quit
handler — never in the browser). Controller/keyboard focus starts on the primary action.

## Audio & autoplay
No audio is forced before a user gesture — the intro runs silently under autoplay
restrictions with no console error. `_presSfx` only plays once audio is unlocked and SFX are
enabled. Title/zone music starts through the existing music system after the Press-Any-Button
gesture. Frosty/chiptune soundtrack selection and Low-by-default volume are untouched.

## Save & settings compatibility
Only `S.settings.introSeen` is added (migrated to `false` for existing saves → they see the
full intro once). No game progression lives in presentation state. Replaying the intro never
mutates the save or starts a new game. Existing saves load normally and are never sent through
character creation.

## Dev / test switch
- `?pres=off` — skip the presentation, open straight into the creator (used by every existing
  e2e spec and the global-setup warm-up).
- `?pres=full` / `?pres=short` / `?pres=reduced` — force a variant.
- Replay from About → “Replay Intro”, or `window.replayIntro()`.

## Tests
- `tests/intro.test.ts` — timeline (variant beats, deterministic completion, QC greening,
  input guard).
- `e2e/boot-presentation.spec.ts` — fresh→full+HUD-hidden, reduced/short variants, intro→press
  →menu, Continue-disabled-without-save + summary, no Quit / no dead Install, New-Game→creator
  (HUD hidden), Quick Start still works, returning short intro + Continue, skip-consumption,
  Replay-Intro-doesn't-create-a-game.
