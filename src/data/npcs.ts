import data from './npcs.json';

export interface NPC { id: string; n: string; ic: string; title: string; lvl: number; quip: string; stock: string[]; }

export const MARKET_ROLL_MS = 3 * 60 * 1000;
export const NPCS: NPC[] = data as NPC[];
