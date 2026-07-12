import { describe, it, expect } from 'vitest';
import {
  NAV_GROUPS, NAV_GROUP_ORDER, TAB_GROUP, groupOf, groupById, groupIndex,
  cycleGroup, QTY_STEPS, clampQty, stepQty, wrapIndex, controllerPrompts, statusGlyph,
} from '../src/data/ui.ts';

describe('UI — nav categories', () => {
  it('has exactly the five required groups in order', () => {
    expect(NAV_GROUP_ORDER).toEqual(['world', 'work', 'life', 'progress', 'system']);
    expect(NAV_GROUPS.map(g => g.label)).toEqual(['WORLD', 'WORK', 'LIFE', 'PROGRESS', 'SYSTEM']);
  });
  it('assigns every core tab to a real group', () => {
    for (const tab of ['village','mining','steelworks','manufacturing','woodcutting','fishing','contracts','trade','pets','character','upgrades','ach','settings']) {
      expect(NAV_GROUP_ORDER).toContain(groupOf(tab));
    }
    expect(groupOf('village')).toBe('world');
    expect(groupOf('settings')).toBe('system');
    expect(groupOf('unknown-tab')).toBe('world');   // safe fallback
  });
  it('resolves group lookups', () => {
    expect(groupById('work')?.label).toBe('WORK');
    expect(groupById('nope')).toBeNull();
    expect(groupIndex('life')).toBe(2);
  });
});

describe('UI — category cycling (shoulder buttons)', () => {
  it('wraps forward and backward across all groups', () => {
    expect(cycleGroup('world', +1)).toBe('work');
    expect(cycleGroup('system', +1)).toBe('world');   // wrap
    expect(cycleGroup('world', -1)).toBe('system');    // wrap back
  });
  it('skips groups that have no available tabs', () => {
    const avail = ['world', 'work', 'system'];         // life/progress locked away
    expect(cycleGroup('work', +1, avail)).toBe('system');
    expect(cycleGroup('system', +1, avail)).toBe('world');
    expect(cycleGroup('world', -1, avail)).toBe('system');
  });
  it('is stable when only one group is available', () => {
    expect(cycleGroup('world', +1, ['world'])).toBe('world');
  });
});

describe('UI — quantity selector', () => {
  it('clamps into [1, max] and floors', () => {
    expect(clampQty(0, 100)).toBe(1);
    expect(clampQty(999, 100)).toBe(100);
    expect(clampQty(3.9, 100)).toBe(3);
    expect(clampQty(NaN as any, 100)).toBe(1);
    expect(clampQty(50, 0)).toBe(1);                   // max below min collapses to 1
  });
  it('steps through the ladder and always lands on a valid amount', () => {
    expect(stepQty(1, +1, 100)).toBe(5);
    expect(stepQty(10, +1, 100)).toBe(25);
    expect(stepQty(5, -1, 100)).toBe(1);
    expect(stepQty(1, -1, 100)).toBe(1);               // can't go below 1
    expect(stepQty(100, +1, 100)).toBe(100);           // can't exceed max
    // a max that is not a ladder value is still reachable as the ceiling
    expect(stepQty(50, +1, 63)).toBe(63);
    expect(QTY_STEPS[0]).toBe(1);
  });
});

describe('UI — focus ring traversal', () => {
  it('wraps by ±1 and handles empty / unset', () => {
    expect(wrapIndex(0, 3, +1)).toBe(1);
    expect(wrapIndex(2, 3, +1)).toBe(0);
    expect(wrapIndex(0, 3, -1)).toBe(2);
    expect(wrapIndex(-1, 3, +1)).toBe(0);              // first press enters at start
    expect(wrapIndex(-1, 3, -1)).toBe(2);              // …or the end going back
    expect(wrapIndex(0, 0, +1)).toBe(-1);              // nothing focusable
  });
});

describe('UI — controller prompts & colour-independent status', () => {
  it('offers context-appropriate prompt sets', () => {
    expect(controllerPrompts('world').some(p => p.label === 'Interact')).toBe(true);
    expect(controllerPrompts('menu').some(p => p.label === 'Category')).toBe(true);
    expect(controllerPrompts('modal').some(p => p.label === 'Close')).toBe(true);
  });
  it('gives every status a non-colour glyph', () => {
    expect(statusGlyph('up')).toBe('▲');
    expect(statusGlyph('down')).toBe('▼');
    expect(statusGlyph('good')).toBe('✔');
    expect(statusGlyph('mystery')).toBe('•');          // safe fallback
  });
});
