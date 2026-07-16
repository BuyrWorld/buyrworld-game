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

// Cycle to the previous/next SCREEN (tab) within the current category — LT/RT.
// `tabIds` is the ordered list of unlocked tab ids in the active group.
export function cycleTab(tabIds: string[], currentId: string, dir: number): string {
  if (!tabIds.length) return currentId;
  let i = tabIds.indexOf(currentId);
  if (i < 0) i = 0;
  const step = dir >= 0 ? 1 : -1;
  return tabIds[(i + step + tabIds.length) % tabIds.length];
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

// ---- The documented input contract (one source of truth) ------------------
// Rendered in the Controls reference and mirrored by the actual bindings in
// main.ts (gamepad poll + keydown). Keep this in sync with those bindings.
export type InputMethod = 'gamepad' | 'keyboard' | 'pointer';
export interface ContractRow { action: string; gamepad: string; keyboard: string; }
export const INPUT_CONTRACT: ContractRow[] = [
  { action: 'Move character',         gamepad: 'Left stick',  keyboard: 'WASD' },
  { action: 'Navigate UI focus',      gamepad: 'D-pad',       keyboard: 'Arrow keys' },
  { action: 'Confirm / interact',     gamepad: 'Ⓐ',          keyboard: 'Enter / E' },
  { action: 'Back / close',           gamepad: 'Ⓑ',          keyboard: 'Esc' },
  { action: 'Change category',        gamepad: 'LB / RB',     keyboard: '[ / ]' },
  { action: 'Change screen in tab',   gamepad: 'LT / RT',     keyboard: '- / =' },
  { action: 'Inventory',              gamepad: 'Ⓨ',          keyboard: 'I' },
  { action: 'Journey (progress)',     gamepad: 'Ⓧ',          keyboard: 'J' },
  { action: 'Objectives / Journal',   gamepad: 'View',        keyboard: 'O' },
  { action: 'Pause',                  gamepad: 'Menu ☰',      keyboard: 'Esc (in world)' },
];

// ---- Controller prompts (footer hints) -----------------------------------
export interface Prompt { btn: string; label: string; kb?: string }
// Map a gamepad glyph to the equivalent keyboard key label (for the "keyboard"
// prompt style, shown when the keyboard was the most recently used input).
const KB_GLYPH: Record<string, string> = {
  'Ⓐ': 'Enter', 'Ⓑ': 'Esc', 'Ⓧ': 'J', 'Ⓨ': 'I', '✥': 'Arrows', '🕹': 'WASD',
  '☰': 'Esc', 'LB/RB': '[ ]', 'LT/RT': '- =', 'View': 'Tab',
};
// Base hint set; main.ts swaps a couple of entries by context (world vs menu).
export function controllerPrompts(ctx: 'world' | 'menu' | 'modal'): Prompt[] {
  if (ctx === 'modal') return [
    { btn: 'Ⓐ', label: 'Select' }, { btn: 'Ⓑ', label: 'Close' },
    { btn: '✥', label: 'Move' },
  ];
  if (ctx === 'menu') return [
    { btn: 'Ⓐ', label: 'Confirm' }, { btn: 'Ⓑ', label: 'Back' },
    { btn: 'Ⓨ', label: 'Inventory' }, { btn: 'LB/RB', label: 'Category' },
    { btn: 'LT/RT', label: 'Screen' }, { btn: '✥', label: 'Focus' }, { btn: '☰', label: 'Menu' },
  ];
  return [
    { btn: 'Ⓐ', label: 'Interact' }, { btn: 'Ⓑ', label: 'Back' },
    { btn: 'Ⓧ', label: 'Journey' }, { btn: 'Ⓨ', label: 'Inventory' },
    { btn: 'LB/RB', label: 'Category' }, { btn: 'LT/RT', label: 'Screen' }, { btn: '✥', label: 'Focus' },
    { btn: '🕹', label: 'Move' }, { btn: '☰', label: 'Menu' },
  ];
}
// The same prompt set styled for the most-recently-used input method: gamepad
// glyphs, or their keyboard-key equivalents. (Pointer/touch hides the bar.)
export function inputPrompts(ctx: 'world' | 'menu' | 'modal', method: InputMethod): Prompt[] {
  const base = controllerPrompts(ctx);
  if (method !== 'keyboard') return base;
  return base.map(p => ({ ...p, btn: KB_GLYPH[p.btn] || p.btn }));
}

// ---- Colour-independent status -------------------------------------------
// Map a semantic status to a shape/letter glyph so meaning never relies on hue.
export const STATUS_GLYPH: Record<string, string> = {
  good: '✔', up: '▲', down: '▼', warn: '▲!', bad: '✖', neutral: '＝', locked: '🔒', active: '●',
};
export function statusGlyph(kind: string): string { return STATUS_GLYPH[kind] || '•'; }
