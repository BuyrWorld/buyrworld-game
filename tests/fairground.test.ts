import { describe, it, expect } from 'vitest';
import { STRIKER_FEE, strikerReward } from '../src/data/fairground.ts';

describe('Fairground — High Striker', () => {
  it('has a positive swing fee', () => { expect(STRIKER_FEE).toBeGreaterThan(0); });
  it('reward rises with power and the bell needs a near-perfect swing', () => {
    expect(strikerReward(10).coins).toBeLessThan(strikerReward(40).coins);
    expect(strikerReward(40).coins).toBeLessThan(strikerReward(60).coins);
    expect(strikerReward(60).coins).toBeLessThan(strikerReward(85).coins);
    expect(strikerReward(85).coins).toBeLessThan(strikerReward(100).coins);
    expect(strikerReward(94).bell).toBe(false);
    expect(strikerReward(95).bell).toBe(true);
    expect(strikerReward(100).tier).toBe('jackpot');
    expect(strikerReward(0).tier).toBe('weak');
  });
});
