import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  TUTORIAL_TARGETS, TUTORIAL_STEPS, TUTORIAL_CONTRACT,
  tutorialShouldStop, isTutorialItem, tutorialRecovery,
  TUTORIAL_STAGES, TUTORIAL_GUIDE, TUTORIAL_COMPLETE_BONUS, NAV_HINT,
  fillTemplate, stageById, stageIndex,
} from '../src/data/tutorial.ts';
import { TUTORIAL_REWARDS } from '../src/data/notify.ts';
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

describe('Authoritative config — one source of truth', () => {
  it('every stage carries a complete, well-formed definition', () => {
    for (const s of TUTORIAL_STAGES) {
      expect(typeof s.id).toBe('string');
      expect(s.guide).toBe('Frosty');                          // guide is Frosty everywhere
      expect(s.dialogue.length).toBeGreaterThan(0);
      expect(s.objective.length).toBeGreaterThan(0);
      expect(s.destination.id && s.destination.name && s.destination.marker).toBeTruthy();
      expect(s.quantity).toBeGreaterThan(0);
      expect(s.reward.coins).toBeGreaterThan(0);
      expect(Array.isArray(s.unlocks)).toBe(true);
      expect(['inventory', 'flag']).toContain(s.completion.metric);
    }
  });

  it('the four stages form a single forward chain (mine→smelt→make→deliver→end)', () => {
    expect(TUTORIAL_STAGES.map(s => s.id)).toEqual(['mine', 'smelt', 'make', 'deliver']);
    expect(stageById('mine')!.next).toBe('smelt');
    expect(stageById('smelt')!.next).toBe('make');
    expect(stageById('make')!.next).toBe('deliver');
    expect(stageById('deliver')!.next).toBeNull();             // last stage
    // every next-id resolves to the following stage (no dangling transitions)
    for (const s of TUTORIAL_STAGES) {
      if (s.next) expect(stageIndex(s.next)).toBe(stageIndex(s.id) + 1);
    }
  });

  it('recipes make the chain balance with nothing wasted', () => {
    const smelt = stageById('smelt')!, make = stageById('make')!;
    // 6 ore, smelt 2:1 → exactly 3 bars
    expect(smelt.recipe!.in.iron_ore * smelt.quantity).toBe(TUTORIAL_TARGETS.iron_ore);
    expect(smelt.recipe!.out.iron_bar * smelt.quantity).toBe(3);
    // 3 bars, press 1:1 → exactly 3 brackets
    expect(make.recipe!.in.iron_bar * make.quantity).toBe(TUTORIAL_TARGETS.iron_bar);
    expect(make.recipe!.out.bracket * make.quantity).toBe(3);
    // mine & deliver have no recipe
    expect(stageById('mine')!.recipe).toBeNull();
    expect(stageById('deliver')!.recipe).toBeNull();
  });

  it('completion conditions match the stage targets', () => {
    expect(stageById('mine')!.completion).toEqual({ metric: 'inventory', item: 'iron_ore', count: 6 });
    expect(stageById('smelt')!.completion).toEqual({ metric: 'inventory', item: 'iron_bar', count: 3 });
    expect(stageById('make')!.completion).toEqual({ metric: 'inventory', item: 'bracket', count: 3 });
    expect(stageById('deliver')!.completion).toEqual({ metric: 'flag', flag: 'tutContractDone' });
  });

  it('no player-facing copy says "Frost" instead of "Frosty"', () => {
    expect(TUTORIAL_GUIDE).toBe('Frosty');
    for (const s of TUTORIAL_STAGES) {
      for (const copy of [s.dialogue, s.objective]) {
        // any "Frost" must be immediately followed by "y"
        for (const m of copy.matchAll(/Frost(.?)/g)) expect(m[1]).toBe('y');
      }
    }
  });

  it('objective/dialogue numbers come from the stage quantity (no stray "5")', () => {
    // mine stage objective interpolates to 6, never 5
    expect(fillTemplate(stageById('mine')!.objective, { n: stageById('mine')!.quantity })).toBe('Mine 6 Iron Ore');
    expect(fillTemplate('{name} mines {n}, keeps {prev}', { name: 'Ada', n: 6, prev: 3 })).toBe('Ada mines 6, keeps 3');
  });

  it('the navigation hint describes the TOP tabs, never the bottom', () => {
    expect(NAV_HINT).toMatch(/top/i);
    expect(NAV_HINT).not.toMatch(/bottom/i);
  });

  it('the Tutorial Order is pinned, deadline-free and reputation-safe', () => {
    expect(TUTORIAL_CONTRACT.tutorial).toBe(true);
    expect(TUTORIAL_CONTRACT.pinned).toBe(true);
    expect(TUTORIAL_CONTRACT.deadlineFree).toBe(true);
    expect(TUTORIAL_CONTRACT.reputationSafe).toBe(true);
    expect(TUTORIAL_CONTRACT.item).toBe('bracket');
    expect(TUTORIAL_CONTRACT.qty).toBe(stageById('deliver')!.quantity);
  });

  it('notify.ts reward budget is derived from the stage rewards (single source)', () => {
    expect(TUTORIAL_REWARDS.mine).toBe(stageById('mine')!.reward.coins);
    expect(TUTORIAL_REWARDS.smelt).toBe(stageById('smelt')!.reward.coins);
    expect(TUTORIAL_REWARDS.make).toBe(stageById('make')!.reward.coins);
    expect(TUTORIAL_REWARDS.deliver).toBe(stageById('deliver')!.reward.coins);
    expect(TUTORIAL_REWARDS.contract).toBe(TUTORIAL_CONTRACT.coins);
    expect(TUTORIAL_REWARDS.completeBonus).toBe(TUTORIAL_COMPLETE_BONUS);
  });

  it('back-compat TUTORIAL_STEPS stays derived from the stages', () => {
    expect(TUTORIAL_STEPS.map(s => s.key)).toEqual(TUTORIAL_STAGES.map(s => s.id));
    expect(TUTORIAL_STEPS.map(s => s.need)).toEqual(TUTORIAL_STAGES.map(s => s.quantity));
    expect(TUTORIAL_STEPS.map(s => s.target)).toEqual(TUTORIAL_STAGES.map(s => s.destination.id));
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
