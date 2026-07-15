import { describe, it, expect } from 'vitest';
import {
  TUTORIAL_TARGETS, TUTORIAL_CONTRACT, TUTORIAL_STEPS, tutorialShouldStop, isTutorialItem,
} from '../src/data/tutorial.ts';
import { SKILLS } from '../src/data/skills.ts';
import { FROSTY_TRACKS, unlockedTracks, isTrackUnlocked, radioUnlocked } from '../src/data/radio.ts';

// Pure, data-level half of the first-hour release gate. The Playwright suite
// (e2e/first-hour-gate.spec.ts) covers the same facts through the live UI; these
// lock them at the source so a copy/recipe regression fails fast in `npm test`.

const findAction = (id: string) => {
  for (const sk of Object.keys(SKILLS)) {
    for (const a of ((SKILLS as any)[sk].actions || [])) if (a.id === id) return { skill: sk, ...a };
  }
  return null as any;
};

describe('Release gate — tutorial chain quantities (mine 6, not 5)', () => {
  it('targets are exactly 6 ore → 3 bars → 3 brackets', () => {
    expect(TUTORIAL_TARGETS.iron_ore).toBe(6);
    expect(TUTORIAL_TARGETS.iron_bar).toBe(3);
    expect(TUTORIAL_TARGETS.bracket).toBe(3);
    expect(TUTORIAL_STEPS.find(s => s.item === 'iron_ore')!.need).toBe(6);
  });

  it('tutorialShouldStop caps mining at exactly 6 (not 5, not 7)', () => {
    expect(tutorialShouldStop('iron_ore', 5)).toBe(false);
    expect(tutorialShouldStop('iron_ore', 6)).toBe(true);
    expect(tutorialShouldStop('iron_ore', 7)).toBe(true);
    expect(isTutorialItem('iron_ore')).toBe(true);
  });

  it('recipes make the chain balance: 6 ore →(2:1)→ 3 bars →(1:1)→ 3 brackets', () => {
    const mine = findAction('iron_ore');
    const smelt = findAction('iron_bar');
    const press = findAction('bracket');
    expect(mine.out).toEqual({ iron_ore: 1 });
    expect(smelt.in).toEqual({ iron_ore: 2 });
    expect(smelt.out).toEqual({ iron_bar: 1 });
    expect(press.in).toEqual({ iron_bar: 1 });
    expect(press.out).toEqual({ bracket: 1 });
    // 3 smelts consume 6 ore and yield 3 bars; 3 presses consume 3 bars → 3 brackets
    expect(3 * smelt.in.iron_ore).toBe(TUTORIAL_TARGETS.iron_ore);
    expect(3 * smelt.out.iron_bar).toBe(TUTORIAL_TARGETS.iron_bar);
    expect(3 * press.in.iron_bar).toBe(TUTORIAL_TARGETS.iron_bar);
    expect(3 * press.out.bracket).toBe(TUTORIAL_TARGETS.bracket);
  });

  it('the tutorial contract asks for exactly 3 brackets', () => {
    expect(TUTORIAL_CONTRACT.item).toBe('bracket');
    expect(TUTORIAL_CONTRACT.qty).toBe(3);
  });
});

describe('Release gate — Frosty-exclusive radio gating', () => {
  const exclusives = FROSTY_TRACKS.filter(t => (t.unlockAt ?? 1) >= 1);

  it('has Frosty-exclusive tracks gated behind a quest count', () => {
    expect(exclusives.length).toBeGreaterThan(0);
  });

  it('no exclusive is unlocked before its required quest (0 quests completed)', () => {
    const unlocked = new Set(unlockedTracks(0).map(t => t.id));
    for (const t of exclusives) {
      expect(isTrackUnlocked(t.id, 0)).toBe(false);
      expect(unlocked.has(t.id)).toBe(false);
    }
  });

  it('each exclusive unlocks once its quest threshold is met, not before', () => {
    for (const t of exclusives) {
      expect(isTrackUnlocked(t.id, t.unlockAt - 1)).toBe(false);
      expect(isTrackUnlocked(t.id, t.unlockAt)).toBe(true);
    }
  });

  it('the free radio default is available from the start', () => {
    expect(radioUnlocked(0)).toBe(true);            // panel is free…
    expect(unlockedTracks(0).length).toBeLessThan(FROSTY_TRACKS.length);   // …but not every track
  });
});
