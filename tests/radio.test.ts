import { describe, it, expect } from 'vitest';
import {
  FROSTY_TRACKS, FROSTY_EXCLUSIVE_DIR, RADIO_UNLOCK_QUESTS, radioUnlocked, unlockedTracks, isTrackUnlocked,
  trackById, trackByFile, isExclusiveFile, collectionPct, nextTrackToUnlock, radioDefaultTrack,
  GLOBAL_SCENARIO_PRIORITY, inGlobalScenario,
} from '../src/data/radio.ts';

describe("Frosty's Radio — track catalogue", () => {
  it('every radio track has full metadata, a real mp3, and is a quest-gated exclusive', () => {
    expect(FROSTY_TRACKS.length).toBeGreaterThan(0);
    for (const t of FROSTY_TRACKS) {
      expect(t.title).toBeTruthy();
      expect(t.composer).toBeTruthy();
      expect(t.licence).toBeTruthy();
      expect(t.file).toMatch(/\.mp3$/);                 // a real audio file
      expect(t.unlockAt).toBeGreaterThanOrEqual(1);     // EVERY exclusive needs a Frosty quest (req 9b)
      expect(t.source).toBeTruthy();
      // every track is radio-exclusive (refused by the global engine), whichever folder it lives in
      expect(isExclusiveFile(t.file)).toBe(true);
    }
  });
});

describe("Frosty's Radio — unlock progression", () => {
  it('the radio HARDWARE is always present, but NO exclusive plays on a clean save (req 9c)', () => {
    expect(radioUnlocked(0)).toBe(true);                // the radio itself is clickable from the start…
    expect(radioUnlocked(RADIO_UNLOCK_QUESTS)).toBe(true);
    expect(unlockedTracks(0)).toEqual([]);              // …but there is nothing to play yet
    expect(radioDefaultTrack(0)).toBeNull();
    expect(collectionPct(0)).toBe(0);
  });
  it('each Frosty quest unlocks exactly one more exclusive, in order (req 9b)', () => {
    expect(unlockedTracks(1).length).toBe(1);
    expect(unlockedTracks(2).length).toBe(2);
    expect(unlockedTracks(3).length).toBe(3);
    expect(unlockedTracks(99).length).toBe(FROSTY_TRACKS.length);   // full playlist
    for (let q = 0; q < 10; q++) expect(unlockedTracks(q + 1).length).toBeGreaterThanOrEqual(unlockedTracks(q).length);
    // the first unlock plays once the first quest is done
    expect(radioDefaultTrack(1)).toBe(FROSTY_TRACKS[0]);
  });
  it('every track is locked on a clean save; the first unlocks after one quest', () => {
    for (const t of FROSTY_TRACKS) expect(isTrackUnlocked(t.id, 0)).toBe(false);   // NONE on a clean save
    expect(isTrackUnlocked(FROSTY_TRACKS[0].id, 1)).toBe(true);
  });
  it('collection percentage and next-unlock track the progress', () => {
    expect(collectionPct(0)).toBe(0);                   // nothing collected on a clean save
    expect(collectionPct(99)).toBe(100);
    expect(nextTrackToUnlock(0)).toBe(FROSTY_TRACKS[0]);
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
