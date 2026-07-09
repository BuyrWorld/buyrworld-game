import { describe, it, expect } from 'vitest';
import {
  TIME_LINES, WEATHER_LINES, SEASON_LINES, timeOfDay, contextLines, pickLine,
  GREETINGS, RESPONSES, SMALLTALK, convoLine,
  INTRO_NPCS, introLine,
} from '../src/data/dialogue.ts';

const CTX = { timeOfDay: 'morning', weather: 'rain', season: 'spring' };

describe('Dialogue — line pools', () => {
  it('every pool is non-empty with trimmed strings', () => {
    for (const group of [TIME_LINES, WEATHER_LINES, SEASON_LINES]) {
      for (const [k, lines] of Object.entries(group)) {
        expect(lines.length, k).toBeGreaterThan(0);
        for (const l of lines) expect(l.trim(), k).toBe(l);
      }
    }
  });

  it('covers all four parts of the day and all four seasons', () => {
    expect(Object.keys(TIME_LINES).sort()).toEqual(['afternoon', 'evening', 'morning', 'night']);
    expect(Object.keys(SEASON_LINES).sort()).toEqual(['autumn', 'spring', 'summer', 'winter']);
  });
});

describe('Dialogue — timeOfDay', () => {
  it('maps hours to the right part of the day', () => {
    expect(timeOfDay(7)).toBe('morning');
    expect(timeOfDay(10.9)).toBe('morning');
    expect(timeOfDay(11)).toBe('afternoon');
    expect(timeOfDay(16)).toBe('afternoon');
    expect(timeOfDay(17)).toBe('evening');
    expect(timeOfDay(20)).toBe('evening');
    expect(timeOfDay(21)).toBe('night');
    expect(timeOfDay(23.9)).toBe('night');
    expect(timeOfDay(0)).toBe('morning');
  });
});

describe('Dialogue — contextLines', () => {
  it('merges the matching time, weather and season pools', () => {
    const pool = contextLines(CTX);
    expect(pool).toEqual([...TIME_LINES.morning, ...WEATHER_LINES.rain, ...SEASON_LINES.spring]);
  });

  it('skips unknown context keys gracefully', () => {
    const pool = contextLines({ timeOfDay: 'morning', weather: 'meteor-shower', season: 'spring' });
    expect(pool).toEqual([...TIME_LINES.morning, ...SEASON_LINES.spring]);
  });
});

describe('Dialogue — pickLine', () => {
  it('returns a situational line when the roll is under contextChance', () => {
    // rng() first call < 0.4 → pick context; second call selects index 0
    const seq = [0.1, 0];
    let i = 0;
    const rng = () => seq[i++];
    const line = pickLine('MY QUIP', CTX, rng, 0.4);
    expect(line).toBe(contextLines(CTX)[0]);
  });

  it('returns the personal quip when the roll is over contextChance', () => {
    const rng = () => 0.99;   // 0.99 >= 0.4 → keep personal quip
    expect(pickLine('MY QUIP', CTX, rng, 0.4)).toBe('MY QUIP');
  });

  it('falls back to the personal quip when there are no context lines', () => {
    const emptyCtx = { timeOfDay: 'x', weather: 'y', season: 'z' };
    expect(pickLine('MY QUIP', emptyCtx, () => 0, 1)).toBe('MY QUIP');
  });
});

describe('Dialogue — conversations', () => {
  it('opener addresses the partner by name', () => {
    const line = convoLine(0, 'Bertie', () => 0);
    expect(line).toBe(GREETINGS[0].replace('{name}', 'Bertie'));
    expect(line).toContain('Bertie');
    expect(line).not.toContain('{name}');
  });

  it('turn 1 is a reply, later even turns are small talk', () => {
    expect(RESPONSES).toContain(convoLine(1, 'X', () => 0));
    expect(SMALLTALK).toContain(convoLine(2, 'X', () => 0));
    expect(RESPONSES).toContain(convoLine(3, 'X', () => 0));
  });

  it('handles a missing partner name gracefully', () => {
    const line = convoLine(0, '', () => 0);
    expect(line).not.toContain('{name}');
    expect(line).toContain('friend');
  });

  it('conversation pools are non-empty and openers carry the name slot', () => {
    expect(GREETINGS.length).toBeGreaterThan(0);
    expect(RESPONSES.length).toBeGreaterThan(0);
    expect(SMALLTALK.length).toBeGreaterThan(0);
    expect(GREETINGS.every(g => g.includes('{name}'))).toBe(true);
  });
});

describe('Dialogue — intro NPC hooks', () => {
  it('has three intro NPCs, each with before and after lines', () => {
    expect(Object.keys(INTRO_NPCS).length).toBe(3);
    for (const [id, e] of Object.entries(INTRO_NPCS)) {
      expect(e.before.length, id).toBeGreaterThan(0);
      expect(e.after.length, id).toBeGreaterThan(0);
    }
  });

  it('introLine picks before/after by tutDone and fills {name}', () => {
    const before = introLine('bertie', false, 'Demo', () => 0);
    const after = introLine('bertie', true, 'Demo', () => 0);
    expect(before).toBe(INTRO_NPCS.bertie.before[0].replace('{name}', 'Demo'));
    expect(after).toBe(INTRO_NPCS.bertie.after[0].replace('{name}', 'Demo'));
    expect(before).toContain('Demo');
    expect(before).not.toContain('{name}');
  });

  it('returns null for a non-intro NPC and defaults a missing name', () => {
    expect(introLine('nobody', false, 'X', () => 0)).toBeNull();
    const line = introLine('agnes', false, '', () => 0);
    expect(line).not.toContain('{name}');
    expect(line).toContain('friend');
  });
});
