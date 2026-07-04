export interface Upgrade {
  id: string;
  skill: string;
  n: string;
  ic: string;
  cost: number;
  mult?: number;
  pay?: number;
  ds: string;
  req?: string;
}

export const UPGRADES: Upgrade[] = [
  { id: 'pick1',  skill: 'mining',        n: 'Steel Pickaxe',     ic: '⛏️', cost: 250,   mult: 0.85, ds: 'Mining actions 15% faster.' },
  { id: 'pick2',  skill: 'mining',        n: 'Hydraulic Drill',   ic: '🛠️', cost: 2500,  mult: 0.70, ds: 'Mining actions 30% faster.', req: 'pick1' },
  { id: 'pick3',  skill: 'mining',        n: 'Plasma Bore',       ic: '⚡', cost: 20000, mult: 0.55, ds: 'Mining actions 45% faster.', req: 'pick2' },
  { id: 'furn1',  skill: 'steelworks',    n: 'Blast Furnace',     ic: '🔥', cost: 400,   mult: 0.85, ds: 'Steelworks 15% faster.' },
  { id: 'furn2',  skill: 'steelworks',    n: 'Induction Furnace', ic: '🌡️', cost: 3500,  mult: 0.70, ds: 'Steelworks 30% faster.', req: 'furn1' },
  { id: 'line1',  skill: 'manufacturing', n: 'Assembly Line',     ic: '🏭', cost: 600,   mult: 0.85, ds: 'Manufacturing 15% faster.' },
  { id: 'line2',  skill: 'manufacturing', n: 'Robotic Cell',      ic: '🤖', cost: 5000,  mult: 0.70, ds: 'Manufacturing 30% faster.', req: 'line1' },
  { id: 'fleet1', skill: 'logistics',     n: 'Van Fleet',         ic: '🚐', cost: 500,   pay: 1.15,  ds: 'Contract payouts +15%.' },
  { id: 'fleet2', skill: 'logistics',     n: 'HGV Fleet',         ic: '🚛', cost: 4500,  pay: 1.30,  ds: 'Contract payouts +30%.', req: 'fleet1' },
  { id: 'fleet3', skill: 'logistics',     n: 'Rail Freight Deal', ic: '🚆', cost: 32000, pay: 1.55,  ds: 'Contract payouts +55%.', req: 'fleet2' },
];
