// M15 — First 30-Minute Fun Pass: the "Getting Started" starter ladder.
// A short, fast-escalating chain of beats that bridges the 4-step Frost tutorial
// and the whole-game Founder's Journey, so the crucial first half-hour has a
// steady drip of celebratory wins. Pure/testable: each beat reads a plain `ctx`
// metrics object assembled in main.ts. Rewards are coins (+ optional starter
// items) only — Titles stay the Founder's Journey's domain.

export interface WelcomeBeat {
  id: string;
  ic: string;
  title: string;
  desc: string;                 // the "what to do next" hint
  metric: string;               // key into the ctx metrics object
  target: number;               // met when ctx[metric] >= target
  reward: { coins: number; item?: string; qty?: number };
}

export const WELCOME_BEATS: WelcomeBeat[] = [
  { id:'warmed_up',   ic:'✨', title:'Finding Your Feet',      metric:'actions',       target:15,
    desc:'Complete 15 gathering or crafting actions around the valley.', reward:{ coins:50 } },
  { id:'smelter',     ic:'🔥', title:'Getting the Hang of It', metric:'steelworksLvl', target:3,
    desc:'Reach Smelting level 3 at the Furnace.',                        reward:{ coins:80 } },
  { id:'first_deals', ic:'⚖️', title:'A Knack for Trade',      metric:'trades',        target:3,
    desc:'Strike 3 deals at the Market Hall.',                            reward:{ coins:120 } },
  { id:'stockpile',   ic:'🏭', title:'Building a Stockpile',   metric:'goods',         target:10,
    desc:'Craft 10 finished goods at the Workshop.',                      reward:{ coins:150 } },
  { id:'dependable',  ic:'🚚', title:'A Dependable Name',      metric:'contracts',     target:3,
    desc:'Deliver 3 contracts at the Depot.',                             reward:{ coins:200 } },
  { id:'finding_way', ic:'🧭', title:'Finding Your Way',       metric:'totalLevel',    target:15,
    desc:'Reach total level 15 across your skills.',                      reward:{ coins:250 } },
  { id:'first_purse', ic:'🪙', title:'A Tidy Purse',           metric:'coinsEarned',   target:500,
    desc:'Earn 500 coins in total.',                                      reward:{ coins:150 } },
  { id:'settling_in', ic:'🌟', title:'Settling In',            metric:'totalLevel',    target:25,
    desc:'Reach total level 25 — you know your way around now.',          reward:{ coins:400 } },
];

// Objective met? (a beat's metric has reached its target)
export function beatComplete(beat: WelcomeBeat, ctx: Record<string, number>): boolean {
  return (ctx[beat.metric] || 0) >= beat.target;
}

// Progress toward a beat as {cur,max,pct}, clamped for display.
export function welcomeProgress(beat: WelcomeBeat, ctx: Record<string, number>){
  const cur = Math.max(0, Math.min(beat.target, ctx[beat.metric] || 0));
  return { cur, max: beat.target, pct: Math.round((cur / beat.target) * 100) };
}

// Index of the current (first unclaimed) beat; WELCOME_BEATS.length once all are claimed.
export function currentBeatIndex(claimedIds: string[]): number {
  for (let i = 0; i < WELCOME_BEATS.length; i++) if (!claimedIds.includes(WELCOME_BEATS[i].id)) return i;
  return WELCOME_BEATS.length;
}

// The current beat object, or null when the ladder is complete.
export function nextBeat(claimedIds: string[]): WelcomeBeat | null {
  const i = currentBeatIndex(claimedIds);
  return i < WELCOME_BEATS.length ? WELCOME_BEATS[i] : null;
}

export function allWelcomeDone(claimedIds: string[]): boolean {
  return WELCOME_BEATS.every(b => claimedIds.includes(b.id));
}

// The highest total-level target on the ladder — a save already past this is a
// veteran who should never see the starter tracker.
export function welcomeTopLevel(): number {
  return WELCOME_BEATS.filter(b => b.metric === 'totalLevel').reduce((m, b) => Math.max(m, b.target), 0);
}
