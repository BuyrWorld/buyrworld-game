export interface NPC {
  id: string;
  n: string;
  ic: string;
  title: string;
  lvl: number;
  quip: string;
  stock: string[];
}

export const MARKET_ROLL_MS = 3 * 60 * 1000;

export const NPCS: NPC[] = [
  {
    id: 'marge', n: 'Marge', ic: '👩‍🌾',
    title: 'Greenfield Ore Broker', lvl: 1,
    quip: 'Cash for rocks, rocks for cash. No invoices, no drama.',
    stock: ['iron_ore', 'copper_ore', 'coal', 'bauxite'],
  },
  {
    id: 'bolt', n: 'Bolt', ic: '🧑‍🏭',
    title: 'Rustbelt Scrap Dealer', lvl: 10,
    quip: "Everything's refurbished. Even the refurbishments.",
    stock: ['iron_bar', 'copper_wire', 'steel_bar', 'alu_ingot'],
  },
  {
    id: 'perry', n: 'Perry', ic: '🧑‍✈️',
    title: 'Port Salvo Freight Agent', lvl: 25,
    quip: 'If it fits in a container, I know someone who wants it.',
    stock: ['bracket', 'wiring_loom', 'gearbox', 'chassis', 'rare_earth'],
  },
];
