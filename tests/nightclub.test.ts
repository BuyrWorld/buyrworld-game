import { describe, it, expect } from 'vitest';
import { CLUB_THEMES, CLUB_EPOCH, CLUB_PERIOD, clubThemeIndex, clubTheme, msToNextTheme } from '../src/data/clubThemes.ts';
import { TRACKS } from '../src/audio/tracks.ts';

describe('M11 nightclub themed nights', () => {
  it('has the 5 themes in the specified rotation order', () => {
    expect(CLUB_THEMES.map(t => t.id)).toEqual(['pop', 'rock', 'hiphop', 'trance', '80s']);
  });

  it('every theme maps to an existing chiptune track', () => {
    for (const t of CLUB_THEMES) expect(TRACKS['club_' + t.track], t.id).toBeTruthy();
  });

  it('starts on Pop at the epoch and rotates every 7 game days', () => {
    expect(clubThemeIndex(CLUB_EPOCH)).toBe(0);
    expect(clubThemeIndex(CLUB_EPOCH + CLUB_PERIOD)).toBe(1);
    expect(clubThemeIndex(CLUB_EPOCH + 2 * CLUB_PERIOD)).toBe(2);
    expect(clubThemeIndex(CLUB_EPOCH + 4 * CLUB_PERIOD)).toBe(4);
    expect(clubThemeIndex(CLUB_EPOCH + 5 * CLUB_PERIOD)).toBe(0); // full cycle back to Pop
  });

  it('is deterministic and stable within a night', () => {
    const mid = CLUB_EPOCH + CLUB_PERIOD + CLUB_PERIOD / 2;
    expect(clubTheme(mid).id).toBe('rock');
    expect(clubThemeIndex(mid)).toBe(clubThemeIndex(mid + 1000));
  });

  it('msToNextTheme stays within (0, period]', () => {
    for (const now of [CLUB_EPOCH + 1, CLUB_EPOCH + CLUB_PERIOD - 1, CLUB_EPOCH + 3 * CLUB_PERIOD + 123]) {
      const ms = msToNextTheme(now);
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(CLUB_PERIOD);
    }
  });

  it('never produces an out-of-range index, even before the epoch', () => {
    for (const now of [CLUB_EPOCH - CLUB_PERIOD * 3 - 5, CLUB_EPOCH - 1, Date.now()]) {
      const i = clubThemeIndex(now);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(CLUB_THEMES.length);
    }
  });
});
