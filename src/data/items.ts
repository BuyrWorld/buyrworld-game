import data from './items.json';

export interface Item { n: string; ic: string; v: number; }

export const ITEMS: Record<string, Item> = data as Record<string, Item>;
