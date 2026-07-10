// @ts-nocheck
// Farming — expands the cottage garden into a full skill. Crops are gated by
// farming level; harvesting grants Farming XP. Watering speeds a plot and
// fertiliser boosts its yield. Pure/testable; the garden UI + growth loop live
// in main.ts (state: S.garden slots, S.skills.farming).

export interface FarmCrop {
  id: string; n: string; ic: string;
  lvl: number;          // farming level required to sow
  seedCost: number;     // coins to plant
  ms: number;           // grow time
  out: Record<string, number>;
  xp: number;           // farming XP on harvest
  desc: string;
}

export const FARM_CROPS: FarmCrop[] = [
  { id:'berry_bush',    n:'Berry Bush',     ic:'🫐', lvl:1,  seedCost:15, ms:20*60*1000, out:{ berries:6 },              xp:14,  desc:'Juicy berries for jams and requests.' },
  { id:'herb_patch',    n:'Herb Patch',     ic:'🌿', lvl:1,  seedCost:20, ms:30*60*1000, out:{ wild_herb:4 },            xp:20,  desc:'Aromatic herbs for teas and tonics.' },
  { id:'carrot_row',    n:'Carrot Row',     ic:'🥕', lvl:3,  seedCost:18, ms:24*60*1000, out:{ carrot:5 },               xp:24,  desc:'Crunchy roots the whole valley loves.' },
  { id:'mushroom_log',  n:'Mushroom Log',   ic:'🍄', lvl:5,  seedCost:25, ms:45*60*1000, out:{ mushroom:5 },             xp:34,  desc:'Grows best in shade. Steady yield.' },
  { id:'tomato_vine',   n:'Tomato Vine',    ic:'🍅', lvl:8,  seedCost:30, ms:40*60*1000, out:{ tomato:5 },               xp:42,  desc:'Plump and sun-ripened.' },
  { id:'wildflower',    n:'Wildflowers',    ic:'🌸', lvl:11, seedCost:30, ms:60*60*1000, out:{ berries:3, wild_herb:2 }, xp:52,  desc:'Pretty and useful. Bees love them.' },
  { id:'sweetcorn',     n:'Sweetcorn',      ic:'🌽', lvl:15, seedCost:42, ms:55*60*1000, out:{ sweetcorn:5 },            xp:64,  desc:'Golden cobs for the autumn table.' },
  { id:'pumpkin_patch', n:'Pumpkin Patch',  ic:'🎃', lvl:21, seedCost:55, ms:75*60*1000, out:{ pumpkin:4 },              xp:90,  desc:'Big, hearty and richly priced.' },
  { id:'strawberry',    n:'Strawberry Bed', ic:'🍓', lvl:27, seedCost:60, ms:65*60*1000, out:{ strawberry:6 },           xp:105, desc:'Sweet summer berries, always in demand.' },
  { id:'sunflower',     n:'Sunflowers',     ic:'🌻', lvl:34, seedCost:80, ms:90*60*1000, out:{ sunflower:4 },            xp:140, desc:'Towering blooms and rich seeds.' },
];

export const MAX_PLOTS = 6;
export const WATER_FRACTION = 0.25;   // watering cuts this fraction off the total grow time
export const WATER_COST = 5;
export const FERTILISE_MULT = 1.5;    // fertiliser multiplies the harvest yield
export const FERTILISE_COST = 25;

export function cropById(id){ return FARM_CROPS.find(c => c.id === id); }
export function cropsForLevel(level){ return FARM_CROPS.filter(c => c.lvl <= (level || 1)); }

// Extra plots earned purely from farming level, on top of the cottage-tier plots.
export function farmPlotBonus(level){ return (level >= 15 ? 1 : 0) + (level >= 30 ? 1 : 0); }

// Total unlocked plots = cottage-tier plots (max 4) + farming bonus, capped.
export function plotsUnlocked(homeTier, level){
  const base = Math.min(4, Math.max(0, homeTier || 0));
  return Math.min(MAX_PLOTS, base + farmPlotBonus(level || 1));
}

// Milliseconds shaved off when a plot is watered (of the crop's total grow time).
export function waterReductionMs(crop){ return Math.round((crop?.ms || 0) * WATER_FRACTION); }

// Apply fertiliser to a crop's yield map.
export function fertilisedYield(out){
  const y = {};
  for (const [id, q] of Object.entries(out || {})) y[id] = Math.round(q * FERTILISE_MULT);
  return y;
}
