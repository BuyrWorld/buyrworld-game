import { describe, it, expect } from 'vitest';
import { pixelScale } from '../src/world/renderer';

describe('pixelScale', () => {
  it('returns a value between 1 and 3 inclusive', () => {
    const s = pixelScale();
    expect(s).toBeGreaterThanOrEqual(1);
    expect(s).toBeLessThanOrEqual(3);
  });
  it('returns an integer', () => {
    expect(Number.isInteger(pixelScale())).toBe(true);
  });
  it('falls back to 1 in Node environment (no window)', () => {
    // window is undefined in the Node/Vitest environment
    expect(pixelScale()).toBe(1);
  });
});
