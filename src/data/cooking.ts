// @ts-nocheck
// The Village Kitchen — data-driven cooking. Combine the things you grow, catch
// and forage into plated meals that (a) sell at a premium and (b) can be eaten for
// a timed buff. Pure/testable: no game import — callers pass a plain items map and
// the player's total level. Meals are real items (see items.json); a single meal
// buff is active at a time (wired in main.ts via mealBuffMult).

export type MealBuffKind = 'speed' | 'xp' | 'sell';

export interface Recipe {
  id: string;
  ic: string;
  name: string;
  desc: string;
  in: Record<string, number>;   // ingredient item ids → qty consumed
  out: string;                  // meal item id produced (1 per cook)
  unlock: number;               // total level required (0 = available from the start)
  buff: { kind: MealBuffKind; mult: number; mins: number; label: string; ic: string };
}

// Buff mult convention (matches speedMult/grantXp/sellPrice): speed < 1 means faster
// (0.90 = 10% quicker actions); xp/sell > 1 means a bonus (1.15 = +15%).
export const RECIPES: Recipe[] = [
  { id:'berry_tart', ic:'🥧', name:'Berry Tart', unlock:0,
    desc:'A warm, sweet tart — a little pep in your step.',
    in:{ berries:5, wild_herb:1 }, out:'berry_tart',
    buff:{ kind:'speed', mult:0.90, mins:5, label:'Well Fed', ic:'🥧' } },
  { id:'mushroom_soup', ic:'🍲', name:'Wild Mushroom Soup', unlock:0,
    desc:'Earthy and warming. Sharpens the mind for study.',
    in:{ mushroom:4, wild_herb:2 }, out:'mushroom_soup',
    buff:{ kind:'xp', mult:1.10, mins:6, label:'Sharp Mind', ic:'🍲' } },
  { id:'grilled_sardines', ic:'🍢', name:'Grilled Sardines', unlock:8,
    desc:'Simple coastal fare, full of quick energy.',
    in:{ sardine:5, wild_herb:1 }, out:'grilled_sardines',
    buff:{ kind:'speed', mult:0.88, mins:6, label:'Sea Legs', ic:'🍢' } },
  { id:'forager_salad', ic:'🥗', name:"Forager's Salad", unlock:15,
    desc:'Crisp and fresh — villagers pay a fine price for it.',
    in:{ berries:3, wild_herb:3, mushroom:3 }, out:'forager_salad',
    buff:{ kind:'sell', mult:1.12, mins:8, label:'Fine Palate', ic:'🥗' } },
  { id:'fish_stew', ic:'🥘', name:'Featherstone Fish Stew', unlock:25,
    desc:'A hearty stew that keeps you going all day.',
    in:{ mackerel:2, bass:1, wild_herb:2 }, out:'fish_stew',
    buff:{ kind:'speed', mult:0.85, mins:8, label:'Hearty Meal', ic:'🥘' } },
  { id:'smoked_platter', ic:'🍽️', name:'Smoked Fish Platter', unlock:30,
    desc:'A refined platter served with herb tea. Clears the head.',
    in:{ smoked_fish:2, herb_tea:1 }, out:'smoked_platter',
    buff:{ kind:'xp', mult:1.15, mins:8, label:'Focused', ic:'🍽️' } },
  { id:'fishermans_pie', ic:'🥮', name:"Fisherman's Pie", unlock:40,
    desc:'The catch of the day, baked to golden perfection.',
    in:{ salmon:1, bass:1, mushroom:2 }, out:'fishermans_pie',
    buff:{ kind:'sell', mult:1.18, mins:10, label:'Market Favourite', ic:'🥮' } },
  { id:'celebration_feast', ic:'🍱', name:'Celebration Feast', unlock:60,
    desc:'A feast fit for the whole valley — the finest you can cook.',
    in:{ tuna:1, salmon:1, berries:5, mushroom:3, wild_herb:3 }, out:'celebration_feast',
    buff:{ kind:'speed', mult:0.80, mins:12, label:'Feasted', ic:'🍱' } },
];

export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find(r => r.id === id);
}

export function recipeUnlocked(r: Recipe, totalLevel: number): boolean {
  return totalLevel >= (r.unlock || 0);
}

// Do we hold enough of every ingredient to cook this once?
export function canCook(r: Recipe, items: Record<string, number>): boolean {
  return Object.entries(r.in).every(([id, q]) => (items[id] || 0) >= q);
}

// How many times could we cook this with what we hold (0 if any ingredient missing).
export function maxCookable(r: Recipe, items: Record<string, number>): number {
  const counts = Object.entries(r.in).map(([id, q]) => Math.floor((items[id] || 0) / q));
  return counts.length ? Math.max(0, Math.min(...counts)) : 0;
}

export function buffDurationMs(r: Recipe): number {
  return r.buff.mins * 60 * 1000;
}

// Recipes the player can currently see (unlocked), in menu order.
export function availableRecipes(totalLevel: number): Recipe[] {
  return RECIPES.filter(r => recipeUnlocked(r, totalLevel));
}
