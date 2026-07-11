// Contracts 2.0 — procedural delivery contracts with tiers, deadlines and
// per-client reputation, priced against the living economy. The generation is
// pure/testable here; the runtime board, timers and UI live in main.ts.
// Everything is additive over the original {client,item,qty,coins,xp} shape.

export interface ContractSpec {
  item: string;
  minLvl: number;
}

export const CLIENTS: string[] = [
  'Greenfield Growers Co-op',
  'Port Salvo Chandlers',
  'Valley Rail Maintenance',
  'Bramble & Sons Ironmongers',
  'OmniProcure PLC (they pay late)',
  'The Night Shift Collective',
  'Dockside Repair Guild',
  'Frostline Advance Party',
];

export const CONTRACT_POOL: ContractSpec[] = [
  { item: 'bracket',     minLvl: 1  },
  { item: 'iron_bar',    minLvl: 1  },
  { item: 'wiring_loom', minLvl: 6  },
  { item: 'steel_bar',   minLvl: 10 },
  { item: 'gearbox',     minLvl: 14 },
  { item: 'alu_ingot',   minLvl: 20 },
  { item: 'chassis',     minLvl: 26 },
  { item: 'tech_alloy',  minLvl: 40 },
  { item: 'servo_unit',  minLvl: 46 },
];

// ---- Contract tiers -------------------------------------------------------
// Each open contract is one of these. Rush = short fuse, premium pay; Bulk =
// large order, thinner unit pay; Standard = the dependable baseline.
export type ContractTier = 'standard' | 'rush' | 'bulk';

export interface TierDef {
  id: ContractTier;
  label: string;
  ic: string;
  qtyMult: number;      // scales the base order size
  payMult: number;      // scales per-unit pay
  deadlineMin: number;  // real minutes on the clock
  weight: number;       // roll weighting
  repGain: number;      // client reputation earned on time
  repLoss: number;      // client reputation lost on expiry
}

export const CONTRACT_TIERS: TierDef[] = [
  { id: 'standard', label: 'Standard', ic: '📋', qtyMult: 1.0, payMult: 1.00, deadlineMin: 20, weight: 5, repGain: 2, repLoss: 2 },
  { id: 'rush',     label: 'Rush',     ic: '⚡', qtyMult: 0.8, payMult: 1.55, deadlineMin: 8,  weight: 3, repGain: 4, repLoss: 3 },
  { id: 'bulk',     label: 'Bulk',     ic: '📦', qtyMult: 2.2, payMult: 0.85, deadlineMin: 35, weight: 2, repGain: 3, repLoss: 2 },
];

export function tierById(id: string): TierDef {
  return CONTRACT_TIERS.find(t => t.id === id) || CONTRACT_TIERS[0];
}

// Deterministically pick a tier from an rng value in [0,1).
export function pickTier(r: number): TierDef {
  const total = CONTRACT_TIERS.reduce((a, t) => a + t.weight, 0);
  let x = Math.max(0, Math.min(0.999999, r)) * total;
  for (const t of CONTRACT_TIERS) { if (x < t.weight) return t; x -= t.weight; }
  return CONTRACT_TIERS[0];
}

export function contractDeadlineMs(tier: string, now: number): number {
  return now + tierById(tier).deadlineMin * 60 * 1000;
}

export function repDeltaOnDeliver(tier: string): number { return tierById(tier).repGain; }
export function repDeltaOnExpire(tier: string): number { return -tierById(tier).repLoss; }

// ---- Client reputation ----------------------------------------------------
export interface RepRank { min: number; name: string; stars: number; }
export const REP_RANKS: RepRank[] = [
  { min: 0,  name: 'New client', stars: 0 },
  { min: 6,  name: 'Known',      stars: 1 },
  { min: 16, name: 'Trusted',    stars: 2 },
  { min: 32, name: 'Preferred',  stars: 3 },
  { min: 60, name: 'Partner',    stars: 4 },
];

export function repRank(rep: number): RepRank {
  let r = REP_RANKS[0];
  for (const x of REP_RANKS) { if ((rep || 0) >= x.min) r = x; }
  return r;
}

// Reputation sweetens the payout — up to +25% for your best clients.
export function repPayBonus(rep: number): number {
  return 1 + Math.min(0.25, Math.max(0, rep || 0) * 0.004);
}

// Once you're a reliable partner across the valley, you can juggle one extra
// contract at a time.
export function repSlotBonus(totalRep: number): number {
  return (totalRep || 0) >= 40 ? 1 : 0;
}

// ---- Economy link ---------------------------------------------------------
// Contract pay leans on the living economy's macro demand, but gently (±20%)
// so a downturn stings without gutting the core loop.
export function demandPayFactor(demand: number): number {
  return Math.max(0.8, Math.min(1.2, demand || 1));
}

// ---- Pure contract roll ---------------------------------------------------
export interface RollOpts {
  pool: ContractSpec[];                 // already filtered to affordable items (non-empty)
  clients: string[];
  itemValue: (id: string) => number;
  mLvl: number;                         // manufacturing level (sizes orders)
  repOf: (client: string) => number;    // current reputation with a client
  demand: number;                       // macro demand factor from economy.ts
  now: number;
}

export interface Contract {
  client: string;
  item: string;
  qty: number;
  coins: number;
  xp: number;
  tier: ContractTier;
  repAtOffer: number;
  deadline: number;
}

export function rollContract(rng: () => number, o: RollOpts): Contract {
  const pool = o.pool.length ? o.pool : CONTRACT_POOL;
  const spec = pool[Math.floor(rng() * pool.length)];
  const tier = pickTier(rng());
  const v = o.itemValue(spec.item) || 1;
  const baseQty = Math.max(2, Math.floor(2 + rng() * 4 + (o.mLvl || 0) / 8));
  const qty = Math.max(2, Math.round(baseQty * tier.qtyMult));
  const client = o.clients[Math.floor(rng() * o.clients.length)];
  const rep = o.repOf ? o.repOf(client) : 0;
  const coins = Math.round(
    v * qty * (1.5 + rng() * 0.5) * tier.payMult * demandPayFactor(o.demand) * repPayBonus(rep)
  );
  const xp = Math.round(v * qty * 0.45 * tier.qtyMult) + 10;
  return { client, item: spec.item, qty, coins, xp, tier: tier.id, repAtOffer: rep, deadline: contractDeadlineMs(tier.id, o.now) };
}

export function isExpired(c: { deadline?: number }, now: number): boolean {
  return !!c && !!c.deadline && now >= c.deadline;
}
