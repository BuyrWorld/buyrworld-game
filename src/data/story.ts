// @ts-nocheck
// The Founder's Trail — a light story arc that unfolds as you play, telling the
// tale of Elias Featherstone, the valley's first founder, and your place as his
// successor. Chapters advance when their objective (read from a plain metrics ctx)
// is met, so this stays pure/testable. Narrative flavour lives here; UI in main.ts.

export interface StoryChapter {
  id: string;
  ic: string;
  title: string;
  story: string;          // the narrative beat
  objText: string;        // what to do to continue
  metric: string;         // key into the ctx metrics object
  target: number;
  reward: { coins: number; title?: string };
}

export const STORY: StoryChapter[] = [
  { id:'notice', ic:'📜', title:'A Faded Notice', metric:'actions', target:1,
    story:"Pinned behind the newer notices is a yellowed page, its ink long faded. “To whomever revives our valley,” it begins — signed only “E.F.” The villagers say it has hung there longer than any of them can remember.",
    objText:"Get to work in the valley (complete any activity).",
    reward:{ coins:50 } },
  { id:'elder', ic:'👵', title:'The Elder Remembers', metric:'npcMet', target:1,
    story:"Old Agnes leans in close. “E.F.? That'll be Elias Featherstone — the very first founder. Built the whole supply chain up from nothing, he did… then one autumn he simply left, saying the valley would find its next founder when it was ready.”",
    objText:"Meet one of the villagers (tap a neighbour).",
    reward:{ coins:80 } },
  { id:'forge', ic:'🔨', title:"The Founder's Forge", metric:'goods', target:20,
    story:"Agnes points you to a tumbledown workshop at the quarry's edge. “Elias's first forge, that was. If you're truly his successor, you'll get the old trade humming again.”",
    objText:"Manufacture 20 components in the Workshop.",
    reward:{ coins:150 } },
  { id:'bottle', ic:'🌊', title:'A Message in the Deep', metric:'voyages', target:1,
    story:"Reg the harbourmaster hands you a barnacled bottle dredged from the bay. Inside: a scrap of Elias's ledger and a set of coordinates. “Charter a boat,” Reg says. “Whatever he hid out there, it's yours to find now.”",
    objText:"Send a boat on an ocean voyage and bring it home.",
    reward:{ coins:250 } },
  { id:'legacy', ic:'🏛️', title:"Elias's Legacy", metric:'totalLevel', target:60,
    story:"The voyage returns with a founder's seal and one last note: “The valley was never mine to keep — only to pass on. Tend it well, and one day pass it on yourself.” The village raises a small monument on the green in your honour.",
    objText:"Grow into an established founder (total level 60).",
    reward:{ coins:500, title:"Elias's Heir" } },
];

export function chapterComplete(ch: StoryChapter, ctx: Record<string, number>): boolean {
  return (ctx[ch.metric] || 0) >= ch.target;
}
export function chapterProgress(ch: StoryChapter, ctx: Record<string, number>){
  const cur = Math.max(0, Math.min(ch.target, ctx[ch.metric] || 0));
  return { cur, max: ch.target, pct: Math.round((cur / ch.target) * 100) };
}
export function currentChapterIndex(done: number): number {
  return Math.max(0, Math.min(STORY.length, done || 0));
}
export function currentChapter(done: number): StoryChapter | null {
  const i = currentChapterIndex(done);
  return i < STORY.length ? STORY[i] : null;
}
export function isStoryComplete(done: number): boolean {
  return (done || 0) >= STORY.length;
}
