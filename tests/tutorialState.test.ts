import { describe, it, expect } from 'vitest';
import {
  tutorialPhase, isTutorialRunning, contractsFrozen,
  classifyModal, canOpenModal, isBlocking,
  summariseRewards, clampTutorialCount,
} from '../src/data/tutorialState.ts';
import { tutorialRecovery, TUTORIAL_STAGES } from '../src/data/tutorial.ts';

// Mirror how main.ts wires the phase machine to the real tutorial config.
const OPTS = {
  deliverStep: TUTORIAL_STAGES.length - 1,
  stageCount: TUTORIAL_STAGES.length,
  recovery: (step: number, inv: any) => tutorialRecovery(step, inv),
};
const phase = (tut: any, inv: any = {}) => tutorialPhase(tut, inv, OPTS);

describe('tutorial phase machine (req 1)', () => {
  it('no record → not_started', () => {
    expect(phase(null)).toBe('not_started');
    expect(phase(undefined)).toBe('not_started');
  });
  it('done → completed (and step past the end → completed)', () => {
    expect(phase({ step: 0, done: true })).toBe('completed');
    expect(phase({ step: 99, done: false })).toBe('completed');
    expect(phase({ step: TUTORIAL_STAGES.length, done: false })).toBe('completed');
  });
  it('mine stage with nothing yet is active (mining needs no inputs)', () => {
    expect(phase({ step: 0, done: false }, {})).toBe('active');
  });
  it('delivery stage with the 3 brackets on hand → contract_ready', () => {
    expect(phase({ step: 3, done: false }, { bracket: 3 })).toBe('contract_ready');
  });
  it('a stage missing its inputs → abandoned_recoverable', () => {
    // smelt stage with no ore and no bars → recoverable (needs ore)
    expect(phase({ step: 1, done: false }, { iron_ore: 0, iron_bar: 0 })).toBe('abandoned_recoverable');
    // delivery stage with too few brackets → recoverable
    expect(phase({ step: 3, done: false }, { bracket: 1 })).toBe('abandoned_recoverable');
  });
  it('smelt stage WITH enough ore is active, not recoverable', () => {
    expect(phase({ step: 1, done: false }, { iron_ore: 6 })).toBe('active');
  });
  it('isTutorialRunning is true for every in-progress phase, false at the ends', () => {
    expect(isTutorialRunning('not_started')).toBe(false);
    expect(isTutorialRunning('active')).toBe(true);
    expect(isTutorialRunning('contract_ready')).toBe(true);
    expect(isTutorialRunning('abandoned_recoverable')).toBe(true);
    expect(isTutorialRunning('completed')).toBe(false);
  });
  it('contractsFrozen tracks isTutorialRunning (req 2/3)', () => {
    expect(contractsFrozen('active')).toBe(true);
    expect(contractsFrozen('contract_ready')).toBe(true);
    expect(contractsFrozen('completed')).toBe(false);
    expect(contractsFrozen('not_started')).toBe(false);
  });
});

describe('modal coordinator (req 5/6)', () => {
  it('classifies critical, tutorial and unknown/optional overlays', () => {
    expect(classifyModal('recovery-modal')).toBe('critical');
    expect(classifyModal('arrest-modal')).toBe('critical');
    expect(classifyModal('tut-summary')).toBe('tutorial');
    expect(classifyModal('next-step-modal')).toBe('tutorial');
    expect(classifyModal('explore-guide')).toBe('optional');
    expect(classifyModal('some-random-modal')).toBe('optional');
    expect(classifyModal('')).toBe('optional');
  });
  it('only critical is non-blocking-exempt; toast never blocks', () => {
    expect(isBlocking('critical')).toBe(true);
    expect(isBlocking('tutorial')).toBe(true);
    expect(isBlocking('optional')).toBe(true);
    expect(isBlocking('toast')).toBe(false);
  });
  it('never opens a second blocking modal over a blocking one (req 6)', () => {
    expect(canOpenModal('optional', 'tutorial', false)).toBe(false);
    expect(canOpenModal('tutorial', 'tutorial', false)).toBe(false);
    expect(canOpenModal('optional', 'optional', false)).toBe(false);
  });
  it('critical always preempts and nothing covers a critical', () => {
    expect(canOpenModal('critical', 'tutorial', false)).toBe(true);
    expect(canOpenModal('critical', 'critical', false)).toBe(true);
    expect(canOpenModal('tutorial', 'critical', false)).toBe(false);
    expect(canOpenModal('optional', 'critical', true)).toBe(false);
  });
  it('an optional info modal may not interrupt a required tutorial action (req 2)', () => {
    expect(canOpenModal('optional', null, true)).toBe(false);   // tutorial running, nothing open
    expect(canOpenModal('optional', null, false)).toBe(true);   // fine once the tutorial is done
    // a tutorial modal itself may still open on a clear stage during the tutorial
    expect(canOpenModal('tutorial', null, true)).toBe(true);
  });
});

describe('reward coalescing (req 7)', () => {
  it('collapses duplicates into counted lines and pools coins', () => {
    const s = summariseRewards([
      { label: 'Trade', coins: 10 },
      { label: 'Contracts', coins: 5 },
      { label: 'Trade', coins: 10 },
    ]);
    expect(s.count).toBe(3);
    expect(s.totalCoins).toBe(25);
    expect(s.lines).toEqual([{ label: 'Trade', count: 2 }, { label: 'Contracts', count: 1 }]);
  });
  it('an empty batch is a safe empty summary', () => {
    expect(summariseRewards([])).toEqual({ lines: [], totalCoins: 0, count: 0 });
  });
});

describe('resource conservation clamp (req 10)', () => {
  it('never lets a tutorial item exceed its exact target', () => {
    expect(clampTutorialCount(6, 8)).toBe(6);
    expect(clampTutorialCount(3, 3)).toBe(3);
    expect(clampTutorialCount(3, 2)).toBe(2);
  });
  it('leaves non-tutorial items (no target) untouched', () => {
    expect(clampTutorialCount(undefined, 100)).toBe(100);
  });
});
