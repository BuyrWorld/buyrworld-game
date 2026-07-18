// Boot / logo-intro presentation timeline. PURE + deterministic so the animation has
// a guaranteed completion and skip path, and is unit-testable. main.ts renders the
// programmatic pixel-art each frame by reading `stageAt(t)`; nothing here draws.

export type IntroVariant = 'full' | 'short' | 'reduced';

export interface IntroStage { id: string; from: number; to: number; }

// FULL — the 6-beat supply-chain construction, held briefly, then handed to the
// Press-Any-Button screen. Total stays UNDER the 8-second cap.
export const FULL_STAGES: IntroStage[] = [
  { id: 'order',      from: 0,    to: 1000 },   // customer order prints
  { id: 'materials',  from: 1000, to: 2000 },   // crates arrive on the conveyor
  { id: 'processing', from: 2000, to: 3500 },   // furnace + processing → letter blanks
  { id: 'assembly',   from: 3500, to: 5000 },   // arms place BUYRWORLD letters
  { id: 'qc',         from: 5000, to: 6200 },   // one letter wrong → scan red → fixed → green
  { id: 'delivery',   from: 6200, to: 7500 },   // forklift + DELIVERED stamp + tagline
  { id: 'hold',       from: 7500, to: 7900 },   // brief hold before transition
];
export const FULL_DURATION_MS = 7900;

// SHORT — returning launches: the finished logo slides in, QC greens, stamp lands.
export const SHORT_STAGES: IntroStage[] = [
  { id: 'slidein',  from: 0,    to: 900 },
  { id: 'qc',       from: 900,  to: 1400 },
  { id: 'delivery', from: 1400, to: 2000 },
  { id: 'hold',     from: 2000, to: 2300 },
];
export const SHORT_DURATION_MS = 2300;

// REDUCED — reduced-motion: the assembled result with a gentle fade, no motion.
export const REDUCED_STAGES: IntroStage[] = [
  { id: 'reveal', from: 0, to: 700 },
  { id: 'hold',   from: 700, to: 1200 },
];
export const REDUCED_DURATION_MS = 1200;

export function stagesFor(v: IntroVariant): IntroStage[] {
  return v === 'short' ? SHORT_STAGES : v === 'reduced' ? REDUCED_STAGES : FULL_STAGES;
}
export function durationFor(v: IntroVariant): number {
  return v === 'short' ? SHORT_DURATION_MS : v === 'reduced' ? REDUCED_DURATION_MS : FULL_DURATION_MS;
}

// The stage at elapsed time `t` (ms), with a local 0..1 progress through it.
export function stageAt(t: number, v: IntroVariant): { id: string; index: number; local: number } {
  const stages = stagesFor(v);
  const clamped = Math.max(0, Math.min(durationFor(v), t));
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    if (clamped < s.to || i === stages.length - 1) {
      const span = Math.max(1, s.to - s.from);
      return { id: s.id, index: i, local: Math.max(0, Math.min(1, (clamped - s.from) / span)) };
    }
  }
  const last = stages[stages.length - 1];
  return { id: last.id, index: stages.length - 1, local: 1 };
}

export function isDone(t: number, v: IntroVariant): boolean { return t >= durationFor(v); }

// The QC beat greens once its second half begins (used by the renderer + tests).
export function qcApproved(t: number, v: IntroVariant): boolean {
  const stages = stagesFor(v);
  const qc = stages.find(s => s.id === 'qc');
  if (!qc) return t >= durationFor(v) * 0.6;   // reduced: approved once past the reveal
  return t >= qc.from + (qc.to - qc.from) * 0.55;
}

// The elapsed time to jump to when the player SKIPS — the final valid held frame, so
// skipping always leaves the completed logo in a good state.
export function skipTo(v: IntroVariant): number { return durationFor(v); }

// Ignore accidental input for a short guard window (except an explicit skip key never
// double-acts on the menu — that is handled by the caller consuming the event).
export const INPUT_GUARD_MS = 400;
export function inputAccepted(t: number): boolean { return t >= INPUT_GUARD_MS; }
