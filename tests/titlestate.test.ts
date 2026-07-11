import { describe, it, expect } from 'vitest';
import {
  NEW_GAME_FIRST_ORE, simulationActive, cleanName, NAME_MAX, saveSummary,
  TEXT_SCALES, textScaleValue, DEFAULT_SETTINGS,
} from '../src/data/titlestate.ts';

describe('Title state — simulation gating', () => {
  it('no world simulation runs while the title screen is up', () => {
    expect(simulationActive(true)).toBe(false);
    expect(simulationActive(false)).toBe(true);
  });
  it('the new-game first objective uses the deterministic 6 ore (not 5)', () => {
    expect(NEW_GAME_FIRST_ORE).toBe(6);
  });
});

describe('Title state — safe name handling', () => {
  it('accepts ordinary names unchanged', () => {
    expect(cleanName('Joshua')).toEqual({ ok: true, name: 'Joshua', error: '' });
    expect(cleanName("O'Brien").ok).toBe(true);   // apostrophe stripped, still valid
  });
  it('trims, collapses whitespace and caps length', () => {
    expect(cleanName('   Ada   Lovelace   ').name).toBe('Ada Lovelace');
    expect(cleanName('x'.repeat(50)).name.length).toBe(NAME_MAX);
  });
  it('rejects empty / whitespace-only names', () => {
    expect(cleanName('').ok).toBe(false);
    expect(cleanName('    ').ok).toBe(false);
    expect(cleanName(null as any).ok).toBe(false);
  });
  it('strips HTML/script-injection characters', () => {
    const r = cleanName('<script>alert(1)</script>');
    expect(r.name).not.toMatch(/[<>&"'`]/);
    expect(r.name.toLowerCase()).not.toContain('<script');
  });
});

describe('Title state — Continue save summary', () => {
  it('summarises a valid save with name, level, coins, date and chapter', () => {
    const s = saveSummary({ name: 'Ada', totalLevel: 42, coins: 1234, lastSeen: Date.UTC(2026, 6, 1), legacy: 2 });
    expect(s).not.toBeNull();
    expect(s!.name).toBe('Ada');
    expect(s!.totalLevel).toBe(42);
    expect(s!.coins).toBe(1234);
    expect(s!.date.length).toBeGreaterThan(0);
    expect(s!.chapter).toBe('Chapter 3');
  });
  it('returns null when there is no valid named save (Continue stays hidden)', () => {
    expect(saveSummary(null)).toBeNull();
    expect(saveSummary({})).toBeNull();
    expect(saveSummary({ coins: 100 })).toBeNull();
  });
  it('omits chapter for a first-generation save', () => {
    expect(saveSummary({ name: 'New', legacy: 0 })!.chapter).toBe('');
  });
});

describe('Title state — settings', () => {
  it('has sensible text scales and defaults', () => {
    expect(TEXT_SCALES).toContain('normal');
    expect(textScaleValue('small')).toBeLessThan(textScaleValue('normal'));
    expect(textScaleValue('large')).toBeGreaterThan(textScaleValue('normal'));
    expect(textScaleValue('normal')).toBe(1);
    expect(DEFAULT_SETTINGS.motion).toBe(true);
    expect(DEFAULT_SETTINGS.music).toBe(true);
  });
});
