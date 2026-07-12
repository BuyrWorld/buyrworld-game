import { describe, it, expect } from 'vitest';
import {
  FROSTY_TRACKS, FROSTY_EXCLUSIVE_DIR, RADIO_UNLOCK_QUESTS, radioUnlocked, unlockedTracks, isTrackUnlocked,
  trackById, trackByFile, isExclusiveFile, collectionPct, nextTrackToUnlock, radioDefaultTrack,
  GLOBAL_SCENARIO_PRIORITY, inGlobalScenario,
} from '../src/data/radio.ts';

describe("Frosty's Radio — track catalogue", () => {
  it('every radio track has full metadata and a real mp3; exclusives live in the exclusive folder', () => {
    expect(FROSTY_TRACKS.length).toBeGreaterThan(0);
    for (const t of FROSTY_TRACKS) {
      expect(t.title).toBeTruthy();
      expect(t.composer).toBeTruthy();
      expect(t.licence).toBeTruthy();
      expect(t.file).toMatch(/\.mp3$/);                 // a real audio file
      expect(t.unlockAt).toBeGreaterThanOrEqual(0);
      expect(t.source).toBeTruthy();
      // quest-unlocked exclusives are in the exclusive folder; the free default is the title tune
      if (t.unlockAt >= 1) expect(t.file.startsWith(FROSTY_EXCLUSIVE_DIR)).toBe(true);
    }
  });
});

describe("Frosty's Radio — unlock progression", () => {
  it('the radio is always available (a free default track), and unlocks more with quests', () => {
    expect(radioUnlocked(0)).toBe(true);                // free default → never locked
    expect(radioUnlocked(RADIO_UNLOCK_QUESTS)).toBe(true);
    expect(radioDefaultTrack()).toBeTruthy();
    expect(radioDefaultTrack().unlockAt).toBe(0);
  });
  it('one track is free; more quests unlock more, once each', () => {
    expect(unlockedTracks(0).length).toBe(1);           // just the free default
    expect(unlockedTracks(1).length).toBe(2);
    expect(unlockedTracks(99).length).toBe(FROSTY_TRACKS.length);   // full playlist
    for (let q = 0; q < 10; q++) expect(unlockedTracks(q + 1).length).toBeGreaterThanOrEqual(unlockedTracks(q).length);
  });
  it('locked tracks report as locked and cannot be treated as unlocked', () => {
    const last = FROSTY_TRACKS[FROSTY_TRACKS.length - 1];
    expect(isTrackUnlocked(last.id, 0)).toBe(false);
    expect(isTrackUnlocked(FROSTY_TRACKS[0].id, 0)).toBe(true);   // default is unlocked at 0
  });
  it('collection percentage and next-unlock track the progress', () => {
    expect(collectionPct(0)).toBeGreaterThan(0);        // the default counts
    expect(collectionPct(99)).toBe(100);
    expect(nextTrackToUnlock(0)).toBe(FROSTY_TRACKS.find(t => t.unlockAt >= 1));
    expect(nextTrackToUnlock(99)).toBeNull();
  });
  it('lookup helpers resolve by id and file', () => {
    expect(trackById(FROSTY_TRACKS[0].id)).toBe(FROSTY_TRACKS[0]);
    expect(trackByFile(FROSTY_TRACKS[0].file)).toBe(FROSTY_TRACKS[0]);
    expect(trackById('nope')).toBeNull();
  });
});

describe("Frosty's Radio — global isolation", () => {
  it('exclusive files are never part of the automatic scenario list', () => {
    for (const t of FROSTY_TRACKS) {
      expect(isExclusiveFile(t.file)).toBe(true);
      expect(inGlobalScenario(t.file)).toBe(false);       // never auto-selected
      expect(GLOBAL_SCENARIO_PRIORITY).not.toContain(t.file);
    }
    // ordinary scenario buckets stay eligible for the global engine
    expect(inGlobalScenario('forest')).toBe(true);
    expect(inGlobalScenario('general')).toBe(true);
    expect(isExclusiveFile('music/forest/whatever.mp3')).toBe(false);
  });
  it('the global priority order is Title → Strip → Normal club → Forest → General', () => {
    expect(GLOBAL_SCENARIO_PRIORITY).toEqual(['title', 'nightclub_strip', 'nightclub_normal', 'forest', 'general']);
  });
});
