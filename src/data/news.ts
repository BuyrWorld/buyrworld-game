// @ts-nocheck
// M23 — The Featherstone Chronicle: a daily business newspaper compiled from the living
// economy (macro cycle + market pressure + news feed) and the player's own headlines.
// Pure + deterministic here so it's unit-testable; the S.news state, the once-a-day
// edition cache and the broadsheet UI live in main.ts. Reads the economy only — never
// mutates it.

export const NEWS_MASTHEAD = 'The Featherstone Chronicle';

export interface Mover { id: string; name: string; ic: string; pct: number; arrow: '↑' | '↓' | '→'; }
export interface NewsEdition {
  day: number;
  masthead: string;
  dateline: string;
  climate: { head: string; tone: string; flavour: string };
  risers: Mover[];
  fallers: Mover[];
  market: { icon: string; text: string; tone: string }[];
  valley: string[];
  business: { ic: string; text: string }[];
  filler: string;
}

// House ads / notices — pure flavour, chosen deterministically per day.
const FILLERS = [
  "Advertisement — Nell's Home Store: brighten up the cottage this season.",
  "Notice — The Rose & Pallet: quiz night every Thursday, all welcome.",
  "Public Notice — mind the quarry track; the council thanks you.",
  "Small Ads — Bicycle for sale, one careful owner. Enquire at the Cycle Shop.",
  "Advertisement — Featherstone Foundry Supplies: fair prices, steady service.",
  "Notice — Village fund open for donations. Every coin beautifies the valley.",
];
function _pick(arr, seed) {
  if (!arr || !arr.length) return undefined;
  return arr[((seed % arr.length) + arr.length) % arr.length];
}

// Turn item supply/demand pressures (0.55–1.70; 1.0 = neutral) into "movers". Risers =
// high pressure (scarce/dearer), fallers = low pressure (a glut). Biggest moves first.
export function pickMovers(items: { id: string; name: string; ic: string; pressure: number }[], n = 4): { risers: Mover[]; fallers: Mover[] } {
  const toMover = (it): Mover => {
    const pct = Math.round((it.pressure - 1) * 100);
    const arrow: any = pct >= 3 ? '↑' : pct <= -3 ? '↓' : '→';
    return { id: it.id, name: it.name, ic: it.ic, pct, arrow };
  };
  const list = (items || []).filter(it => it && typeof it.pressure === 'number');
  const risers = list.filter(it => it.pressure >= 1.03).map(toMover).sort((a, b) => b.pct - a.pct).slice(0, n);
  const fallers = list.filter(it => it.pressure <= 0.97).map(toMover).sort((a, b) => a.pct - b.pct).slice(0, n);
  return { risers, fallers };
}

export interface EditionCtx {
  day: number;
  dateline: string;
  phase: { head: string; tone: string; flavour: string[] };
  pressures: { id: string; name: string; ic: string; pressure: number }[];
  market: { icon: string; text: string; tone: string }[];
  valley: string[];
  headlines: { ic: string; text: string }[];
}

// Compile one day's edition. Deterministic given the ctx (the day seeds the flavour/ad
// picks, so re-compiling the same day yields the same paper).
export function compileEdition(ctx: EditionCtx): NewsEdition {
  const { risers, fallers } = pickMovers(ctx.pressures || [], 4);
  return {
    day: ctx.day,
    masthead: NEWS_MASTHEAD,
    dateline: ctx.dateline || '',
    climate: {
      head: ctx.phase?.head || '📊 Markets tick along.',
      tone: ctx.phase?.tone || '',
      flavour: _pick(ctx.phase?.flavour || [], ctx.day) || '',
    },
    risers,
    fallers,
    market: (ctx.market || []).slice(0, 6),
    valley: (ctx.valley || []).slice(0, 4),
    business: (ctx.headlines || []).slice(0, 6),
    filler: _pick(FILLERS, ctx.day) || '',
  };
}
