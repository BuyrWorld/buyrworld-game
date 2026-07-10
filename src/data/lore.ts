// @ts-nocheck
// Valley Lore — weathered waystones scattered across Featherstone Valley. Walk
// near one (or tap it) to uncover a fragment of the valley's history, deepening
// the world around the Founder's Trail. Pure/testable; map positions live in
// main.ts (they're coupled to the world grid), text and helpers live here.

export interface LoreStone {
  id: string;
  ic: string;
  title: string;
  hint: string;    // shown while still undiscovered, to guide exploration
  text: string;    // the fragment itself
}

export const LORE: LoreStone[] = [
  { id:'founding', ic:'📜', title:'The Founding Stone', hint:'On the village green.',
    text:"Weathered letters read: “Here Elias Featherstone drove the first waystone, and named the valley for the feather-light seeds that drift down from the hills each spring.”" },
  { id:'seam', ic:'⛏️', title:'The First Seam', hint:'At the quarry.',
    text:"A miner's tally is scratched deep into the rock. The elders swear Elias struck iron here on his very first morning — and that the whole valley was built outward from that one bright seam." },
  { id:'forge', ic:'🔥', title:'The Old Forge Fire', hint:'By the furnace.',
    text:"Blackened stones ring a long-cold hearth. They say the forge fire was never truly let go out: each new founder carries a single glowing coal from the last, so the flame is always the same flame." },
  { id:'wood', ic:'🌿', title:'The Whispering Wood', hint:'On the north forest path.',
    text:"A carved wooden sprite watches from the treeline. Wren's grandmother set it here with a promise: “Take only what the wood offers freely, and it will offer freely for a hundred years.”" },
  { id:'tide', ic:'🌊', title:'The Tide Marker', hint:'Down by the pier.',
    text:"Notches climb the old post — one for every high tide across a century. The lowest, deepest notch is labelled simply: “the year Elias sailed, and did not say where.”" },
  { id:'hearth', ic:'🏡', title:'The Hearthstone', hint:'At your own cottage door.',
    text:"Set into the doorstep of your cottage, almost worn smooth: “A founder's truest wealth is a warm hearth and a valley that remembers them. Tend both, and you tend everything.”" },
];

export function loreById(id: string): LoreStone | undefined {
  return LORE.find(l => l.id === id);
}
export function loreFound(found: Record<string, any>): number {
  return LORE.reduce((a, l) => a + (found && found[l.id] ? 1 : 0), 0);
}
export function isLoreComplete(found: Record<string, any>): boolean {
  return loreFound(found) >= LORE.length;
}
