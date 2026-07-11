// @ts-nocheck
// Artisan Commissions — crafting orders posted at the Artisan's Shed. Accept a
// commission, craft the requested goods, and hand it in for coins, Crafting XP
// and Artisan Reputation. Reputation unlocks higher-tier, better-paid orders.
// Pure/testable; the board UI + completion checks live in main.ts.

export interface CommissionDef { id: string; item: string; qty: number; tier: number; n: string; }

// Orders reference goods the player already produces (tracked in S.prod).
export const COMMISSION_DEFS: CommissionDef[] = [
  { id:'jam',        item:'berry_jam',   qty:3,  tier:1, n:'Village Bake Sale' },
  { id:'tea',        item:'herb_tea',    qty:4,  tier:1, n:'Tea Room Order' },
  { id:'bowl',       item:'carved_bowl', qty:3,  tier:1, n:'Craft Fair Stock' },
  { id:'jam_big',    item:'berry_jam',   qty:6,  tier:2, n:'Harvest Preserves' },
  { id:'smoked',     item:'smoked_fish', qty:4,  tier:2, n:'Smokehouse Supply' },
  { id:'basket',     item:'gift_basket', qty:2,  tier:2, n:'Hamper Commission' },
  { id:'bracket',    item:'bracket',     qty:10, tier:2, n:'Depot Brackets' },
  { id:'loom',       item:'wiring_loom', qty:5,  tier:3, n:'Wiring Contract' },
  { id:'gearbox',    item:'gearbox',     qty:4,  tier:3, n:'Gearbox Batch' },
  { id:'basket_big', item:'gift_basket', qty:5,  tier:3, n:'Festival Hampers' },
  { id:'servo',      item:'servo_unit',  qty:3,  tier:4, n:'Servo Delivery' },
  { id:'chassis',    item:'chassis',     qty:4,  tier:4, n:'Chassis Order' },
];

export function commissionById(id){ return COMMISSION_DEFS.find(c => c.id === id); }
// Reward scales with quantity, tier and the item's own value (passed in from main).
export function commissionCoins(def, itemValue){ return Math.round((itemValue || 1) * def.qty * (1.4 + def.tier * 0.25)); }
export function commissionXp(def){ return def.qty * (8 + def.tier * 6); }
export function commissionRep(def){ return def.tier; }

// Reputation gates: tier 1 always, tier 2 at 5 rep, tier 3 at 15, tier 4 at 30.
export function repTierUnlocked(rep){ return rep >= 30 ? 4 : rep >= 15 ? 3 : rep >= 5 ? 2 : 1; }
export function repTitle(rep){
  return rep >= 30 ? 'Master Artisan' : rep >= 15 ? 'Renowned Artisan' : rep >= 5 ? 'Journeyman' : 'Apprentice';
}
export function availableCommissions(rep){ return COMMISSION_DEFS.filter(d => d.tier <= repTierUnlocked(rep)); }

// Deterministic daily board of `count` distinct commissions for the player's rep.
export function rollCommissionBoard(seed, rep, count = 3){
  const pool = availableCommissions(rep).slice();
  let s = (seed >>> 0) || 1;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const picks = [];
  while (picks.length < Math.min(count, pool.length)){
    const i = Math.floor(rng() * pool.length);
    if (!picks.includes(pool[i].id)) picks.push(pool[i].id);
  }
  return picks;
}

export function commissionProgress(qty, made){ return Math.max(0, Math.min(qty, made)); }
export function commissionDone(qty, made){ return made >= qty; }
