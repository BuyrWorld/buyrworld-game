import { describe, it, expect } from 'vitest';
import { stageAt, isDone, qcApproved, skipTo, durationFor, FULL_DURATION_MS, SHORT_DURATION_MS, REDUCED_DURATION_MS, INPUT_GUARD_MS, inputAccepted, FULL_STAGES, SHORT_STAGES, type IntroVariant } from '../src/data/intro.ts';

describe('intro timeline', () => {
  it('the full intro communicates order → supply → production → QC → delivery, under 8s', () => {
    expect(FULL_STAGES.map(s => s.id)).toEqual(['order', 'materials', 'processing', 'assembly', 'qc', 'delivery', 'hold']);
    expect(FULL_DURATION_MS).toBeLessThanOrEqual(8000);
    expect(SHORT_DURATION_MS).toBeGreaterThanOrEqual(1500);
    expect(SHORT_DURATION_MS).toBeLessThanOrEqual(2500);
  });

  it('stageAt maps time to the right beat with local progress', () => {
    expect(stageAt(0, 'full').id).toBe('order');
    expect(stageAt(500, 'full')).toMatchObject({ id: 'order', local: 0.5 });
    expect(stageAt(2750, 'full').id).toBe('processing');
    expect(stageAt(5600, 'full').id).toBe('qc');
    expect(stageAt(7000, 'full').id).toBe('delivery');
    expect(stageAt(99999, 'full').id).toBe('hold');
  });

  it('short + reduced variants have their own beats', () => {
    expect(SHORT_STAGES.map(s => s.id)).toEqual(['slidein', 'qc', 'delivery', 'hold']);
    expect(stageAt(0, 'short').id).toBe('slidein');
    expect(stageAt(0, 'reduced').id).toBe('reveal');
  });

  it('every variant has a deterministic completion', () => {
    for (const v of ['full', 'short', 'reduced'] as IntroVariant[]) {
      expect(isDone(durationFor(v), v)).toBe(true);
      expect(isDone(durationFor(v) - 1, v)).toBe(false);
      expect(skipTo(v)).toBe(durationFor(v));           // skipping jumps to the final held frame
      expect(isDone(skipTo(v), v)).toBe(true);
    }
  });

  it('QC greens in the second half of the QC beat (charming, not stuck red)', () => {
    expect(qcApproved(5100, 'full')).toBe(false);        // still scanning / red
    expect(qcApproved(6100, 'full')).toBe(true);         // approved
  });

  it('an early-input guard prevents accidental skips in the first ~400ms', () => {
    expect(inputAccepted(INPUT_GUARD_MS - 1)).toBe(false);
    expect(inputAccepted(INPUT_GUARD_MS)).toBe(true);
  });
});
