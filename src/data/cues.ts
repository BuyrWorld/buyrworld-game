// @ts-nocheck
// Buyable pool cues. Each gives a slight edge: a firmer hit (power) and a longer
// aim projection (aim). Pure/testable; the shop UI and effects live in main.ts.

export interface Cue {
  id: string; n: string; ic: string;
  cost: number;      // coins (0 = starter)
  power: number;     // launch-velocity multiplier
  aim: number;       // aim-projection length multiplier
  ds: string;
}

export const CUES: Cue[] = [
  { id: 'house',  n: 'House Cue',   ic: '🎱', cost: 0,    power: 1.00, aim: 1.0, ds: 'The pub cue — chalked and ready. Does the job.' },
  { id: 'oak',    n: 'Oak Cue',     ic: '🪵', cost: 450,  power: 1.06, aim: 1.4, ds: 'A little more power and a longer aim line.' },
  { id: 'ash',    n: 'Ash Pro',     ic: '✨', cost: 1600, power: 1.10, aim: 1.8, ds: 'Tour-grade shaft — firmer break, clearer aim.' },
  { id: 'master', n: 'Master Cue',  ic: '🏆', cost: 5200, power: 1.15, aim: 2.3, ds: 'The finest tip in the valley — full aim projection.' },
];

export function cueById(id){ return CUES.find(c => c.id === id) || CUES[0]; }
export function cuePower(id){ return cueById(id).power; }
export function cueAim(id){ return cueById(id).aim; }
export function cueOwned(owned, id){ return id === 'house' || (Array.isArray(owned) && owned.includes(id)); }
export function canBuyCue(coins, owned, id){
  const c = cueById(id);
  return !cueOwned(owned, id) && coins >= c.cost;
}
