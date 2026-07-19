// @ts-nocheck
// Nightclub themed nights — "Club Featherstone".
// The club's THEME rotates every 7 game days (deterministic from a fixed epoch, no save
// state) so it's identical across sessions. Pure logic + data so it can be unit-tested
// (tests/nightclub.test.ts).
//
// M-Club rebuild: the five nights are Frosty-branded and data-driven. Each carries a
// full presentation spec (palette, lighting pattern, DJ screen visual, crowd energy,
// eligible Frosty tracks, outfit tags, reputation gate, and future event-effect hooks)
// so the nightclub component reads its look from DATA, not hard-coded per-theme branches.
// Back-compat fields (neon/neon2/floor/outfit/name/emoji/tag/lines/track) are retained so
// existing callers keep working.

import { DAY_DURATION_MS } from '../world/daynight.ts';

// Future venue variants are ARCHITECTED here but only "standard"/"themedEvent" are live.
export type NightclubVenueMode = 'standard' | 'themedEvent' | 'privateEvent' | 'futureRestrictedVariant';

export interface NightclubEventEffect {
  id: string;
  kind: 'buff' | 'social' | 'reputation' | 'economy';
  label: string;
  // Intentionally light — real effects are applied by the game layer via these hooks.
  magnitude?: number;
}

export interface ClubTheme {
  id: string;
  name: string;            // display name
  displayName?: string;    // brief spec alias for name
  description: string;
  tag: string;             // one-line marquee
  emoji: string;

  // --- audio ---
  track: string;           // chiptune fallback key suffix ("club_<track>" in TRACKS)
  eligibleTracks: string[]; // Frosty nightclub track ids that suit this night (informational hook)
  chiptuneNight?: boolean; // a deliberate retro/chiptune-forward night

  // --- presentation ---
  palette: string[];       // 4+ hex colours, ordered [primary, secondary, accent, warm/base]
  neon: string;            // primary neon (back-compat)
  neon2: string;           // secondary neon (back-compat)
  floor: string[];         // dance-floor palette (back-compat; == palette here)
  lightingPattern: 'wash' | 'sweep' | 'scan' | 'pulse' | 'arcade';
  screenVisual: 'globe_barcode' | 'conveyor' | 'qc_scan' | 'arcade' | 'freight';
  branding?: string;       // short signage line on the DJ screen
  crowdEnergy: number;     // 0..1 — drives dance bob speed + crowd density feel

  // --- crowd / npc ---
  outfit: [string, string][];  // [shirt, trouser] pairs for dancers (back-compat)
  npcOutfitTags?: string[];

  // --- progression / future hooks ---
  reputationRequirement?: number;   // 0 = open to all
  eventEffects?: NightclubEventEffect[];

  lines: string[];         // ambient crowd chatter for this night
}

// Fixed anchor: Mon 5 Jan 2026 UTC. Rotation is deterministic from here.
export const CLUB_EPOCH = Date.UTC(2026, 0, 5);
export const CLUB_PERIOD = 7 * DAY_DURATION_MS; // one themed night = 7 game days

// The Frosty nightclub tracks (normal venue) that themed nights draw from. Kept here as a
// reference set; actual playback resolves via the music manifest's 'nightclub' scenario.
export const CLUB_FROSTY_TRACKS = ['club-deja-vu', 'club-hit-back', 'club-insatiable', 'club-too-far-gone', 'club-unsociable'];

export const CLUB_THEMES: ClubTheme[] = [
  {
    id: 'frosty_fridays', name: 'Frosty Fridays', description: 'Signature Frosty dance floor — ice-cool blues and a "Stay Frosty" glow.',
    tag: 'Stay Frosty — signature Frosty dance floor', emoji: '❄️',
    track: 'trance', eligibleTracks: ['club-deja-vu', 'club-insatiable'],
    palette: ['#5ad1ff', '#2a7aff', '#eaffff', '#0a1a3a'],
    neon: '#5ad1ff', neon2: '#2a7aff', floor: ['#5ad1ff', '#2a7aff', '#eaffff', '#123a6a'],
    lightingPattern: 'wash', screenVisual: 'globe_barcode', branding: 'STAY FROSTY', crowdEnergy: 0.75,
    outfit: [['#5ad1ff', '#1a2a4a'], ['#2a7aff', '#1a1a3a'], ['#eaffff', '#2a3a5a'], ['#7ac8ff', '#22345a']],
    npcOutfitTags: ['icy', 'cool', 'winter'], reputationRequirement: 0,
    eventEffects: [{ id: 'frosty_glow', kind: 'buff', label: 'Frosty Glow — dance buff lasts a touch longer', magnitude: 0.15 }],
    lines: ['Stay frosty out there! ❄️', 'This one\'s pure ice.', 'Frosty never misses.', 'Coolest night of the week.'],
  },
  {
    id: 'neon_supply', name: 'Neon Supply', description: 'Purple-and-magenta warehouse rave — barcodes, conveyors and freight energy.',
    tag: 'Purple lights, barcode beats', emoji: '🟣',
    track: '80s', eligibleTracks: ['club-hit-back', 'club-too-far-gone'],
    palette: ['#c04aff', '#ff2ae8', '#5ad1ff', '#1a0a2a'],
    neon: '#c04aff', neon2: '#ff2ae8', floor: ['#c04aff', '#ff2ae8', '#7a2aff', '#2a0a3a'],
    lightingPattern: 'sweep', screenVisual: 'conveyor', branding: 'NEON SUPPLY', crowdEnergy: 0.8,
    outfit: [['#c04aff', '#2a1a3a'], ['#ff2ae8', '#1a1a2a'], ['#5ad1ff', '#2a1a3a'], ['#e0a0ff', '#1a1030']],
    npcOutfitTags: ['neon', 'streetwear'], reputationRequirement: 0,
    eventEffects: [{ id: 'supply_leads', kind: 'social', label: 'Supplier chatter — leads more likely tonight', magnitude: 1 }],
    lines: ['Barcodes and bass, love it.', 'This beat ships overnight 🟣', 'Neon everything!', 'Supply chain never sleeps.'],
  },
  {
    id: 'quality_control', name: 'Quality Control', description: 'Red-to-green scanner night — everyone\'s hoping for "APPROVED".',
    tag: 'Rejected? Approved? Dance to find out', emoji: '✅',
    track: 'pop', eligibleTracks: ['club-insatiable', 'club-unsociable'],
    palette: ['#ff4d4d', '#3ce07a', '#ffd23c', '#0a1a12'],
    neon: '#3ce07a', neon2: '#ff4d4d', floor: ['#ff4d4d', '#3ce07a', '#ffd23c', '#123a24'],
    lightingPattern: 'scan', screenVisual: 'qc_scan', branding: 'QC: APPROVED', crowdEnergy: 0.7,
    outfit: [['#3ce07a', '#1a2a1a'], ['#ff4d4d', '#2a1a1a'], ['#ffd23c', '#2a2a1a'], ['#8affb0', '#1a2a1a']],
    npcOutfitTags: ['hi-vis', 'clean'], reputationRequirement: 0,
    eventEffects: [{ id: 'qc_pass', kind: 'buff', label: 'Passed inspection — a cheeky feel-good bonus', magnitude: 0.1 }],
    lines: ['APPROVED! ✅', 'Scan says: dance harder.', 'No rejects on this floor.', 'Green means go go go!'],
  },
  {
    id: 'chiptune_throwback', name: 'Chiptune Throwback', description: 'Arcade night — 8-bit lights, pixel patterns and retro moves.',
    tag: 'Retro arcade, 8-bit all night', emoji: '🕹️',
    track: 'hiphop', eligibleTracks: ['club-deja-vu', 'club-hit-back'], chiptuneNight: true,
    palette: ['#ffe12a', '#2affe8', '#ff2ae8', '#101024'],
    neon: '#ffe12a', neon2: '#2affe8', floor: ['#ffe12a', '#2affe8', '#ff2ae8', '#22224a'],
    lightingPattern: 'arcade', screenVisual: 'arcade', branding: 'INSERT COIN', crowdEnergy: 0.85,
    outfit: [['#ffe12a', '#2a2a4a'], ['#2affe8', '#3a2a4a'], ['#ff2ae8', '#2a2a4a'], ['#e8e8ff', '#22224a']],
    npcOutfitTags: ['retro', 'pixel'], reputationRequirement: 0,
    eventEffects: [{ id: 'arcade_combo', kind: 'social', label: 'High-score energy — playful crowd reactions', magnitude: 1 }],
    lines: ['INSERT COIN 🕹️', 'High score dance!', 'Pixels and bass, classic.', 'Level up those moves.'],
  },
  {
    id: 'freight_night', name: 'Freight Night', description: 'Industrial orange-and-blue — heavy electronic, warehouse motifs.',
    tag: 'Heavy industrial, orange & blue', emoji: '🚛',
    track: 'rock', eligibleTracks: ['club-too-far-gone', 'club-unsociable'],
    palette: ['#ff8a1e', '#2a7aff', '#ffc861', '#0a1420'],
    neon: '#ff8a1e', neon2: '#2a7aff', floor: ['#ff8a1e', '#2a7aff', '#ffc861', '#14242e'],
    lightingPattern: 'pulse', screenVisual: 'freight', branding: 'FREIGHT NIGHT', crowdEnergy: 0.9,
    outfit: [['#ff8a1e', '#1a2430'], ['#2a7aff', '#2a1a10'], ['#ffc861', '#1a2430'], ['#e0803a', '#14242e']],
    npcOutfitTags: ['industrial', 'workwear'], reputationRequirement: 0,
    eventEffects: [{ id: 'freight_haul', kind: 'economy', label: 'Big-haul energy — contract talk in the air', magnitude: 1 }],
    lines: ['Heavy tonight! 🚛', 'Bass you can feel.', 'Full load, full send.', 'Orange and blue forever.'],
  },
];

// Deterministic fallback if a theme is ever missing/disabled.
export const FALLBACK_THEME: ClubTheme = CLUB_THEMES[0];

export function clubThemeIndex(now = Date.now()): number {
  const i = Math.floor((now - CLUB_EPOCH) / CLUB_PERIOD) % CLUB_THEMES.length;
  return ((i % CLUB_THEMES.length) + CLUB_THEMES.length) % CLUB_THEMES.length;
}
export function clubTheme(now = Date.now()): ClubTheme {
  return CLUB_THEMES[clubThemeIndex(now)] || FALLBACK_THEME;
}
export function clubThemeById(id: string): ClubTheme {
  return CLUB_THEMES.find(t => t.id === id) || FALLBACK_THEME;
}
export function msToNextTheme(now = Date.now()): number {
  const off = ((now - CLUB_EPOCH) % CLUB_PERIOD + CLUB_PERIOD) % CLUB_PERIOD;
  return CLUB_PERIOD - off;
}
// The upcoming theme (for "next night" teasers on signage / directory).
export function nextClubTheme(now = Date.now()): ClubTheme {
  return CLUB_THEMES[(clubThemeIndex(now) + 1) % CLUB_THEMES.length] || FALLBACK_THEME;
}
