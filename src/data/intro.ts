// Boot / logo-intro presentation timeline. PURE + deterministic so the animation has
// a guaranteed completion and skip path, and is unit-testable. main.ts renders the
// programmatic pixel-art each frame by reading `stageAt(t)`; nothing here draws.
//
// The intro is a clean QC-scan reveal of the BUYRWORLD logo: the wordmark appears, a
// quality-control scanner sweeps across it and greens ("QUALITY APPROVED"), then holds.

export type IntroVariant = 'full' | 'short' | 'reduced';

export interface IntroStage { id: string; from: number; to: number; }

// FULL — first launch: a relaxed QC-scan reveal (under the 8-second cap, but short).
export const FULL_STAGES: IntroStage[] = [
  { id: 'reveal', from: 0,    to: 900 },    // logo scales/fades in
  { id: 'qc',     from: 900,  to: 2300 },   // scanner sweeps → greens
  { id: 'pass',   from: 2300, to: 3100 },   // QUALITY APPROVED stamp + tagline
  { id: 'hold',   from: 3100, to: 3500 },   // brief hold before the hand-off
];
export const FULL_DURATION_MS = 3500;

// SHORT — returning launches: the same beats, quicker.
export const SHORT_STAGES: IntroStage[] = [
  { id: 'reveal', from: 0,    to: 500 },
  { id: 'qc',     from: 500,  to: 1500 },
  { id: 'pass',   from: 1500, to: 2000 },
  { id: 'hold',   from: 2000, to: 2200 },
];
export const SHORT_DURATION_MS = 2200;

// REDUCED — reduced-motion: static logo + approved mark, gentle fade, no scan motion.
export const REDUCED_STAGES: IntroStage[] = [
  { id: 'reveal', from: 0,   to: 600 },
  { id: 'hold',   from: 600, to: 1200 },
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

// The scanner greens in the second half of the QC beat (reduced: greened by the hold).
export function qcApproved(t: number, v: IntroVariant): boolean {
  const stages = stagesFor(v);
  const qc = stages.find(s => s.id === 'qc');
  if (!qc) return t >= durationFor(v) * 0.5;   // reduced: approved once the reveal settles
  return t >= qc.from + (qc.to - qc.from) * 0.6;
}

// The elapsed time to jump to when the player SKIPS — the final valid held frame, so
// skipping always leaves the completed, approved logo in a good state.
export function skipTo(v: IntroVariant): number { return durationFor(v); }

// Ignore accidental input for a short guard window.
export const INPUT_GUARD_MS = 400;
export function inputAccepted(t: number): boolean { return t >= INPUT_GUARD_MS; }
