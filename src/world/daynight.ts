/** One full game day = 24 real minutes. */
export const DAY_DURATION_MS = 24 * 60 * 1000;

/** Session boot time — every session starts at a friendly mid-morning. */
export const BOOT_MS = Date.now();
export const BOOT_HOUR = 9.25;

/** Game hour [0, 24). Starts at 09:15 each session so players see daylight first. */
export function gameHour(now = Date.now()): number {
  const raw = BOOT_HOUR + ((now - BOOT_MS) / DAY_DURATION_MS) * 24;
  return ((raw % 24) + 24) % 24;
}

/** 0 = midnight (darkest) → 1 = noon (brightest). */
export function dayFraction(now = Date.now()): number {
  const h = gameHour(now);
  return (Math.cos((h - 12) / 12 * Math.PI) + 1) / 2;
}

/** True during hours [0,6) and [20,24). */
export function isNight(now = Date.now()): boolean {
  const h = gameHour(now);
  return h < 6 || h >= 20;
}

/** Alpha for the night overlay (0–0.20) — capped so the world always stays readable. */
export function nightAlpha(now = Date.now()): number {
  return Math.min(0.26, (1 - dayFraction(now)) * 0.52);
}

/** Lamp warm-glow intensity [0, 1]; 0 during daytime. */
export function lampGlow(now = Date.now()): number {
  return Math.min(1, Math.max(0, (1 - dayFraction(now)) * 1.6 - 0.3));
}

/**
 * RGB string used as the night overlay colour.
 * Returns warm amber at dawn/dusk, deep blue at night.
 * Compose with nightAlpha: `rgba(${skyTint()},${alpha})`.
 */
export function skyTint(now = Date.now()): string {
  const h = gameHour(now);
  if (h >= 5 && h < 7.5)  return '70,30,10';  // sunrise blush
  if (h >= 17 && h < 20)  return '60,22,8';   // sunset ember
  return '10,15,50';                            // night indigo
}
