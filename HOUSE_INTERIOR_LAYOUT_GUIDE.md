# HOUSE_INTERIOR_LAYOUT_GUIDE.md

How BuyrWorld's NPC home interiors are laid out (milestone **HX3 — Normal Home
Layout Pass**). Read alongside `GAME_BIBLE.md` (source of truth) and
`HOUSE_INTERIOR_ASSET_GUIDE.md` (tile/asset rules).

Goal: a player walks into a cottage and immediately reads the **floorplan** —
entrance, kitchen/dining, living, sleeping, storage, and a personality corner —
not an empty box with furniture pushed against the walls.

---

## The layout engine

Interiors are **zone-based and parametric**. Each home is described compactly in
`src/data/homeInteriors.ts`:

```ts
{ arch, template, pal, rug, wall, nook:[...], family?, clutter }
```

`buildLayout(theme, id, W, H)` turns that into a full floorplan and returns:
- `floors` — tinted zone patches (kitchen tile, living rug, bedroom rug),
- `placements` — furniture/props drawn by `_homeProp()` in `main.ts`,
- `solids` — collision rects (via `homeCollisionRects`), so **movement matches
  what's drawn**. The old shared/stale `INTERIOR_COLS.home` is retired.

Because both drawing and collision come from the same function, they never drift.

## Zone grammar (fixed 320×200 room; bed top-right, door bottom-centre)

| Zone | Where | Contents |
|---|---|---|
| **Entrance** | bottom-centre at the door | mat, boots, potted plant (exit lane kept clear) |
| **Kitchen/dining** | back-left wall | counter run (stove + sink + worktop + wall shelf) on a tiled floor patch, dining table + chairs in front |
| **Living** | centre, on a rug | sofa + coffee table + floor lamp — **fills the middle so the room isn't hollow** |
| **Sleeping** | top-right, around the bed | bed + bedside table + bedroom rug + a folding-screen divider (single/couple homes) that reads as a separate bedroom |
| **Storage/personality** | bottom-left nook | the occupation cluster: workbench, nets, ledger, display case, dresser… |
| **Wall decoration** | back wall centre | one intentional hanging (tool hooks, nets, chart, photos, certificates…) |

## Template types

`cosy` (elderly/warm) · `worker` (practical, workbench-led) · `family` (bigger
dining table + toy corner + children's beds) · `trader` (ledger/desk + tidy) ·
`fisher` (sea palette + nets/crates). Every template still lays down **all** core
zones — variation comes from palette, nook props, wall hanging, clutter, and the
family flag, never from removing a room.

## Object-cluster rules

Furniture is placed as **clusters**, never scattered:
- kitchen = counter + appliances + wall shelf + dining set,
- living = sofa + coffee table + lamp on one rug,
- bedroom = bed + bedside + rug + divider,
- nook = the occupation story pieces grouped in one corner.

## Collision & walkability rules

- Solid pieces: beds, kitchen counter, dining table, sofa, coffee table, bedside,
  divider, and tall/wide nook units. Small clutter and wall hangings are
  non-solid.
- The exit mat lane (bottom-centre) is always collision-free.
- A `tests/homeInteriors.test.ts` **BFS reachability** check inflates every solid
  by the player's half-width and asserts the kitchen and living zones (and the
  bed, in child-free homes) are reachable from the door in all 17 homes. Add a
  home and this test guards it automatically.
- Crowded family bedrooms (double bed + children's beds) are exempt from strict
  bed-reachability — that corner is intentionally full.

## Per-home layouts

All 17 share the zone grammar; these are the identity/mood/nook differences.

| Home · Occupant | Template | Mood | Wall | Nook (storage/story) | Clutter |
|---|---|---|---|---|---|
| 01 Agnes | cosy | warm cream | tea shelf | tall bookshelf + files | low |
| 02 Bertie | worker | dark wood + hearth | tool hooks | wardrobe + boots | medium |
| 03 Clara | family | flour-warm yellow | preserve shelf | crates (+ toy corner) | medium |
| 04 Derek | trader | navy utilitarian | route board | crates + tool chest | medium |
| 05 Edna | cosy | dim dusty | wall photos | glass display case + files | high |
| 06 Frank | worker | raw timber | axe wall | workbench + timber (+ toys) | high |
| 07 Gracie | family | green + hay | herb bunches | egg dresser + feed sacks | medium |
| 08 Hector | trader | cool blue | framed certs | filing cabinet | low |
| 09 Ida | fisher | sea-blue | hanging net | crates + tackle + bucket | medium |
| 10 Jack | worker | charcoal + ember | tool hooks | wardrobe + ember apron | medium |
| 11 Kitty | worker | steel-grey | tool hooks | workbench + gears + tool chest | high |
| 12 Lenny | family | busy warm | route board | crates + toy lorry (+ toys) | high |
| 13 Mabel | family | rose + bunting | rosettes | crates (+ toy corner) | medium |
| 14 Ned | worker | soft woods | axe wall | tall bookshelf + timber | low |
| 15 Olive | fisher | teal | hanging net | crates + tackle (+ toys) | medium |
| 16 Reg | cosy | navy + brass | nav chart | sea chest + model boat | medium |
| 17 Pearl | fisher | cool tile + ice | knife rack | ice box + scales + crates | medium |

## Public interiors (HX4)

The shops and social rooms (pub, café, bank, furniture shop, retail, post office,
estate agent, …) are drawn in their own `drawInterior()` blocks. Two shared rules
now apply to them:

- **Shell depth** — the wainscot/skirting/corner-post depth lives in the shared
  `room()` painter, so every `room()`-based interior matches the homes. Don't
  re-add it per room.
- **Collision** — counter/bar solids for the core rooms live in
  `src/data/interiorCollision.ts` (`PUBLIC_COLS`), merged into `INTERIOR_COLS`.
  `tests/publicInteriors.test.ts` asserts the exit lane is clear, the player
  doesn't spawn inside furniture, and the counter is reachable. To make a new
  public room's furniture solid, add a `PUBLIC_COLS[tab]` entry (keep the
  bottom-centre exit lane clear).

## Adding a new furnished home (without making a box)

1. Add a `BED_CONFIG[home_id]` entry (`d` double, `k` children's beds).
2. Add a `HOME_INTERIORS[home_id]`: pick a `template`, `pal`, `rug`, a `wall`
   hanging, 1–3 `nook` story props, and `family` if there are children.
3. That's it — `buildLayout` gives it the full zone set automatically. Run
   `npm run build`, `npm run check:data`, `npm test`; the reachability test
   confirms the door-to-zones circulation.
4. Only add new prop keys to `_homeProp()` if the story needs a shape that doesn't
   exist yet.
