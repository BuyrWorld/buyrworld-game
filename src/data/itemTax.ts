// Milestone — coherent item taxonomy. One explicit category per item so the UI can
// stop presenting furniture-looking TRADE COMMODITIES as if they were placeable
// furniture. Pure + testable; main.ts reads these to label items and to decide what
// can be carried into the cottage decoration grid.

export type ItemCategory = 'raw' | 'commodity' | 'consumable' | 'furniture' | 'quest';

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  raw:        'Raw material',
  commodity:  'Trade commodity',
  consumable: 'Consumable',
  furniture:  'Placeable furniture',
  quest:      'Quest item',
};

// Raw materials: mined, chopped, caught, foraged or farmed in their natural state.
const RAW = new Set([
  'iron_ore', 'copper_ore', 'coal', 'bauxite', 'rare_earth', 'diamond',
  'wood', 'rare_wood',
  'sardine', 'mackerel', 'bass', 'salmon', 'tuna',
  'mushroom', 'berries', 'wild_herb',
  'carrot', 'tomato', 'sweetcorn', 'pumpkin', 'strawberry', 'sunflower',
]);

// Consumables: food + drink you make and use up.
const CONSUMABLE = new Set([
  'berry_jam', 'herb_tea', 'smoked_fish', 'spring_tonic', 'blossom_jam', 'lemonade',
  'honey_cake', 'spiced_cider', 'pickled_mushrooms', 'mulled_tea', 'winter_hamper',
  'berry_tart', 'mushroom_soup', 'grilled_sardines', 'forager_salad', 'fish_stew',
  'smoked_platter', 'fishermans_pie', 'celebration_feast',
]);

// Placeable furniture that ALSO trades as homeware (Finn's Furniture & Homeware stall).
// These were the confusing "furniture-looking commodities"; they are now genuinely
// placeable in the cottage (and still sellable). See FURNITURE in furniture.ts.
export const TRADE_FURNITURE = ['lamp', 'bookcase', 'vase', 'painting', 'fancy_rug'] as const;
const FURNITURE_ITEMS = new Set<string>(TRADE_FURNITURE);

// Quest items (story/keepsake). None are tradeable commodities today, but the
// category exists so quest items can never be mistaken for stock.
const QUEST = new Set<string>([]);

/** The single authoritative category for an item id. Unknown/processed goods that
 *  aren't raw/consumable/furniture/quest are trade commodities. Cottage furniture
 *  ids (furn_*) are furniture even though they aren't tradeable items. */
export function itemCategory(id: string): ItemCategory {
  if (!id) return 'commodity';
  if (id.startsWith('furn_') || FURNITURE_ITEMS.has(id)) return 'furniture';
  if (RAW.has(id)) return 'raw';
  if (CONSUMABLE.has(id)) return 'consumable';
  if (QUEST.has(id)) return 'quest';
  return 'commodity';
}

export function categoryLabel(id: string): string { return CATEGORY_LABELS[itemCategory(id)]; }

/** True when the item can be placed in the cottage decoration grid. */
export function isPlaceableItem(id: string): boolean { return itemCategory(id) === 'furniture'; }

/** True when a placeable furniture id is stocked from the warehouse (a tradeable
 *  homeware item) rather than the furniture-shop storage pool (furn_*). */
export function isTradeFurniture(id: string): boolean { return FURNITURE_ITEMS.has(id); }
