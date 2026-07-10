// @ts-nocheck
// Renown — a meta-progression currency earned from achievements and spent on
// small permanent boosts at the Town Hall's "Hall of Renown". Pure/testable:
// the earned total is computed in main.ts (achievements live there) and passed
// in; everything here works off a plain { bought: {id:true} } record.

export interface RenownUpgrade {
  id: string;
  ic: string;
  name: string;
  desc: string;
  cost: number;                       // in renown points
  effect: { type: string; val: number };
  req?: string;                       // prerequisite upgrade id
}

// One renown point per achievement, plus a bonus point for the meatier ones
// (those worth ≥1000 coins). Kept here so the value curve is testable.
export function renownForAch(rewardCoins: number): number {
  return 1 + (rewardCoins >= 1000 ? 1 : 0);
}

export const RENOWN_UPGRADES: RenownUpgrade[] = [
  { id:'diligent',  ic:'📚', name:'Diligent Hands',   cost:3,
    desc:'+5% experience from every skill, forever.',        effect:{ type:'xp', val:0.05 } },
  { id:'diligent2', ic:'🎓', name:'Master of the Craft', cost:6, req:'diligent',
    desc:'A further +8% experience from every skill.',       effect:{ type:'xp', val:0.08 } },
  { id:'shrewd',    ic:'💰', name:'Shrewd Trader',     cost:3,
    desc:'+5% coins from every sale, forever.',              effect:{ type:'sell', val:0.05 } },
  { id:'shrewd2',   ic:'🏦', name:'Master Merchant',   cost:6, req:'shrewd',
    desc:'A further +8% coins from every sale.',             effect:{ type:'sell', val:0.08 } },
  { id:'rested',    ic:'☕', name:'Well Rested',       cost:4,
    desc:'Every activity is 4% faster.',                     effect:{ type:'speed', val:0.04 } },
  { id:'pockets',   ic:'📋', name:'Deep Pockets',      cost:5,
    desc:'+1 contract can be active at once.',               effect:{ type:'contract', val:1 } },
  { id:'nightowl',  ic:'🌙', name:'Night Owl',         cost:4,
    desc:'Idle earnings bank for 4 more hours while away.',  effect:{ type:'offline', val:4 } },
];

export function upgradeById(id: string): RenownUpgrade | undefined {
  return RENOWN_UPGRADES.find(u => u.id === id);
}
export function isBought(bought: Record<string, boolean>, id: string): boolean {
  return !!(bought && bought[id]);
}
// Total renown already committed to purchases.
export function renownSpent(bought: Record<string, boolean>): number {
  return RENOWN_UPGRADES.reduce((a, u) => a + (isBought(bought, u.id) ? u.cost : 0), 0);
}
export function renownAvailable(earned: number, bought: Record<string, boolean>): number {
  return Math.max(0, (earned || 0) - renownSpent(bought));
}
// Prerequisite met (or none), not already owned, and affordable.
export function canBuy(earned: number, bought: Record<string, boolean>, id: string): boolean {
  const u = upgradeById(id);
  if (!u || isBought(bought, id)) return false;
  if (u.req && !isBought(bought, u.req)) return false;
  return renownAvailable(earned, bought) >= u.cost;
}
export function locked(bought: Record<string, boolean>, id: string): boolean {
  const u = upgradeById(id);
  return !!(u && u.req && !isBought(bought, u.req));
}

// --- Combined effect accessors, all driven by the bought record ---
function sumEffect(bought: Record<string, boolean>, type: string): number {
  return RENOWN_UPGRADES.reduce((a, u) =>
    a + (u.effect.type === type && isBought(bought, u.id) ? u.effect.val : 0), 0);
}
export function renownXpMult(bought):      number { return 1 + sumEffect(bought, 'xp'); }
export function renownSellMult(bought):    number { return 1 + sumEffect(bought, 'sell'); }
export function renownSpeedMult(bought):   number { return Math.max(0.5, 1 - sumEffect(bought, 'speed')); }
export function renownContractBonus(bought): number { return Math.round(sumEffect(bought, 'contract')); }
export function renownOfflineHours(bought): number { return sumEffect(bought, 'offline'); }
