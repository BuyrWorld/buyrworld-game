// @ts-nocheck
// Village events — a light rotating calendar so every day in Featherstone feels a
// little different. Pure/testable: the caller passes a day seed (whole days since
// the epoch) and gets today's event. A simple weekly rotation, quiet days included.

export interface VillageEvent {
  id: string;
  ic: string;
  name: string;
  blurb: string;
}

export const VILLAGE_EVENTS: Record<string, VillageEvent> = {
  merchant: {
    id: 'merchant', ic: '🚚', name: 'Travelling Merchant',
    blurb: "A pedlar has rolled into town with a cart of curiosities — and a mystery crate or two.",
  },
  market_day: {
    id: 'market_day', ic: '🎪', name: 'Market Day',
    blurb: "The whole valley is out buying today — every sale you make fetches +20%.",
  },
  fair: {
    id: 'fair', ic: '🎟️', name: 'Village Fair',
    blurb: "The green is decked out for the fair. Try your luck at the tombola!",
  },
};

// Which event (if any) is on for a given day. dow: 0..6 from the day seed.
export function todaysEvent(daySeed: number): VillageEvent | null {
  const dow = ((Math.floor(daySeed) % 7) + 7) % 7;
  if (dow === 6) return VILLAGE_EVENTS.market_day;   // once a week
  if (dow === 0) return VILLAGE_EVENTS.fair;         // once a week (different day)
  if (dow === 2 || dow === 4) return VILLAGE_EVENTS.merchant;  // twice a week
  return null;                                        // quiet day
}

export function isEvent(daySeed: number, id: string): boolean {
  return todaysEvent(daySeed)?.id === id;
}
export function marketDayActive(daySeed: number): boolean { return isEvent(daySeed, 'market_day'); }
export function merchantActive(daySeed: number): boolean { return isEvent(daySeed, 'merchant'); }
export function fairActive(daySeed: number): boolean { return isEvent(daySeed, 'fair'); }
