// @ts-nocheck
// M11 — Nightclub themed nights.
// The club's genre rotates every 7 game days (24 real min/day → ~2.8h/theme),
// derived from a fixed epoch so it's identical across sessions with no save
// state. Pure logic + data so it can be unit-tested (tests/nightclub.test.ts).

import { DAY_DURATION_MS } from '../world/daynight.ts';

export interface ClubTheme {
  id: string; name: string; track: string;      // track = TRACKS key suffix ("club_<track>")
  neon: string; neon2: string; floor: string[];  // dance-floor palette
  outfit: [string, string][];                    // [shirt, trouser] pairs for dancers
  emoji: string; tag: string; lines: string[];
}

// Fixed anchor: Mon 5 Jan 2026 UTC. Rotation is deterministic from here.
export const CLUB_EPOCH = Date.UTC(2026, 0, 5);
export const CLUB_PERIOD = 7 * DAY_DURATION_MS; // one themed night = 7 game days

export const CLUB_THEMES: ClubTheme[] = [
  { id:'pop', name:'Pop Night', track:'pop', emoji:'✨', tag:'Chart-toppers all night',
    neon:'#ff5aa8', neon2:'#5ad1ff', floor:['#ff5aa8','#5ad1ff','#ffe15a','#8a5aff'],
    outfit:[['#ff5aa8','#3a2a5a'],['#5ad1ff','#2a3a5a'],['#ffe15a','#5a3a5a']],
    lines:['This tune is EVERYWHERE right now!','Pop bangers till dawn ✨','Sing it with me!','Best night of the week!'] },
  { id:'rock', name:'Rock Night', track:'rock', emoji:'🤘', tag:'Guitars up to eleven',
    neon:'#e8402a', neon2:'#e8b020', floor:['#8a1a1a','#e8402a','#e8b020','#3a1a1a'],
    outfit:[['#7a1a1a','#1a1a1a'],['#2a2a2a','#3a2a1a'],['#e8b020','#2a2a2a']],
    lines:['TURN IT UP! 🤘','Air guitar solo incoming.','Now THIS is real music.','My ears are ringing — magic.'] },
  { id:'hiphop', name:'Hip-Hop Night', track:'hiphop', emoji:'🎤', tag:'Beats and bars',
    neon:'#f0a020', neon2:'#9a5ae8', floor:['#3a2a5a','#f0a020','#9a5ae8','#2a1a3a'],
    outfit:[['#f0a020','#2a2a2a'],['#9a5ae8','#1a1a2a'],['#e8e8e8','#3a3a3a']],
    lines:['That beat goes hard.','Freestyle o’clock 🎤','Head nod guaranteed.','DJ, run it back!'] },
  { id:'trance', name:'Trance Night', track:'trance', emoji:'🌀', tag:'Lose yourself in the build',
    neon:'#2affd0', neon2:'#7a5aff', floor:['#1a2a6a','#2affd0','#7a5aff','#0a1a3a'],
    outfit:[['#2affd0','#1a2a4a'],['#7a5aff','#1a1a3a'],['#e8e8ff','#2a2a4a']],
    lines:['Here comes the drop…','Hands in the air! 🌀','Pure euphoria, this.','I could dance forever.'] },
  { id:'80s', name:'80s Night', track:'80s', emoji:'🕹️', tag:'Neon, synths and big hair',
    neon:'#ff2ae8', neon2:'#2affe8', floor:['#ff2ae8','#2affe8','#ffe12a','#2a1a4a'],
    outfit:[['#ff2ae8','#2a2a4a'],['#2affe8','#3a2a4a'],['#ffe12a','#4a2a4a']],
    lines:['Totally rad night! 🕹️','Synthwave forever.','Love the neon in here.','Big hair, bigger tunes.'] },
];

export function clubThemeIndex(now = Date.now()): number {
  const i = Math.floor((now - CLUB_EPOCH) / CLUB_PERIOD) % CLUB_THEMES.length;
  return ((i % CLUB_THEMES.length) + CLUB_THEMES.length) % CLUB_THEMES.length;
}
export function clubTheme(now = Date.now()): ClubTheme {
  return CLUB_THEMES[clubThemeIndex(now)];
}
export function msToNextTheme(now = Date.now()): number {
  const off = ((now - CLUB_EPOCH) % CLUB_PERIOD + CLUB_PERIOD) % CLUB_PERIOD;
  return CLUB_PERIOD - off;
}
