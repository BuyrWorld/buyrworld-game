# HOUSE_INTERIOR_ASSET_GUIDE.md

Guide for BuyrWorld's villager house interiors (milestone **HX2 — Asset-Led House
Interior Overhaul**). Read alongside `GAME_BIBLE.md` (source of truth).

BuyrWorld is a **cosy top-down 2D pixel supply-chain life-sim**. Interiors must
read as warm, lived-in homes where you can tell at a glance *who lives here, what
they do, and what they're like*. Do **not** introduce isometric / 3D / platformer
perspectives into rooms.

---

## Rendering approach (hybrid)

The game renders interiors with the HTML canvas — there is **no** tile-map engine
for rooms. HX2 uses a deliberate hybrid:

1. **Verified pack tiles** for anchor furniture, via `drawFurnitureTile(col,row,…)`
   in `src/world/assets.ts` (Roguelike Interior Pack, already loaded at
   `public/assets/interior/roguelikeIndoor_transparent.png`).
2. **Canvas-drawn props** for household personality (workbenches, nets, jars,
   filing cabinets, animal baskets…), where we keep full positional control.

Only **verified** tile coordinates are used — ones already proven correct in the
shipping player-house (`myhome`) room. The sheet ships without a tile-name index,
so unverified coordinates are avoided rather than guessed.

### Verified tile coordinates (16×16 tiles, 1px margin → 17px pitch)

| Furniture | col,row | tiles (w×h) |
|-----------|---------|-------------|
| Bed | 0,0 | 2×2 |
| Table | 4,0 | 2×2 |
| Cabinet | 12,0 | 1×2 |
| Potted plant (tall) | 14,0 | 1×2 |
| Wall painting | 16,0 | 3×1 |
| Vase | 18,0 | 1×1 |
| Lamp | 20,1 | 1×1 |
| Fireplace | 22,0 | 2×2 |
| Bookshelf | 8,2 | 1×2 |
| Bookcase (tall) | 8,4 | 1×2 |
| Sofa | 0,4 | 3×1 |
| Rug (oval) | 0,7 | 3×2 |
| Fancy rug | 3,7 | 3×2 |

Exposed in `_homeProp()` via `tile:` keys (`tile:bed`, `tile:table`,
`tile:bookshelf`, `tile:cabinet`, `tile:plant`, `tile:fireplace`, `tile:sofa`).

---

## Asset packs

- **A — use now (interiors):** Roguelike Interior Pack (top-down, 16px, cosy —
  already integrated).
- **B — later (shops / industry / districts):** Tiny Town, RPG Urban Pack,
  Roguelike City Pack, Fish Pack, Animal Pack Remastered, Generic Items.
  *(These are exterior/city tiles — great for the districts milestone, wrong tool
  for rooms.)*
- **C — UI / icons only:** Generic Items, Emote Pack, Medals / Ranks.
- **D — avoid (perspective/scale clash):** all Isometric packs, Pico-8 City,
  platformer / shooter / medieval / voxel packs.

---

## Data-driven layout

Per-home layouts live in `src/data/homeInteriors.ts` as `HOME_INTERIORS`, keyed by
`homeId`. Each entry:

```ts
{ arch, pal:{wallTop,wall,floorA,floorB,trim}, rug, props:[{k, fx, fy}, …] }
```

- `pal` overrides the `room()` palette so each archetype feels different instantly.
- `rug` tints the central rug.
- `props` is an ordered list; `fx,fy` are **fractions of the room** (0–1). Positions
  are resolved in `main.ts` and passed to `_homeProp(ctx,key,x,y,W,H,t,_ft,pal)`.

### Household archetypes (17 homes, each distinct)

| Home · Occupant | Archetype | Signature |
|---|---|---|
| 01 Agnes | neat older resident | bookshelf, tea shelf, writing bureau |
| 02 Bertie | practical worker | wardrobe, tool hooks, fireplace |
| 03 Clara | family home | kitchen counter, cake stand, kids' toys, table |
| 04 Derek | practical/family | route board, manifests, toy lorry |
| 05 Edna | eccentric collector | glass display case, wall photos, medal case |
| 06 Frank | messy sawmill worker | workbench, axe wall, timber, boots |
| 07 Gracie | farmer / rural | egg dresser, herbs, animal basket, feed sacks |
| 08 Hector | neat professional | filing cabinet, framed certificates |
| 09 Ida | fisher / seaside | net, tackle, crates, oilskins |
| 10 Jack | practical worker | wardrobe, tool hooks, ember apron |
| 11 Kitty | messy tinkerer | metal shelf, workbench, gears project |
| 12 Lenny | big family home | route board, bunting, toys, table |
| 13 Mabel | family + baker | counter, bunting, rosettes, cake stand |
| 14 Ned | tidy sawyer | bookshelf, timber, reading chair |
| 15 Olive | seaside family | net, flower jar, crates, toys |
| 16 Reg | cosy older seafarer | nav chart, sea chest, model boat, lantern |
| 17 Pearl | practical seaside | ice box, knife rack, scales, crates |

---

## Layout & density rules

Each home has: **1 anchor** (bed corner, already drawn) · **2–4 functional
pieces** · **2–6 decorative props** · **1 story corner** (the archetype signature).

## Scale & collision rules

- Canvas props are authored at the same pixel scale as the player; tiles draw at
  `scale 2` (32px per tile).
- Keep three areas clear: the **top-right bed** (and, on family homes, the
  **children's beds** in the right-mid), and the **bottom-centre door/exit lane**.
  Right-side props sit **below the bed line** only.
- Props are drawn before the NPC daily-routine figure, so the occupant renders in
  front of the furniture.

## Adding a new furnished home

1. Add a `HOME_INTERIORS[home_id]` entry: pick a palette, rug tint, and 4–6 props.
2. Reuse existing prop keys, or add a `case` to `_homeProp()` in `main.ts`.
3. Only add a `tile:` anchor for a **verified** coordinate (table above).
4. Keep to the safe zones; run `npm run build`, `npm run check:data`, `npm test`.

## Licence

Roguelike Interior Pack © Kenney (kenney.nl) — **CC0 / public domain**. Full text
at `public/assets/interior/License.txt`. Credit appreciated, not required.
