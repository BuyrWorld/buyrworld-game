import { describe, it, expect } from 'vitest';
import {
  CLUB_THEMES, CLUB_EPOCH, CLUB_PERIOD, CLUB_FROSTY_TRACKS, FALLBACK_THEME,
  clubThemeIndex, clubTheme, clubThemeById, msToNextTheme, nextClubTheme,
} from '../src/data/clubThemes.ts';
import { TRACKS } from '../src/audio/tracks.ts';
import { MUSIC_MANIFEST, frostyPlaylist } from '../src/data/musicManifest.ts';

describe('Nightclub themed nights — Frosty-branded rotation', () => {
  it('has the five Frosty-branded themes in the specified rotation order', () => {
    expect(CLUB_THEMES.map(t => t.id)).toEqual([
      'frosty_fridays', 'neon_supply', 'quality_control', 'chiptune_throwback', 'freight_night',
    ]);
  });

  it('every theme maps to an existing chiptune fallback track', () => {
    for (const t of CLUB_THEMES) expect(TRACKS['club_' + t.track], t.id).toBeTruthy();
  });

  it('every eligible Frosty track is a real nightclub track in the manifest', () => {
    const nightclubIds = new Set(MUSIC_MANIFEST.filter(t => t.scenario === 'nightclub').map(t => t.id));
    for (const t of CLUB_THEMES) {
      expect(t.eligibleTracks.length, t.id).toBeGreaterThan(0);
      for (const id of t.eligibleTracks) expect(nightclubIds.has(id), `${t.id} → ${id}`).toBe(true);
    }
  });

  it('the Frosty normal-venue playlist stays populated (nights never depend on one track)', () => {
    const srcs = frostyPlaylist('nightclub', { venueMode: 'normal' });
    expect(srcs.length).toBeGreaterThanOrEqual(3);
    for (const id of CLUB_FROSTY_TRACKS) {
      expect(MUSIC_MANIFEST.some(t => t.id === id)).toBe(true);
    }
  });

  it('every theme carries a complete presentation spec', () => {
    for (const t of CLUB_THEMES) {
      expect(t.palette.length, t.id).toBeGreaterThanOrEqual(4);
      expect(t.outfit.length, t.id).toBeGreaterThanOrEqual(2);
      expect(typeof t.crowdEnergy).toBe('number');
      expect(t.crowdEnergy).toBeGreaterThan(0);
      expect(t.crowdEnergy).toBeLessThanOrEqual(1);
      expect(t.lightingPattern).toBeTruthy();
      expect(t.screenVisual).toBeTruthy();
      expect(typeof t.reputationRequirement).toBe('number');   // gate present (0 = open)
    }
  });

  it('exactly one theme is the deliberate chiptune-forward night', () => {
    expect(CLUB_THEMES.filter(t => t.chiptuneNight).map(t => t.id)).toEqual(['chiptune_throwback']);
  });

  it('starts on Frosty Fridays at the epoch and rotates every 7 game days', () => {
    expect(clubThemeIndex(CLUB_EPOCH)).toBe(0);
    expect(clubTheme(CLUB_EPOCH).id).toBe('frosty_fridays');
    expect(clubThemeIndex(CLUB_EPOCH + CLUB_PERIOD)).toBe(1);
    expect(clubTheme(CLUB_EPOCH + CLUB_PERIOD).id).toBe('neon_supply');
    expect(clubThemeIndex(CLUB_EPOCH + 4 * CLUB_PERIOD)).toBe(4);
    expect(clubThemeIndex(CLUB_EPOCH + 5 * CLUB_PERIOD)).toBe(0); // full cycle back
  });

  it('is deterministic and stable within a night', () => {
    const mid = CLUB_EPOCH + CLUB_PERIOD + CLUB_PERIOD / 2;
    expect(clubTheme(mid).id).toBe('neon_supply');
    expect(clubThemeIndex(mid)).toBe(clubThemeIndex(mid + 1000));
  });

  it('nextClubTheme is the following night in the rotation', () => {
    expect(nextClubTheme(CLUB_EPOCH).id).toBe('neon_supply');
    expect(nextClubTheme(CLUB_EPOCH + 4 * CLUB_PERIOD).id).toBe('frosty_fridays'); // wraps
  });

  it('clubThemeById resolves known ids and falls back safely', () => {
    expect(clubThemeById('freight_night').id).toBe('freight_night');
    expect(clubThemeById('does_not_exist')).toBe(FALLBACK_THEME);
    expect(FALLBACK_THEME.id).toBe('frosty_fridays');
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
