export interface Pet {
  id: string;
  n: string;
  ic: string;
  rar: 'common' | 'rare' | 'legendary';
  src: string;
  chance: number;
  ds: string;
}

export const PETS: Pet[] = [
  { id: 'forklift_fox',    n: 'Forklift Fox',    ic: '🦊', rar: 'rare',      src: 'mining',        chance: 1/350, ds: '+12% Mining speed while active.' },
  { id: 'drone_owl',       n: 'Drone Owl',       ic: '🦉', rar: 'rare',      src: 'manufacturing', chance: 1/350, ds: '+12% Manufacturing speed while active.' },
  { id: 'container_crab',  n: 'Container Crab',  ic: '🦀', rar: 'rare',      src: 'contract',      chance: 1/45,  ds: '+15% contract payouts while active.' },
  { id: 'rail_rhino',      n: 'Rail Rhino',      ic: '🦏', rar: 'legendary', src: 'contract',      chance: 1/250, ds: '+30% contract payouts while active.' },
  { id: 'cargo_turtle',    n: 'Cargo Turtle',    ic: '🐢', rar: 'legendary', src: 'steelworks',    chance: 1/900, ds: 'Steelworks actions cost 1 less input (min 1).' },
  { id: 'warehouse_panda', n: 'Warehouse Panda', ic: '🐼', rar: 'rare',      src: 'trading',       chance: 1/120, ds: '+5% better buy & sell prices while active.' },
  { id: 'occy',           n: 'Crafty Occy',    ic: '🐙', rar: 'legendary', src: 'crafting',      chance: 1/600, ds: 'Crafting actions occasionally yield a bonus item.' },
];
