import { describe, it, expect } from 'vitest';
import { CUES, cueById, cuePower, cueAim, cueOwned, canBuyCue } from '../src/data/cues.ts';

describe('Pool cues', () => {
  it('are well-formed, start with a free house cue, and improve with price', () => {
    expect(new Set(CUES.map(c => c.id)).size).toBe(CUES.length);
    expect(CUES[0].id).toBe('house');
    expect(CUES[0].cost).toBe(0);
    for (let i = 1; i < CUES.length; i++) {
      expect(CUES[i].cost).toBeGreaterThan(CUES[i - 1].cost);
      expect(CUES[i].power).toBeGreaterThanOrEqual(CUES[i - 1].power);
      expect(CUES[i].aim).toBeGreaterThanOrEqual(CUES[i - 1].aim);
    }
  });
  it('advantages stay slight (power under +20%)', () => {
    for (const c of CUES) { expect(c.power).toBeLessThanOrEqual(1.2); expect(c.power).toBeGreaterThanOrEqual(1); }
  });
  it('cueById falls back to the house cue', () => {
    expect(cueById('ash').n).toBe('Ash Pro');
    expect(cueById('nope').id).toBe('house');
    expect(cuePower('master')).toBe(CUES[3].power);
    expect(cueAim('oak')).toBe(CUES[1].aim);
  });
  it('ownership + affordability', () => {
    expect(cueOwned([], 'house')).toBe(true);        // house is always owned
    expect(cueOwned([], 'oak')).toBe(false);
    expect(cueOwned(['oak'], 'oak')).toBe(true);
    expect(canBuyCue(500, [], 'oak')).toBe(true);
    expect(canBuyCue(400, [], 'oak')).toBe(false);   // too poor
    expect(canBuyCue(9999, ['oak'], 'oak')).toBe(false); // already owned
  });
});
