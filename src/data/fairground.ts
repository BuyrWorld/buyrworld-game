// @ts-nocheck
// Fairground games for seasonal festivals. The High Striker ("test your
// strength") is a timing game: stop the oscillating power gauge as high as you
// can and try to ring the bell. Pure/testable reward tiers; the canvas game +
// festival wiring live in main.ts.

export const STRIKER_FEE = 12;   // coins per swing

// Locked power (0..100) → reward. Ringing the bell (>=95) pays the jackpot.
export function strikerReward(power){
  if (power >= 95) return { coins: 120, bell: true,  tier: 'jackpot', label: '🔔 DING DING! You rang the bell!' };
  if (power >= 80) return { coins: 55,  bell: false, tier: 'great',   label: '💪 A mighty swing!' };
  if (power >= 55) return { coins: 26,  bell: false, tier: 'good',    label: '👍 Solid hit!' };
  if (power >= 30) return { coins: 11,  bell: false, tier: 'ok',      label: '🙂 Not bad.' };
  return { coins: 3, bell: false, tier: 'weak', label: '😅 Barely a tap — give it some welly!' };
}
