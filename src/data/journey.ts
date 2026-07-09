// @ts-nocheck
// The Founder's Journey — an ordered, narrative quest chain that spans the whole
// game and gives long-term direction on top of the one-off achievements. Pure and
// testable: each stage's objective reads a plain `ctx` metrics object (assembled in
// main.ts from live state), so this module needs no game import. Stages are claimed
// strictly in order, so the journey reads as a story rather than a flat checklist.

export interface JourneyStage {
  id: string;
  ic: string;
  title: string;
  desc: string;                 // the narrative "what to do next"
  metric: string;               // key into the ctx metrics object
  target: number;               // objective is met when ctx[metric] >= target
  reward: { coins: number; title?: string };
}

export const JOURNEY: JourneyStage[] = [
  { id:'arrival',     ic:'🌅', title:'A New Beginning',        metric:'actions',        target:10,
    desc:'Get your hands dirty — complete 10 gathering or crafting actions around the valley.',
    reward:{ coins:60, title:'Newcomer' } },
  { id:'first_forge', ic:'🔥', title:'Sparks Fly',             metric:'steelworksLvl',  target:3,
    desc:'Fire up the furnace and reach Smelting level 3 — turn raw ore into honest bars.',
    reward:{ coins:120, title:'Apprentice' } },
  { id:'open_shop',   ic:'🤝', title:'Open for Business',      metric:'trades',         target:5,
    desc:'Strike 5 deals at the Market Hall — learn to buy low and sell high.',
    reward:{ coins:200, title:'Trader' } },
  { id:'supplier',    ic:'📦', title:'Reliable Supplier',      metric:'contracts',      target:10,
    desc:'Fulfil 10 contracts at the Depot — the valley learns it can count on you.',
    reward:{ coins:350, title:'Supplier' } },
  { id:'homestead',   ic:'🏡', title:'Putting Down Roots',     metric:'gardenHarvests', target:5,
    desc:'Tend your cottage garden and bring in 5 harvests.',
    reward:{ coins:300, title:'Homesteader' } },
  { id:'neighbour',   ic:'💖', title:'A Familiar Face',        metric:'friends',        target:3,
    desc:'Become Friends with 3 villagers — Featherstone is nothing without its people.',
    reward:{ coins:400, title:'Neighbour' } },
  { id:'established', ic:'📈', title:'Rising Reputation',      metric:'totalLevel',     target:100,
    desc:'Reach total level 100 — your name opens the Harbour District.',
    reward:{ coins:900, title:'Established' } },
  { id:'patron',      ic:'🌸', title:'Valley Patron',          metric:'beautification', target:5,
    desc:'Fund 5 beautification projects — leave the valley prettier than you found it.',
    reward:{ coins:700, title:'Patron' } },
  { id:'automator',   ic:'🤖', title:'The Automation Age',     metric:'automatons',     target:3,
    desc:'Put automatons to work on 3 different skills at the Automation Lab.',
    reward:{ coins:1200, title:'Industrialist' } },
  { id:'powered',     ic:'⚡', title:'Powering the Valley',    metric:'gridTier',       target:1,
    desc:'Bring the Power Grid online at the Data Centre (Tier 1 or above).',
    reward:{ coins:1500, title:'Magnate' } },
  { id:'legend',      ic:'👑', title:'Legend of Featherstone', metric:'totalLevel',     target:200,
    desc:'Reach total level 200 — every district open, your legacy complete.',
    reward:{ coins:6000, title:'Founder of Featherstone' } },
];

// Objective met? (a stage's metric has reached its target)
export function stageComplete(stage: JourneyStage, ctx: Record<string, number>): boolean {
  return (ctx[stage.metric] || 0) >= stage.target;
}

// Progress toward a stage as {cur,max,pct}, clamped for display.
export function stageProgress(stage: JourneyStage, ctx: Record<string, number>){
  const cur = Math.max(0, Math.min(stage.target, ctx[stage.metric] || 0));
  return { cur, max: stage.target, pct: Math.round((cur / stage.target) * 100) };
}

// Index of the current (first unclaimed) stage; JOURNEY.length once all are claimed.
export function currentStageIndex(claimedIds: string[]): number {
  for (let i = 0; i < JOURNEY.length; i++) if (!claimedIds.includes(JOURNEY[i].id)) return i;
  return JOURNEY.length;
}

// The current stage object, or null when the journey is complete.
export function currentStage(claimedIds: string[]): JourneyStage | null {
  const i = currentStageIndex(claimedIds);
  return i < JOURNEY.length ? JOURNEY[i] : null;
}

// Can the player claim right now? (current stage exists and its objective is met)
export function canClaim(claimedIds: string[], ctx: Record<string, number>): boolean {
  const s = currentStage(claimedIds);
  return !!s && stageComplete(s, ctx);
}

// The most recently earned title across claimed stages (for the HUD badge).
export function earnedTitle(claimedIds: string[]): string | null {
  let title: string | null = null;
  for (const s of JOURNEY) if (claimedIds.includes(s.id) && s.reward.title) title = s.reward.title;
  return title;
}

export function isJourneyComplete(claimedIds: string[]): boolean {
  return JOURNEY.every(s => claimedIds.includes(s.id));
}
