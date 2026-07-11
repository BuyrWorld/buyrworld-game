import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  TUTORIAL_TARGETS, TUTORIAL_STEPS, TUTORIAL_CONTRACT,
  tutorialShouldStop, isTutorialItem, tutorialRecovery,
} from '../src/data/tutorial.ts';
import { ITEMS } from '../src/data/items.ts';

describe('Deterministic tutorial — chain arithmetic', () => {
  it('targets are exactly 6 ore, 3 bars, 3 brackets', () => {
    expect(TUTORIAL_TARGETS.iron_ore).toBe(6);
    expect(TUTORIAL_TARGETS.iron_bar).toBe(3);
    expect(TUTORIAL_TARGETS.bracket).toBe(3);
  });
  it('6 ore → 3 bars (2:1) → 3 brackets (1:1) with nothing left over', () => {
    expect(TUTORIAL_TARGETS.iron_ore / 2).toBe(TUTORIAL_TARGETS.iron_bar);   // 6 ore make 3 bars
    expect(TUTORIAL_TARGETS.iron_bar).toBe(TUTORIAL_TARGETS.bracket);        // 3 bars make 3 brackets
  });
  it('the tutorial contract always requires exactly 3 brackets', () => {
    expect(TUTORIAL_CONTRACT.item).toBe('bracket');
    expect(TUTORIAL_CONTRACT.qty).toBe(3);
  });
  it('has the four guided stages in order', () => {
    expect(TUTORIAL_STEPS.map(s => s.key)).toEqual(['mine', 'smelt', 'make', 'deliver']);
  });
});

describe('Deterministic tutorial — auto-stop (no surplus)', () => {
  it('mining stops at exactly 6 ore, smelting at 3 bars, manufacturing at 3 brackets', () => {
    expect(tutorialShouldStop('iron_ore', 5)).toBe(false);
    expect(tutorialShouldStop('iron_ore', 6)).toBe(true);
    expect(tutorialShouldStop('iron_bar', 2)).toBe(false);
    expect(tutorialShouldStop('iron_bar', 3)).toBe(true);
    expect(tutorialShouldStop('bracket', 2)).toBe(false);
    expect(tutorialShouldStop('bracket', 3)).toBe(true);
  });
  it('never stops a non-tutorial item', () => {
    expect(tutorialShouldStop('coal', 99)).toBe(false);
    expect(isTutorialItem('bracket')).toBe(true);
    expect(isTutorialItem('coal')).toBe(false);
  });
});

describe('Deterministic tutorial — old-save recovery (minimum, once)', () => {
  it('grants only the deficit for the current step', () => {
    // mid-smelt with only 4 ore → needs 2 more ore to reach 3 bars
    expect(tutorialRecovery(1, { iron_ore: 4 })).toEqual({ iron_ore: 2 });
    // already has enough → nothing granted
    expect(tutorialRecovery(1, { iron_bar: 3 })).toEqual({});
    expect(tutorialRecovery(1, { iron_ore: 6 })).toEqual({});
  });
  it('manufacturing step tops up bars; delivery step tops up brackets', () => {
    expect(tutorialRecovery(2, { bracket: 1, iron_bar: 0 })).toEqual({ iron_bar: 2 });
    expect(tutorialRecovery(3, { bracket: 1 })).toEqual({ bracket: 2 });
    expect(tutorialRecovery(3, { bracket: 3 })).toEqual({});   // nothing owed when already stocked
  });
  it('the mining step needs no recovery (the player simply mines)', () => {
    expect(tutorialRecovery(0, {})).toEqual({});
  });
});

describe('Deterministic tutorial — bracket icon', () => {
  it('the Bracket no longer uses the brick emoji and keeps its name', () => {
    expect(ITEMS.bracket.ic).not.toBe('🧱');
    expect(ITEMS.bracket.ic).toBe('🔧');
    expect(ITEMS.bracket.n).toBe('Bracket');
  });
  it('no 🧱 remains on the Bracket item anywhere in items data', () => {
    const raw = readFileSync(fileURLToPath(new URL('../src/data/items.json', import.meta.url)), 'utf8');
    const m = raw.match(/"bracket"\s*:\s*\{[^}]*\}/);
    expect(m && m[0].includes('🧱')).toBe(false);
  });
});
