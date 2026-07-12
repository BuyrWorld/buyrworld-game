// Steam Deck / controller UI foundation — pure, testable helpers. No DOM here.
// main.ts wires these into the nav category strip, the focus-ring manager, the
// quantity selector and the controller-prompt footer.

export interface NavGroup { id: string; label: string; ic: string; }
// The five top-level categories the whole game collapses into.
export const NAV_GROUPS: NavGroup[] = [
  { id: 'world',    label: 'WORLD',    ic: '🗺️' },
  { id: 'work',     label: 'WORK',     ic: '⚒️' },
  { id: 'life',     label: 'LIFE',     ic: '🌿' },
  { id: 'progress', label: 'PROGRESS', ic: '📈' },
  { id: 'system',   label: 'SYSTEM',   ic: '⚙️' },
];
export const NAV_GROUP_ORDER = NAV_GROUPS.map(g => g.id);

// Which category each nav tab belongs to.
export const TAB_GROUP: Record<string, string> = {
  village: 'world',
  mining: 'work', steelworks: 'work', manufacturing: 'work', woodcutting: 'work', fishing: 'work', contracts: 'work', trade: 'work',
  pets: 'life', character: 'life',
  upgrades: 'progress', ach: 'progress',
  settings: 'system',
};
export function groupOf(tabId: string): string { return TAB_GROUP[tabId] || 'world'; }
export function groupById(id: string): NavGroup | null { return NAV_GROUPS.find(g => g.id === id) || null; }
export function groupIndex(id: string): number { return NAV_GROUP_ORDER.indexOf(id); }

// Cycle to the previous/next category, skipping any with no available tabs.
// `available` is the set/array of group ids that currently have ≥1 unlocked tab.
export function cycleGroup(currentId: string, dir: number, available?: string[]): string {
  const order = available && available.length
    ? NAV_GROUP_ORDER.filter(id => available.includes(id))
    : NAV_GROUP_ORDER.slice();
  if (!order.length) return currentId;
  let i = order.indexOf(currentId);
  if (i < 0) i = 0;
  const step = dir >= 0 ? 1 : -1;
  return order[(i + step + order.length) % order.length];
}

// ---- Quantity selector (Buy / Sell / Max) --------------------------------
export const QTY_STEPS = [1, 5, 10, 25, 50, 100, 250, 1000];
export function clampQty(n: number, max: number, min = 1): number {
  let v = Math.floor(Number(n));
  if (!isFinite(v) || isNaN(v)) v = min;
  const hi = Math.max(min, Math.floor(max) || min);
  return Math.max(min, Math.min(hi, v));
}
// Step up/down through QTY_STEPS relative to the current value (nearest step),
// clamped to [1, max]. Used by the ± controls and shoulder nudges.
export function stepQty(cur: number, dir: number, max: number): number {
  const hi = Math.max(1, Math.floor(max) || 1);
  const steps = QTY_STEPS.filter(s => s <= hi);
  if (!steps.includes(hi)) steps.push(hi);
  steps.sort((a, b) => a - b);
  const c = clampQty(cur, hi);
  if (dir >= 0) return steps.find(s => s > c) ?? hi;
  const below = steps.filter(s => s < c);
  return below.length ? below[below.length - 1] : 1;
}

// ---- Focus ring traversal ------------------------------------------------
// Wrap an index by ±1 over a list length (−1 when empty). DOM-order traversal.
export function wrapIndex(cur: number, len: number, dir: number): number {
  if (len <= 0) return -1;
  if (cur < 0) return dir >= 0 ? 0 : len - 1;
  return (cur + (dir >= 0 ? 1 : -1) + len) % len;
}

// ---- Controller prompts (footer hints) -----------------------------------
export interface Prompt { btn: string; label: string; }
// Base hint set; main.ts swaps a couple of entries by context (world vs menu).
export function controllerPrompts(ctx: 'world' | 'menu' | 'modal'): Prompt[] {
  if (ctx === 'modal') return [
    { btn: 'Ⓐ', label: 'Select' }, { btn: 'Ⓑ', label: 'Close' },
    { btn: '✥', label: 'Move' },
  ];
  if (ctx === 'menu') return [
    { btn: 'Ⓐ', label: 'Confirm' }, { btn: 'Ⓑ', label: 'Back' },
    { btn: 'Ⓨ', label: 'Inventory' }, { btn: 'LB/RB', label: 'Category' },
    { btn: '✥', label: 'Focus' }, { btn: '☰', label: 'Menu' },
  ];
  return [
    { btn: 'Ⓐ', label: 'Interact' }, { btn: 'Ⓑ', label: 'Back' },
    { btn: 'Ⓧ', label: 'Journey' }, { btn: 'Ⓨ', label: 'Inventory' },
    { btn: 'LB/RB', label: 'Category' }, { btn: '✥', label: 'Focus' },
    { btn: '🕹', label: 'Move' }, { btn: '☰', label: 'Menu' },
  ];
}

// ---- Colour-independent status -------------------------------------------
// Map a semantic status to a shape/letter glyph so meaning never relies on hue.
export const STATUS_GLYPH: Record<string, string> = {
  good: '✔', up: '▲', down: '▼', warn: '▲!', bad: '✖', neutral: '＝', locked: '🔒', active: '●',
};
export function statusGlyph(kind: string): string { return STATUS_GLYPH[kind] || '•'; }
