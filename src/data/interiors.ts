// ============================================================================
// INTERIOR TRANSITION — pure helpers for the ONE authoritative exit system.
// ----------------------------------------------------------------------------
// The exit region, and validation of the recorded exterior-return so a save with
// missing/corrupt interior state can safely drop the player outside. No DOM, no
// game state — main.ts owns leaveInterior()/entry recording and calls these.
// ============================================================================

// A forgiving exit region: the bottom band of the interior canvas. Anything wider
// than a pixel or two so "walk south to leave" is reliable regardless of frame
// rate or the per-frame collision push-out.
export const EXIT_BAND = 20;

/** True when the interior player's feet are within the bottom exit region. */
export function inExitRegion(ipY: number, canvasH: number, band: number = EXIT_BAND): boolean {
  return ipY >= (canvasH - band);
}

export interface InteriorReturn { district: string; x: number; y: number; objId: string | null; }

/**
 * Validate a recorded exterior-return. Returns a clean InteriorReturn, or null
 * when the record is missing / corrupt (non-finite, out of the world bounds, or
 * the wrong shape) so the caller can fall back to a safe default (req 8).
 */
export function validReturn(ret: any, worldW: number, worldH: number): InteriorReturn | null {
  if (!ret || typeof ret !== 'object') return null;
  const x = ret.x, y = ret.y;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!isFinite(x) || !isFinite(y)) return null;
  if (x < 0 || y < 0 || x > worldW || y > worldH) return null;
  return { district: (typeof ret.district === 'string' && ret.district) ? ret.district : 'village', x, y, objId: (ret.objId ?? null) };
}

/** True when a saved tab id refers to an interior (not the exterior 'village'). */
export function isInteriorTab(tab: string, interiorTabs: ReadonlySet<string>): boolean {
  return tab !== 'village' && interiorTabs.has(tab);
}
