// Holding Cell Experience V1 — a short, humane detention: ~2 real minutes framed
// as "five in-game minutes", a prisoner who visibly does things, a brief non-preachy
// crime lesson, and a few optional activities that shave a little time. Pure and
// testable; the cell canvas + UI wiring live in main.ts.

// Real-world sentence lengths (both comfortably under the 3-minute cap).
export const CELL_MS_BASE = 110000;         // ~1m50s
export const CELL_MS_STOLEN_EXTRA = 50000;  // carrying stolen goods → ~2m40s total

export function cellDuration(stolen: boolean): number {
  return CELL_MS_BASE + (stolen ? CELL_MS_STOLEN_EXTRA : 0);
}
// Never negative; a stale/absent value reads as "time served".
export function remainingMs(cellUntil: number, now: number): number {
  return Math.max(0, (cellUntil || 0) - now);
}
export function isServed(cellUntil: number, now: number): boolean {
  return remainingMs(cellUntil, now) <= 0;
}

// ---- Prisoner behaviour --------------------------------------------------
// The cellmate cycles believable states so he's never frozen.
export const PRISONER_STATES = ['sleep', 'sit', 'pace', 'idle', 'talk'] as const;
export type PrisonerState = typeof PRISONER_STATES[number];
export function prisonerState(tSec: number): PrisonerState {
  return PRISONER_STATES[Math.floor((tSec || 0) / 7) % PRISONER_STATES.length];
}

// ---- Crime-specific lessons (brief, conversational, non-preachy) ---------
export interface CellLesson { name: string; lines: string[]; }
export const CELL_LESSONS: Record<string, CellLesson> = {
  trespassing: { name: 'Trespassing', lines: [
    "Wandered into someone's place, eh? Easy done.",
    "Round here folk lock up for a reason — knock next time.",
    "No harm meant, I'm sure. Just costs you a morning in here." ] },
  theft: { name: 'Theft', lines: [
    "Light fingers, was it? The valley's small — word gets round.",
    "A pinched trinket isn't worth a record, pal.",
    "Give it back, keep it clean, and folk forget quick enough." ] },
  burglary: { name: 'Burglary', lines: [
    "Going INTO a house to lift stuff — that's the serious end.",
    "Trespass and theft in one go. Constable takes a dim view.",
    "Pay the folk back and it stings less next time you're free." ] },
  antisocial: { name: 'Antisocial behaviour', lines: [
    "Kicking off in public, were we? Everyone has an off day.",
    "The neighbours just want a quiet valley, that's all.",
    "Sleep it off, say sorry, move on. No lasting harm." ] },
  drunk: { name: 'Drunk & disorderly', lines: [
    "A pint's grand — it's the ruckus after that lands you here.",
    "Nobody minds a drink. They mind the singing at 2am.",
    "Water and a lie-down, that's the trick. You'll be right." ] },
  financial: { name: 'Financial mischief', lines: [
    "Fiddling the books? That's the kind they REALLY chase.",
    "A dodgy invoice today is a big headache tomorrow.",
    "Straighten your ledgers — honest coin sleeps easier." ] },
  default: { name: 'Public nuisance', lines: [
    "Whatever it was, it's a morning lost, not a life.",
    "Keep your nose clean out there and you'll not see me again.",
    "Everyone's welcome back once they've served their bit." ] },
};
export function lessonFor(offence: string): CellLesson {
  return CELL_LESSONS[offence] || CELL_LESSONS.default;
}

// ---- Optional cell activities -------------------------------------------
// Each is usable ONCE per sentence (idempotent → no farming) and shaves a small
// fixed amount of real time. Even doing all of them can't zero the timer.
export interface CellActivity { id: string; ic: string; label: string; cutMs: number; note: string; }
export const CELL_ACTIVITIES: CellActivity[] = [
  { id: 'rest',    ic: '😴', label: 'Rest on the bunk',        cutMs: 12000, note: 'You grab a little shut-eye. Time slips by.' },
  { id: 'read',    ic: '📖', label: 'Read the dog-eared book', cutMs: 9000,  note: 'A battered paperback — not half bad, actually.' },
  { id: 'eat',     ic: '🥪', label: 'Eat the cell sandwich',   cutMs: 6000,  note: 'Cardboard with a hint of ham. It fills a gap.' },
  { id: 'clean',   ic: '🧹', label: 'Mop up the leak',         cutMs: 11000, note: 'You mop the puddle by the bucket. Tidier, at least.' },
  { id: 'talk',    ic: '💬', label: 'Chat with your cellmate', cutMs: 9000,  note: 'Derek chews your ear off. The clock ticks on.' },
  { id: 'reflect', ic: '🤔', label: 'Reflect on how you got here', cutMs: 8000, note: 'A quiet moment to yourself. Lesson noted.' },
];
export function activityById(id: string): CellActivity | null {
  return CELL_ACTIVITIES.find(a => a.id === id) || null;
}
// The time-cut for doing `id`, given the activities already done this sentence.
// Returns 0 if unknown or already done (so it can never be applied twice).
export function activityCut(id: string, doneActs: string[]): number {
  const a = activityById(id);
  if (!a) return 0;
  if ((doneActs || []).includes(id)) return 0;
  return a.cutMs;
}
export function allActivitiesDone(doneActs: string[]): boolean {
  return CELL_ACTIVITIES.every(a => (doneActs || []).includes(a.id));
}
// The largest total cut possible (sum of all activities) — used to prove the
// timer can never be driven to zero by activities alone.
export function maxTotalCut(): number {
  return CELL_ACTIVITIES.reduce((s, a) => s + a.cutMs, 0);
}
