# Starter-Skill Differentiation — Manual Enjoyment QA Checklist

Each starter skill now has ONE distinct, optional "approach" (plus fishing's bite-and-reel).
Cosy automation is preserved: leave everything on the balanced default and the game plays
exactly as before. Work through this checklist on mouse, keyboard and controller.

## General (every starter skill)
- [ ] The 🎚️ approach chooser appears above the actions, with this skill's own flavour
      label ("Pick your seam", "Chopping style", "Casting style", "Furnace profile",
      "Batch tolerance").
- [ ] Each approach button shows its **consequence** (e.g. "30% faster · no rare") *before*
      you commit — nothing is a surprise.
- [ ] The chosen approach is highlighted (amber) and persists across a reload.
- [ ] Controller/keyboard: the focus ring reaches every approach button; Ⓐ/Enter selects.
- [ ] Reduced-motion on: nothing animates; the chooser still reads clearly.
- [ ] Assisted mode: a hint says the balanced default is fine; the game is fully playable
      without ever touching the chooser.
- [ ] You can tell which skill you're in from the interaction alone (seam vs chop vs cast
      vs furnace vs tolerance) without reading the heading.

## Mining — seam selection + tool wear
- [ ] **Steady** = balanced, small gem chance. **Surface** = ~15% faster, no gems, gentle on
      the pick. **Deep Seam** = slower, **+1 ore**, better gem chance, harder on tools.
- [ ] Deep-seam runs occasionally drop a 💎 ("Rare find — Diamond").
- [ ] At least two of the three feel worth using depending on your goal (speed vs ore vs gems).

## Woodcutting — safe / fast / careful
- [ ] **Safe** = steady + a modest rare-wood chance. **Fast** = ~30% quicker, no rare wood.
      **Careful** = slower, **+1 log**, best rare-wood chance.
- [ ] Careful felling occasionally yields ✨ rare wood.

## Fishing — bite-and-reel (+ casting style)
- [ ] Casting style: **Steady / Quick (faster, common) / Patient (slower, prize species)**.
- [ ] While a cast is running a **🎣 REEL** button is available. Pressing it *before* the bite
      says "Wait for the bite…" (no penalty). After the bite it lands the fish **now**.
- [ ] A good, timely reel hooks a **better species** than a passive catch.
- [ ] The bite window is **generous** (half the cast) — no fast reactions or mashing needed.
- [ ] **Assisted** mode reels for you and still lands a solid catch.
- [ ] Doing nothing still lands fish on the timer (cosy passive play preserved).

## Smelting — furnace profile
- [ ] **Standard / Economical (less fuel, rougher bars) / Fast (more fuel, quicker, rougher) /
      Quality (more fuel, slower, better bars)**.
- [ ] Economical visibly consumes **less** input over a run; Fast consumes **more**; the QC
      rating drifts up on Quality and down on Economical/Fast.

## Manufacturing — batch tolerance
- [ ] **Standard / Loose (faster, lower quality, little rework) / Tight (slower, higher
      quality, more rework)**.
- [ ] Tight tolerance nudges the QC rating up; Loose nudges it down.
- [ ] Tight tolerance occasionally needs rework (feeds the QC/rework system, not just XP).

## Automation cost (measurable)
- [ ] An automaton/offline run uses the **balanced default** only — it never gets the deep-seam
      +1 ore, careful +1 log or tight-tolerance quality. Being present and choosing an approach
      is what earns the bonus.

## Accounting (must stay exact)
- [ ] Inventory and XP totals are exact — approach bonuses add whole items only; fuel changes
      never leave a fractional item (verified by `costWithCarry` aggregation).
- [ ] Existing level unlocks and progression are unchanged.
