// @ts-nocheck
// Lightweight async sprite cache.
// getSprite() returns null until loaded — callers fall back to canvas drawing.

const _cache = new Map<string, HTMLImageElement | null>();

export function loadSprite(key: string, src: string): void {
  if (_cache.has(key)) return;
  _cache.set(key, null); // mark as loading; stays null on error (canvas fallback used)
  const img = new Image();
  img.onload = () => _cache.set(key, img);
  img.src = src;
}

export function getSprite(key: string): HTMLImageElement | null {
  return _cache.get(key) ?? null;
}

// Draw a sprite centred horizontally at cx, bottom edge at bottomY.
// Returns false if the sprite is not yet loaded so the caller can draw a fallback.
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  key: string,
  cx: number,
  bottomY: number,
  drawW: number,
): boolean {
  const img = getSprite(key);
  if (!img) return false;
  const dh = drawW * (img.naturalHeight / img.naturalWidth);
  ctx.drawImage(img, Math.round(cx - drawW / 2), Math.round(bottomY - dh), drawW, dh);
  return true;
}

// Mapping: V_OBJECTS id → sprite path under /assets/
export const BUILDING_SPRITE_MAP: Record<string, string> = {
  furnace:  '/assets/buildings/industrial-a.png',
  workshop: '/assets/buildings/industrial-k.png',
  depot:    '/assets/buildings/industrial-b.png',
  hall:     '/assets/buildings/suburban-e.png',
  barn:     '/assets/buildings/suburban-b.png',
  trophy:   '/assets/buildings/suburban-p.png',
  sawmill: '/assets/buildings/suburban-c.png',
};

export const NATURE_SPRITE_MAP: Record<string, string> = {
  tree_large: '/assets/nature/tree-large.png',
  tree_small: '/assets/nature/tree-small.png',
};

export const INTERIOR_SPRITE_MAP: Record<string, string> = {
  prop_machine:   '/assets/factory/machine.png',
  prop_hopper:    '/assets/factory/hopper-round.png',
  prop_conveyor:  '/assets/factory/conveyor-long.png',
  prop_cog:       '/assets/factory/cog-a.png',
};

// Mapping: stall object id → NPC vendor sprite
export const NPC_SPRITE_MAP: Record<string, string> = {
  stall_marge: '/assets/characters/mini-female-b.png',
  stall_bolt:  '/assets/characters/mini-male-e.png',
  stall_perry: '/assets/characters/mini-male-d.png',
};

export function preloadAll(): void {
  Object.entries(BUILDING_SPRITE_MAP).forEach(([k, v]) => loadSprite(`bld_${k}`, v));
  Object.entries(NPC_SPRITE_MAP).forEach(([k, v])      => loadSprite(`npc_${k}`, v));
  Object.entries(NATURE_SPRITE_MAP).forEach(([k, v])   => loadSprite(k, v));
  Object.entries(INTERIOR_SPRITE_MAP).forEach(([k, v]) => loadSprite(k, v));
}
