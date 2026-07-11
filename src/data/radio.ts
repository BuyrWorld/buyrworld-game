// Milestone addendum — Frosty's House Radio. A DIEGETIC music source: these
// "Frosty Exclusive" tracks play ONLY through the radio inside Frosty's House,
// never via the global zone/scenario music. They are the real MP3s the player
// loaded under Music/Frosty/Frosty Exclusive/ (served from public/music/frosty_exclusive/).
// Unlock progression scales with Frosty-guided quest milestones. Pure/testable.

export interface FrostyTrack {
  id: string;
  title: string;
  composer: string;
  licence: string;
  file: string;       // path under the served public/ root (URL-encoded at play time)
  unlockAt: number;   // number of completed Frosty quests required
  source: string;     // which Frosty quest unlocks it (player-facing)
}

// Frosty Exclusive tracks — the actual MP3s from the "Frosty Exclusive" folder.
export const FROSTY_TRACKS: FrostyTrack[] = [
  { id: 'ft_stayfrosty', title: 'Stay Frosty (Main Theme)', composer: 'Frosty', licence: 'Original — BuyrWorld', file: 'music/frosty_exclusive/Frosty - Stay Frosty (Main Theme).mp3', unlockAt: 1, source: "Frosty's tutorial" },
  { id: 'ft_insatiable', title: 'Insatiable (Dubstep Edit)', composer: 'Frosty', licence: 'Original — BuyrWorld', file: 'music/frosty_exclusive/Frosty - Insatiable (Dubstep Edit).mp3', unlockAt: 3, source: "Frosty's later milestones" },
];

// The "Frosty Exclusive" folder — used by the global engine to refuse these files.
export const FROSTY_EXCLUSIVE_DIR = 'music/frosty_exclusive/';

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
