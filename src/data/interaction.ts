// ============================================================================
// REUSABLE INTERACTION TARGETING — ONE contract for pointer, touch & controller.
// ----------------------------------------------------------------------------
// Pure & testable: hitbox geometry, explicit overlap priority, range checks, the
// contextual verb, and D-pad target cycling. NO game state, DOM, or per-NPC
// special-casing — main.ts builds a target list from live objects and drives all
// three input methods through these helpers, so behaviour can never drift between
// a villager, a cottage and a rock.
//
// The interaction contract these support:
//   • Tapping clear terrain MOVES; it never triggers a nearby object.
//   • Tapping an interactive target SELECTS/highlights it first (shows a verb).
//   • Interaction happens only when the player is in range AND confirms, or a
//     deliberate direct control (controller A / keyboard E / the verb chip) fires.
// ============================================================================

export type TargetKind = 'npc' | 'building' | 'sign' | 'resource' | 'stall' | 'lore' | 'prop';

// Explicit interaction priority — when hitboxes overlap, the HIGHER value wins.
// Foreground actors and small deliberate props beat the large static building
// behind them: clicking a person in front of a cottage selects the person, while
// clicking the cottage wall (no NPC there) selects the cottage.
export const TARGET_PRIORITY: Record<TargetKind, number> = {
  npc: 6, stall: 5, sign: 5, lore: 5, resource: 4, prop: 3, building: 2,
};

// Default range (world px, from the target's approach point) at which the player
// counts as "in range" to interact, and the radius used for controller
// auto-highlight + D-pad cycling.
export const INTERACT_RANGE = 46;
export const NEARBY_RADIUS = 120;

export interface Box { x: number; y: number; w: number; h: number; }

export function pointInBox(px: number, py: number, b: Box, pad = 0): boolean {
  return px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
}

export interface Hit {
  id: string;
  kind: TargetKind;
  box: Box;          // world-space hitbox
  pad?: number;      // extra hit padding (touch friendliness); small so it never swallows terrain
  priority?: number; // overrides TARGET_PRIORITY[kind]
}

/**
 * Pick the interactive target under a world point. Overlaps are resolved by
 * priority, then by the SMALLER hitbox (a tight NPC beats a huge building
 * footprint on a tie), then it's deterministic by input order. Returns null when
 * the point is clear terrain — so the caller MOVES instead of interacting.
 */
export function hitTest<T extends Hit>(px: number, py: number, targets: T[]): T | null {
  let best: T | null = null, bestPri = -Infinity, bestArea = Infinity;
  for (const t of targets) {
    if (!pointInBox(px, py, t.box, t.pad ?? HIT_PAD[t.kind] ?? 0)) continue;
    const pri = t.priority ?? TARGET_PRIORITY[t.kind] ?? 0;
    const area = Math.max(1, t.box.w * t.box.h);
    if (pri > bestPri || (pri === bestPri && area < bestArea)) {
      best = t; bestPri = pri; bestArea = area;
    }
  }
  return best;
}

export function inRange(px: number, py: number, ax: number, ay: number, range = INTERACT_RANGE): boolean {
  return Math.hypot(px - ax, py - ay) <= range;
}

// ---- Hitbox builders (pure; caller passes dimensions) ---------------------
// NPCs get a TIGHT sprite-sized box (not a wide grab radius) so a tap clearly on
// the ground behind or beside them lands on terrain (→ move), never on the NPC.
export function npcBox(x: number, y: number, tile: number): Box {
  const w = Math.round(tile * 0.72);          // ~17px at TILE 24 — the body only
  const h = Math.round(tile * 1.42);          // head to feet
  return { x: x - w / 2, y: y - Math.round(tile * 1.16), w, h };
}
// A footprint building/prop uses its own rect (a small per-kind pad is applied at
// hit-test time). Kept as its own helper so callers never hand-roll boxes.
export function footprintBox(rectX: number, rectY: number, rectW: number, rectH: number): Box {
  return { x: rectX, y: rectY, w: rectW, h: rectH };
}

// Touch/mouse hit padding per kind (world px). Deliberately small — never large
// enough to swallow an adjacent walkable tile (TILE is 24). Signs/lore are tiny
// and always a deliberate tap, so they get a more forgiving pad.
export const HIT_PAD: Record<TargetKind, number> = {
  npc: 3, resource: 4, building: 4, stall: 6, sign: 10, lore: 9, prop: 3,
};

// ---- Contextual verb ------------------------------------------------------
export const KIND_VERB: Record<TargetKind, string> = {
  npc: 'Chat', building: 'Enter', sign: 'Read', resource: 'Gather', stall: 'Shop', lore: 'Read', prop: 'Inspect',
};
const SHOP_TABS = new Set(['trade', 'retail', 'exchange', 'bank', 'estateagent', 'postoffice', 'fishmonger_wh', 'seasonal_market', 'furniture_shop', 'bike_shop', 'boat_hire', 'pub', 'cafe']);
const GATHER_TABS = new Set(['mining', 'woodcutting', 'foraging']);

/** The short verb shown on the selection chip (Chat / Enter / Mine / Fish / Inspect …). */
export function interactVerb(kind: TargetKind, opts: { tab?: string; resource?: 'rock' | 'tree'; id?: string } = {}): string {
  if (kind === 'resource') return opts.resource === 'tree' ? 'Chop' : 'Mine';
  if (kind === 'building') {
    const tab = opts.tab || '';
    if (tab === 'fishing') return 'Fish';
    if (SHOP_TABS.has(tab)) return 'Shop';
    if (GATHER_TABS.has(tab)) return 'Gather';
    return 'Enter';
  }
  return KIND_VERB[kind] || 'Inspect';
}

// ---- D-pad target cycling (focus nav that NEVER moves the character) -------
/** Cycle the highlighted target among a sorted nearby id list. Pure index math. */
export function cycleTarget(ids: string[], currentId: string | null, dir: 1 | -1): string | null {
  if (!ids.length) return null;
  const i = currentId ? ids.indexOf(currentId) : -1;
  if (i < 0) return dir === 1 ? ids[0] : ids[ids.length - 1];
  return ids[(i + dir + ids.length) % ids.length];
}
