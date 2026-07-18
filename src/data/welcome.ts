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

// A longer, purpose-driven onboarding ladder. Each beat's `desc` teaches WHY the
// activity matters (not just what to do), and points at the breadth of the valley's
// trades — so by the end the player understands the whole loop, not just the tutorial
// chain. Gates use broadly-reachable metrics only, so the ladder never stalls on a
// niche skill; the copy still names the optional trades (woodcutting, fishing,
// foraging, cooking, farming) and what each is FOR.
export const WELCOME_BEATS: WelcomeBeat[] = [
  { id:'warmed_up',   ic:'✨', title:'Finding Your Feet',      metric:'actions',       target:12,
    desc:'Do 12 gathering or crafting actions. Everything in the valley starts with raw materials you gather yourself.', reward:{ coins:50 } },
  { id:'swing_of_it', ic:'💪', title:'The Swing of It',        metric:'swings',        target:12,
    desc:'Land 12 tool swings. Tap the rock or tree you\'re working (or press Space) to chop and mine noticeably faster.', reward:{ coins:70, item:'wood', qty:5 } },
  { id:'smelter',     ic:'🔥', title:'Into the Furnace',       metric:'steelworksLvl', target:3,
    desc:'Reach Smelting level 3. Raw ore is worth little — smelt it into bars, the backbone of every product you\'ll make.', reward:{ coins:90 } },
  { id:'stockpile',   ic:'🏭', title:'Building a Stockpile',   metric:'goods',         target:10,
    desc:'Craft 10 finished goods at the Workshop. Finished goods sell for far more than the materials they\'re made from.', reward:{ coins:140 } },
  { id:'first_deals', ic:'⚖️', title:'A Knack for Trade',      metric:'trades',        target:3,
    desc:'Strike 3 deals at the Market Hall. Prices dip when you dump stock, so sell in sensible batches and buy what you\'re short on.', reward:{ coins:120 } },
  { id:'dependable',  ic:'🚚', title:'A Dependable Name',      metric:'contracts',     target:3,
    desc:'Deliver 3 contracts at the Depot. Contracts are your steadiest, best-paying work — accept, fulfil, get paid.', reward:{ coins:200 } },
  { id:'forager',     ic:'🌿', title:'Living Off the Land',    metric:'actions',       target:40,
    desc:'Keep working the valley — and branch out: chop timber in the forest, cast a line at the pier, forage herbs & berries. Each feeds crafts, meals and coin.', reward:{ coins:180, item:'wild_herb', qty:3 } },
  { id:'finding_way', ic:'🧭', title:'Finding Your Way',       metric:'totalLevel',    target:15,
    desc:'Reach total level 15. Levelling any skill unlocks tougher, richer resources — cook your catch at the Café, or grow crops in your garden for hands-off income.', reward:{ coins:250 } },
  { id:'first_purse', ic:'🪙', title:'A Tidy Purse',           metric:'coinsEarned',   target:500,
    desc:'Earn 500 coins in total. Reinvest at the Town Hall for permanent upgrades — better tools and faster actions that pay for themselves.', reward:{ coins:150 } },
  { id:'settling_in', ic:'🌟', title:'Settling In',            metric:'totalLevel',    target:25,
    desc:'Reach total level 25 — you know your way around Featherstone now. The whole valley is open to you.', reward:{ coins:400 } },
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
