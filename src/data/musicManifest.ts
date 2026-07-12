// AUTHORITATIVE Frosty music manifest — the game owner categorised every track by
// FOLDER. The folder (not filename/BPM/genre/heuristics) determines the scenario.
// This module is the single source of truth; do NOT reclassify tracks elsewhere.
// Pure and testable — no DOM, no game state.

export type Scenario = 'title' | 'general' | 'forest' | 'holding' | 'nightclub' | 'frosty-radio';
export type VenueMode = 'normal' | 'strip-club';
export type SoundtrackMode = 'frosty' | 'chiptune';

export interface MusicTrack {
  id: string;                     // stable track id
  title: string;
  artist: string;                 // always 'Frosty'
  source: string;                 // deployed, case-safe, URL-encodable path under public/
  scenario: Scenario;             // from the owner's folder — never inferred
  venueMode?: VenueMode;          // nightclub only
  radioOnly?: boolean;            // Frosty Exclusive — radio-only, never a global playlist
  unlockRequirement?: string | null;  // frosty quest id (radio tracks)
  unlockAt?: number;              // # of completed Frosty quests required (radio progression)
  unlockLabel?: string;           // player-facing source of the unlock
  requiredWorldFlag?: string;     // e.g. 'prisonExpansionBuilt' — gates future venue content
  enabled: boolean;
  loop: boolean;
  transitionPriority?: number;
}

// Deployed base — case-safe folders; original Windows source names are preserved
// under Music/Frosty and copied here (see scripts/check-music.mjs).
const B = 'music/frosty';

export const MUSIC_MANIFEST: MusicTrack[] = [
  // --- Title (title screen / main menu / creator) ---
  { id: 'title-dead-inside', title: 'Dead Inside', artist: 'Frosty', source: `${B}/title/Frosty - Dead Inside (Game Music).mp3`, scenario: 'title', enabled: true, loop: true },

  // --- General Game (town, ordinary interiors, cottage, default) ---
  { id: 'general-it-is-what-it-is', title: 'It is What it is', artist: 'Frosty', source: `${B}/general-game/Frosty - It is What it is (General Game).mp3`, scenario: 'general', enabled: true, loop: true },

  // --- Forest (forest district, woodcutting/foraging areas) ---
  { id: 'forest-departure', title: 'Departure', artist: 'Frosty', source: `${B}/forest/Frosty - Departure [Instrumental].mp3`, scenario: 'forest', enabled: true, loop: true },

  // --- Holding cell (custody only) ---
  { id: 'holding-unhinged', title: 'Unhinged', artist: 'Frosty', source: `${B}/holding-cell/Frosty - Unhinged [Instrumental].mp3`, scenario: 'holding', enabled: true, loop: true },

  // --- Frosty Exclusive (radio-only, inside Frosty's house; progressive quest unlocks) ---
  { id: 'exclusive-stay-frosty',       title: 'Stay Frosty (Main Theme)', artist: 'Frosty', source: `${B}/frosty-exclusive/Frosty - Stay Frosty (Main Theme).mp3`, scenario: 'frosty-radio', radioOnly: true, unlockRequirement: 'frosty-tutorial',        unlockAt: 1, unlockLabel: "Frosty's tutorial",         enabled: true, loop: true },
  { id: 'exclusive-insatiable-dubstep',title: 'Insatiable (Dubstep Edit)',artist: 'Frosty', source: `${B}/frosty-exclusive/Frosty - Insatiable (Dubstep Edit).mp3`, scenario: 'frosty-radio', radioOnly: true, unlockRequirement: 'frosty-milestone-3', unlockAt: 3, unlockLabel: "Frosty's later milestones", enabled: true, loop: true },

  // --- Nightclub — Normal (ordinary venue + themed nights) ---
  { id: 'club-deja-vu',      title: 'Deja Vu',      artist: 'Frosty', source: `${B}/nightclub/normal/Frosty - Deja Vu (Club).mp3`,        scenario: 'nightclub', venueMode: 'normal', enabled: true, loop: true },
  { id: 'club-hit-back',     title: 'Hit Back',     artist: 'Frosty', source: `${B}/nightclub/normal/Frosty - Hit Back (Club).mp3`,       scenario: 'nightclub', venueMode: 'normal', enabled: true, loop: true },
  { id: 'club-insatiable',   title: 'Insatiable',   artist: 'Frosty', source: `${B}/nightclub/normal/Frosty - Insatiable (Dance).mp3`,     scenario: 'nightclub', venueMode: 'normal', enabled: true, loop: true },
  { id: 'club-too-far-gone', title: 'Too Far Gone', artist: 'Frosty', source: `${B}/nightclub/normal/Frosty - Too Far Gone (Dance).mp3`,   scenario: 'nightclub', venueMode: 'normal', enabled: true, loop: true },
  { id: 'club-unsociable',   title: 'Unsociable',   artist: 'Frosty', source: `${B}/nightclub/normal/Frosty - Unsociable (Club).mp3`,      scenario: 'nightclub', venueMode: 'normal', enabled: true, loop: true },

  // --- Nightclub — Strip Club (FUTURE venue; gated behind a world flag, not crime) ---
  { id: 'strip-dark-passenger', title: 'Dark Passenger', artist: 'Frosty', source: `${B}/nightclub/strip-club/Frosty - Dark Passenger.mp3`,        scenario: 'nightclub', venueMode: 'strip-club', requiredWorldFlag: 'prisonExpansionBuilt', enabled: true, loop: true },
  { id: 'strip-mistakes',       title: 'Mistakes',       artist: 'Frosty', source: `${B}/nightclub/strip-club/Frosty - Mistakes.mp3`,             scenario: 'nightclub', venueMode: 'strip-club', requiredWorldFlag: 'prisonExpansionBuilt', enabled: true, loop: true },
  { id: 'strip-unapologetic',   title: 'Unapologetic',   artist: 'Frosty', source: `${B}/nightclub/strip-club/Frosty - Unapologetic (Explicit).mp3`, scenario: 'nightclub', venueMode: 'strip-club', requiredWorldFlag: 'prisonExpansionBuilt', enabled: true, loop: true },
];

// ---- Scenario priority (highest first) -----------------------------------
// Frosty radio interaction > Holding cell > Active nightclub venue > Forest > Title > General.
export const SCENARIO_PRIORITY: Scenario[] = ['frosty-radio', 'holding', 'nightclub', 'forest', 'title', 'general'];
export function scenarioRank(s: Scenario): number { const i = SCENARIO_PRIORITY.indexOf(s); return i < 0 ? SCENARIO_PRIORITY.length : i; }
// Given candidate scenarios that currently apply, pick the highest-priority one.
export function resolveScenario(candidates: Scenario[]): Scenario {
  const valid = (candidates || []).filter(c => SCENARIO_PRIORITY.includes(c));
  if (!valid.length) return 'general';
  return valid.slice().sort((a, b) => scenarioRank(a) - scenarioRank(b))[0];
}

// ---- Track selection (Frosty Original mode) ------------------------------
export function enabledTracks(): MusicTrack[] { return MUSIC_MANIFEST.filter(t => t.enabled); }
export function radioTracks(): MusicTrack[] { return enabledTracks().filter(t => t.radioOnly); }
export function isRadioOnly(id: string): boolean { const t = MUSIC_MANIFEST.find(x => x.id === id); return !!(t && t.radioOnly); }

// World-flag check for gated venue content (strip club needs its flag; default off).
export function worldFlagOk(flag: string | undefined, flags: Record<string, any> = {}): boolean {
  return !flag || !!flags[flag];
}
// Which nightclub venue mode is active — driven by a world/progression flag, NEVER by crime.
export function nightclubVenueMode(flags: Record<string, any> = {}): VenueMode {
  return flags && flags.prisonExpansionBuilt && flags.nightclubVenueMode === 'strip-club' ? 'strip-club' : 'normal';
}

// The playable Frosty tracks for a scenario (radio-only excluded from all global playlists).
// nightclub is filtered by venueMode; strip-club tracks also require their world flag.
export function frostyPlaylist(scenario: Scenario, opts: { venueMode?: VenueMode; flags?: Record<string, any> } = {}): MusicTrack[] {
  if (scenario === 'frosty-radio') return [];   // radio is never a global playlist
  const flags = opts.flags || {};
  let list = enabledTracks().filter(t => t.scenario === scenario && !t.radioOnly);
  if (scenario === 'nightclub') {
    const mode = opts.venueMode || nightclubVenueMode(flags);
    list = list.filter(t => t.venueMode === mode && worldFlagOk(t.requiredWorldFlag, flags));
  }
  return list;
}
export function frostySources(scenario: Scenario, opts: { venueMode?: VenueMode; flags?: Record<string, any> } = {}): string[] {
  return frostyPlaylist(scenario, opts).map(t => t.source);
}

// ---- Classic Chiptune mode — mirrors the SAME scenario structure ----------
// Maps each scenario (and nightclub venue mode) to chiptune track keys in src/audio/tracks.ts.
export const CHIPTUNE_MAP: Record<string, string[]> = {
  title:            ['valley'],
  general:          ['valley', 'market'],
  forest:           ['barn'],
  holding:          ['home'],
  'nightclub:normal':     ['club_pop', 'club_rock', 'club_hiphop', 'club_trance', 'club_80s'],
  'nightclub:strip-club': ['club_80s', 'club_trance'],
};
export function chiptuneKeys(scenario: Scenario, venueMode: VenueMode = 'normal'): string[] {
  if (scenario === 'nightclub') return CHIPTUNE_MAP[`nightclub:${venueMode}`] || CHIPTUNE_MAP['nightclub:normal'];
  return CHIPTUNE_MAP[scenario] || CHIPTUNE_MAP.general;
}

// ---- Soundtrack modes + volume -------------------------------------------
export const SOUNDTRACK_MODES: SoundtrackMode[] = ['frosty', 'chiptune'];
export const DEFAULT_SOUNDTRACK: SoundtrackMode = 'frosty';
export function isSoundtrackMode(v: any): v is SoundtrackMode { return SOUNDTRACK_MODES.includes(v); }

// Off / Low / Medium / Loud — genuinely distinct gains, defaulting to Low.
export const VOLUME_STEPS = ['off', 'low', 'med', 'loud'] as const;
export type VolumeStep = typeof VOLUME_STEPS[number];
export const VOLUME_GAINS: Record<VolumeStep, number> = { off: 0, low: 0.15, med: 0.42, loud: 0.85 };
export const DEFAULT_VOLUME: VolumeStep = 'low';
export function volumeGain(step: string): number {
  return (VOLUME_GAINS as any)[step] != null ? (VOLUME_GAINS as any)[step] : VOLUME_GAINS.low;
}
