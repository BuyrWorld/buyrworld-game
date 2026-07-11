// @ts-nocheck
// Darts — a 301 countdown mini game for The Rose & Pallet. Standard board scoring
// (singles / doubles / trebles / 25 / bull) and difficulty-scaled opponents.
// Pure/testable; the throwing UI + AI animation live in main.ts.

// Numbers clockwise from the top (12 o'clock).
export const DART_SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Ring radii as a fraction of the board radius.
export const DART_RINGS = { bull: 0.045, outer: 0.11, trebleIn: 0.55, trebleOut: 0.63, doubleIn: 0.92, doubleOut: 1.0 };

// Sector index (0..19) for an offset from board centre; angle clockwise from top.
export function sectorIndexAt(dx, dy){
  const a = Math.atan2(dx, -dy);
  const idx = Math.round(a / (Math.PI * 2 / 20));
  return ((idx % 20) + 20) % 20;
}
export function sectorNumberAt(dx, dy){ return DART_SECTORS[sectorIndexAt(dx, dy)]; }

// Score for a dart landing at (dx,dy) from centre, on a board of radius R.
export function scoreAt(dx, dy, R = 1){
  const r = Math.hypot(dx, dy) / R;
  if (r > DART_RINGS.doubleOut) return { score: 0, ring: 'miss', base: 0 };
  if (r <= DART_RINGS.bull) return { score: 50, ring: 'bull', base: 50 };
  if (r <= DART_RINGS.outer) return { score: 25, ring: '25', base: 25 };
  const base = sectorNumberAt(dx, dy);
  if (r >= DART_RINGS.trebleIn && r <= DART_RINGS.trebleOut) return { score: base * 3, ring: 'treble', base };
  if (r >= DART_RINGS.doubleIn) return { score: base * 2, ring: 'double', base };
  return { score: base, ring: 'single', base };
}

// Centre offset (as a fraction of R when R omitted) to aim at a number+ring.
export function aimPointFor(number, ring, R = 1){
  const idx = Math.max(0, DART_SECTORS.indexOf(number));
  const a = idx * (Math.PI * 2 / 20);
  let rr;
  if (ring === 'bull') rr = 0;
  else if (ring === 'treble') rr = (DART_RINGS.trebleIn + DART_RINGS.trebleOut) / 2;
  else if (ring === 'double') rr = (DART_RINGS.doubleIn + DART_RINGS.doubleOut) / 2;
  else rr = 0.34;
  return { x: Math.sin(a) * rr * R, y: -Math.cos(a) * rr * R };
}

export const DART_DIFFICULTIES = [
  { id: 'rookie',  n: 'Rookie',  scatter: 0.17,  reward: 40  },
  { id: 'regular', n: 'Regular', scatter: 0.10,  reward: 90  },
  { id: 'sharp',   n: 'Sharp',   scatter: 0.055, reward: 180 },
  { id: 'ringer',  n: 'Ringer',  scatter: 0.028, reward: 350 },
];
export function difficultyById(id){ return DART_DIFFICULTIES.find(d => d.id === id) || DART_DIFFICULTIES[0]; }

export const DARTS_START = 301;

// Apply one dart to a running total (no double-out: exact zero wins; overshoot busts).
export function dartOutcome(remaining, sc){
  if (sc > remaining) return { bust: true, remaining };
  if (sc === remaining) return { win: true, remaining: 0 };
  return { remaining: remaining - sc };
}

// ---- Skill-based throw model -------------------------------------------------
// The aim reticle sways; the player releases (click / Space) to throw. Sway
// amplitude (as a fraction of the board radius R) shrinks with darts wins (skill)
// and optional aim-assist, and grows when drunk/tired. Deterministic sway keeps
// pure randomness to a minimum — consistency comes from the player's timing.
export function playerSwayAmp(wins, opts = {}){
  let amp = 0.12;                                                  // base sway
  amp *= 1 / (1 + Math.min(Math.max(wins || 0, 0), 20) * 0.055);  // skill steadies (up to ~-52%)
  if (opts.drunk)  amp *= 1.8;                                     // alcohol shakes the hand
  if (opts.assist) amp *= 0.45;                                    // aim-assist ~halves the sway
  return Math.max(0.015, amp);
}
// Deterministic reticle offset (fraction of R) at time tSec for a given amplitude.
export function swayOffset(tSec, amp){
  return { dx: Math.sin(tSec * 3.3) * amp, dy: Math.cos(tSec * 2.1) * amp };
}
// Small residual scatter applied on release (also skill/assist-scaled), so even a
// perfectly-timed release has a hair of spread but is never wildly random.
export function releaseScatter(wins, opts = {}){
  let s = 0.028;
  s *= 1 / (1 + Math.min(Math.max(wins || 0, 0), 20) * 0.05);
  if (opts.assist) s *= 0.5;
  if (opts.drunk)  s *= 1.5;
  return s;
}

// What the opponent aims at, given its remaining score.
export function botTarget(remaining){
  if (remaining <= 20) return { number: remaining, ring: 'single' };
  if (remaining <= 40 && remaining % 2 === 0) return { number: remaining / 2, ring: 'double' };
  if (remaining < 60) return { number: Math.min(20, Math.floor(remaining / 3)) || 1, ring: 'treble' };
  return { number: 20, ring: 'treble' };
}
