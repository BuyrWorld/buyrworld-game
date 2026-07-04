# ART_ASSET_GUIDE.md — BuyrWorld Kenney Asset Pipeline

## Licence

All assets are from [Kenney.nl](https://kenney.nl) and released under **Creative Commons Zero (CC0)**. No attribution required; commercial use permitted.

---

## Folder Structure

```
public/assets/
├── buildings/      Kenney City Kit sprites for world buildings
├── characters/     Kenney Mini Characters for NPC vendors
└── factory/        Kenney Factory Kit props (decorative)
```

---

## Asset Manager

**Source:** `src/world/assets.ts`

- `preloadAll()` — called once at boot; fires off async `Image` loads for all registered sprites
- `getSprite(key)` — returns `HTMLImageElement | null` (null until loaded)
- `drawSprite(ctx, key, cx, bottomY, drawW)` — draw centred on `cx`, bottom-aligned at `bottomY`; returns `false` if not yet loaded so the caller falls back to procedural canvas drawing

### Fallback guarantee

Every sprite use in `drawObjects()` follows this pattern:

```js
const drawn = drawSprite(ctx, 'bld_furnace', cx, bottomY, w);
if (!drawn) {
  // original canvas rectangles here
}
```

If a sprite fails to load (missing file, offline) the game renders identically to before M4.6.

---

## Building Sprites

| Building ID | Name             | Source Kit              | File                         | Rationale                          |
|-------------|------------------|-------------------------|------------------------------|------------------------------------|
| `furnace`   | Steelworks       | City Kit - Industrial   | `industrial-a.png`           | Large dark multi-storey industrial |
| `workshop`  | Workshop         | City Kit - Industrial   | `industrial-k.png`           | Row of industrial bays             |
| `depot`     | Freight Depot    | City Kit - Industrial   | `industrial-b.png`           | Medium industrial with office wing |
| `hall`      | Town Hall        | City Kit - Suburban     | `suburban-e.png`             | Two-storey civic building          |
| `barn`      | Companion Barn   | City Kit - Suburban     | `suburban-b.png`             | Large suburban, reads as a hall    |
| `trophy`    | Trophy Hall      | City Kit - Suburban     | `suburban-p.png`             | Small compact building             |

**Sprite draw size:** `r.w + 24` px wide (r.w = tile footprint width, TILE=24).  
**Alignment:** bottom of sprite at `r.y + r.h + 4` (ground plane sits at tile base).  
Emoji icon (🔥 ⚙️ 📦 etc.) and dynamic effects (smoke, sparkle) are always drawn on top.

---

## NPC Vendor Sprites

| Stall ID      | Trader | Source Kit       | File                 | Rationale                    |
|---------------|--------|------------------|----------------------|------------------------------|
| `stall_marge` | Marge  | Mini Characters  | `mini-female-b.png`  | Earthy female, farmer-ish    |
| `stall_bolt`  | Bolt   | Mini Characters  | `mini-male-e.png`    | Stocky male, manual worker   |
| `stall_perry` | Perry  | Mini Characters  | `mini-male-d.png`    | Smart/suited, freight agent  |

**Sprite draw size:** 30 px wide.  
Falls back to `drawPerson()` canvas drawing if image not loaded.

---

## Factory Props (available, not yet placed)

| File                              | Object         | Intended use                         |
|-----------------------------------|----------------|--------------------------------------|
| `factory/conveyor-long.png`       | Conveyor belt  | Steelworks / Manufacturing interiors |
| `factory/box-large.png`           | Cargo crate    | Depot interior / warehouse decor     |
| `factory/cog-a.png`               | Gear           | Workshop interior decor              |
| `factory/pipe-large.png`          | Industrial pipe| Steelworks interior                  |

---

## Adding New Sprites

1. Drop the PNG into the relevant `public/assets/` subdirectory (lowercase path).
2. Add an entry to `BUILDING_SPRITE_MAP` or `NPC_SPRITE_MAP` in `src/world/assets.ts`.
3. `preloadAll()` picks it up automatically on next boot.
4. Use `drawSprite(ctx, key, ...)` in `drawObjects()` with a canvas fallback.

## Style Notes

- Kenney sprites are isometric (≈45° camera). The game is top-down. This mismatch is intentional and acceptable — the sprites look far better than coloured rectangles.
- Sprites are drawn square (aspect ratio preserved). Do not stretch.
- All sprites are CC0 — no attribution string needed in-game.
- The player character and wandering NPCs (Frost, Poppy, Sam) remain as `drawPerson()` canvas code to preserve walking animation and character customisation.
