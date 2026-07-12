// Milestone addendum — Frosty's House Radio. A DIEGETIC music source: these
// "Frosty Exclusive" tracks play ONLY through the radio inside Frosty's House,
// never via the global zone/scenario music. Derived from the authoritative music
// manifest (radioOnly tracks) so there is one source of truth. Pure/testable.
import { MUSIC_MANIFEST } from './musicManifest.ts';

export interface FrostyTrack {
  id: string;
  title: string;
  composer: string;
  licence: string;
  file: string;       // path under the served public/ root (URL-encoded at play time)
  unlockAt: number;   // number of completed Frosty quests required
  source: string;     // which Frosty quest unlocks it (player-facing)
}

// Frosty Exclusive tracks — projected from the manifest's radioOnly entries.
export const FROSTY_TRACKS: FrostyTrack[] = MUSIC_MANIFEST
  .filter(t => t.radioOnly && t.enabled)
  .sort((a, b) => (a.unlockAt || 1) - (b.unlockAt || 1))
  .map(t => ({ id: t.id, title: t.title, composer: t.artist, licence: 'Original — BuyrWorld', file: t.source, unlockAt: t.unlockAt || 1, source: t.unlockLabel || "Frosty's quests" }));

// The "Frosty Exclusive" folder — used by the global engine to refuse these files.
export const FROSTY_EXCLUSIVE_DIR = 'music/frosty/frosty-exclusive/';

// Radio access (and the first track) unlocks once the first Frosty quest is done.
export const RADIO_UNLOCK_QUESTS = 1;
export function radioUnlocked(frostyQuests: number): boolean { return (frostyQuests || 0) >= RADIO_UNLOCK_QUESTS; }

export function unlockedTracks(frostyQuests: number): FrostyTrack[] {
  return FROSTY_TRACKS.filter(t => (frostyQuests || 0) >= t.unlockAt);
}
export function isTrackUnlocked(id: string, frostyQuests: number): boolean {
  return unlockedTracks(frostyQuests).some(t => t.id === id);
}
export function trackById(id: string): FrostyTrack | null { return FROSTY_TRACKS.find(t => t.id === id) || null; }
export function trackByFile(file: string): FrostyTrack | null { return FROSTY_TRACKS.find(t => t.file === file) || null; }
// A file is a Frosty-exclusive one (so the global music engine can refuse it).
export function isExclusiveFile(file: string): boolean {
  return !!file && (file.indexOf(FROSTY_EXCLUSIVE_DIR) >= 0 || FROSTY_TRACKS.some(t => t.file === file));
}

export function collectionPct(frostyQuests: number): number {
  return Math.round(unlockedTracks(frostyQuests).length / FROSTY_TRACKS.length * 100);
}
export function nextTrackToUnlock(frostyQuests: number): FrostyTrack | null {
  return FROSTY_TRACKS.find(t => (frostyQuests || 0) < t.unlockAt) || null;
}

// Global (automatic) scenario priority — Frosty Exclusive is deliberately NOT here.
export const GLOBAL_SCENARIO_PRIORITY = ['title', 'nightclub_strip', 'nightclub_normal', 'forest', 'general'];
// A scenario bucket is eligible for the automatic engine (holding cell is contextual,
// exclusive is radio-only). Any real scenario that isn't the exclusive folder qualifies.
export function inGlobalScenario(scenario: string): boolean { return GLOBAL_SCENARIO_PRIORITY.indexOf(scenario) >= 0; }
