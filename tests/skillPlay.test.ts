import { describe, it, expect } from 'vitest';
import {
  APPROACHES, STARTER_SKILLS, defaultApproach, approachById, automationApproach, automationCost,
  resolvedYield, resolvedTimeMult, rareDrops, needsRework, outcomeSummary, reel, BITE_WINDOW_MS,
  isStarterSkill, costWithCarry, type StarterSkill,
} from '../src/data/skillPlay.ts';

describe('skill approaches — structure', () => {
  it('covers all five starter skills, each with ≥2 approaches', () => {
    expect(STARTER_SKILLS).toEqual(['mining', 'woodcutting', 'fishing', 'steelworks', 'manufacturing']);
    for (const s of STARTER_SKILLS) expect(APPROACHES[s].length).toBeGreaterThanOrEqual(2);
    expect(isStarterSkill('mining')).toBe(true);
    expect(isStarterSkill('trading')).toBe(false);
  });

  it('every skill offers at least two GENUINELY different, viable strategies', () => {
    for (const s of STARTER_SKILLS) {
      const sigs = APPROACHES[s].map(a => `${a.timeMult}|${a.bonusYield}|${a.qualityDelta}|${a.costMult}|${a.rareChance}|${a.reworkRisk}`);
      expect(new Set(sigs).size, `${s} approaches differ`).toBe(APPROACHES[s].length);
      // no approach is a pure free lunch vs the default (faster AND more yield AND cheaper AND better quality)
      const def = defaultApproach(s);
      for (const a of APPROACHES[s]) {
        if (a.id === def.id) continue;
        // "free lunch" = no worse on ANY axis (time, yield, cost, quality, rare chance,
        // tool wear) and strictly better on at least one. Every approach must give up
        // something, so this is never true.
        const noWorse = a.timeMult <= def.timeMult && a.bonusYield >= def.bonusYield && a.costMult <= def.costMult && a.qualityDelta >= def.qualityDelta && a.rareChance >= def.rareChance && a.wear <= def.wear;
        const better = a.timeMult < def.timeMult || a.bonusYield > def.bonusYield || a.costMult < def.costMult || a.qualityDelta > def.qualityDelta || a.rareChance > def.rareChance || a.wear < def.wear;
        const strictlyBetter = noWorse && better;
        expect(strictlyBetter, `${s}/${a.id} must trade something off`).toBe(false);
      }
    }
  });

  it('the default is balanced (no time/cost penalty or bonus)', () => {
    for (const s of STARTER_SKILLS) {
      const d = defaultApproach(s);
      expect(d.timeMult).toBe(1);
      expect(d.costMult).toBe(1);
      expect(d.bonusYield).toBe(0);
    }
    expect(approachById('mining', 'nonsense').id).toBe(defaultApproach('mining').id);   // safe fallback
  });
});

describe('skill approaches — deterministic outcomes', () => {
  it('mining seams trade yield + gem chance against tool wear and time', () => {
    const surface = approachById('mining', 'surface'), deep = approachById('mining', 'deep');
    expect(resolvedTimeMult(surface)).toBeLessThan(1);
    expect(surface.wear).toBeLessThan(approachById('mining', 'steady').wear);
    expect(resolvedYield(3, deep)).toBe(4);                 // deep seam: +1 ore, exact
    expect(deep.wear).toBeGreaterThan(surface.wear);
    expect(deep.rareChance).toBeGreaterThan(surface.rareChance);
  });

  it('woodcutting: fast is quicker with no rare wood; careful is slower with +1 log and best rare chance', () => {
    const fast = approachById('woodcutting', 'fast'), careful = approachById('woodcutting', 'careful');
    expect(resolvedTimeMult(fast)).toBeLessThan(1);
    expect(fast.rareChance).toBe(0);
    expect(resolvedYield(1, careful)).toBe(2);
    expect(careful.rareChance).toBeGreaterThan(approachById('woodcutting', 'safe').rareChance);
  });

  it('smelting profiles trade fuel + time against bar quality', () => {
    const eco = approachById('steelworks', 'economical'), fast = approachById('steelworks', 'fast'), quality = approachById('steelworks', 'quality');
    expect(eco.costMult).toBeLessThan(1);        // less fuel
    expect(eco.qualityDelta).toBeLessThan(0);    // …rougher bars
    expect(fast.costMult).toBeGreaterThan(1);    // fast drinks fuel
    expect(quality.qualityDelta).toBeGreaterThan(0);
    expect(resolvedTimeMult(quality)).toBeGreaterThan(1);
  });

  it('manufacturing tolerance: tight = better quality but more time and rework', () => {
    const loose = approachById('manufacturing', 'loose'), tight = approachById('manufacturing', 'tight');
    expect(tight.qualityDelta).toBeGreaterThan(loose.qualityDelta);
    expect(resolvedTimeMult(tight)).toBeGreaterThan(resolvedTimeMult(loose));
    expect(tight.reworkRisk).toBeGreaterThan(loose.reworkRisk);
    // deterministic rework given a roll
    expect(needsRework(tight, 0.10)).toBe(true);      // 0.10 < 0.14
    expect(needsRework(tight, 0.20)).toBe(false);
    expect(needsRework(loose, 0.10)).toBe(false);     // 0.10 > 0.02
  });

  it('rare drops are a deterministic function of the roll', () => {
    const careful = approachById('woodcutting', 'careful');   // 0.12
    expect(rareDrops(careful, 0.05)).toBe(true);
    expect(rareDrops(careful, 0.50)).toBe(false);
    expect(rareDrops(approachById('woodcutting', 'fast'), 0.0)).toBe(false);   // fast never drops rare
  });

  it('resolvedYield is exact and never negative', () => {
    expect(resolvedYield(2, defaultApproach('mining'))).toBe(2);
    expect(resolvedYield(0, approachById('mining', 'deep'))).toBe(1);
    expect(resolvedYield(1, { ...defaultApproach('mining'), bonusYield: -5 })).toBe(0);
  });
});

describe('exact input accounting under a costMult (fuel)', () => {
  it('aggregate consumption tracks N · base · costMult within a single item — never fractional or lost', () => {
    for (const mult of [0.8, 1.2, 1.15]) {
      let carry = 0, total = 0;
      const N = 50, base = 3;
      const want = N * base * mult;
      for (let i = 0; i < N; i++) { const r = costWithCarry(base, mult, carry); total += r.take; carry = r.carry; expect(Number.isInteger(r.take)).toBe(true); }
      expect(total).toBe(Math.floor(want + 1e-9));        // the only "loss" is the sub-1 residual held in carry
      expect(want - total).toBeLessThan(1);               // …so it never drifts by a whole item
      expect(carry).toBeCloseTo(want - total, 6);         // the residual is exactly the uncommitted carry
    }
  });
  it('never returns a negative or fractional take, and carry stays in [0,1)', () => {
    const r = costWithCarry(1, 0.8, 0.5);
    expect(r.take).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(r.take)).toBe(true);
    expect(r.carry).toBeGreaterThanOrEqual(0);
    expect(r.carry).toBeLessThan(1);
  });
});

describe('automation carries a measurable cost', () => {
  it('automatons run only the default approach, forgoing the skilled bonus', () => {
    for (const s of STARTER_SKILLS) {
      expect(automationApproach(s).id).toBe(defaultApproach(s).id);
    }
    // deep-seam mining and careful woodcutting yield +1 that an automaton can never get
    expect(automationCost('mining').yield).toBe(1);
    expect(automationCost('woodcutting').yield).toBe(1);
    // tight-tolerance manufacturing quality is off the table for automatons
    expect(automationCost('manufacturing').quality).toBeGreaterThan(0);
  });
});

describe('fishing bite-and-reel', () => {
  it('assisted mode always lands a solid catch (no timing skill required)', () => {
    const r = reel(0, 0, { assisted: true });
    expect(r.ok).toBe(true);
    expect(r.quality).toBeGreaterThan(0.5);
    expect(r.reason).toBe('assisted');
  });

  it('a generous window: reeling anytime after the bite lands a catch', () => {
    const bite = 10_000;
    expect(reel(bite + 10, bite).ok).toBe(true);
    expect(reel(bite + BITE_WINDOW_MS - 1, bite).ok).toBe(true);
    // quality is best right after the bite and eases off, but never punishing
    expect(reel(bite + 10, bite).quality).toBeGreaterThan(reel(bite + BITE_WINDOW_MS - 1, bite).quality);
    expect(reel(bite + BITE_WINDOW_MS - 1, bite).quality).toBeGreaterThanOrEqual(0.4);
  });

  it('reeling before the bite or after the window misses (deterministically)', () => {
    const bite = 10_000;
    expect(reel(bite - 100, bite).reason).toBe('early');
    expect(reel(bite + BITE_WINDOW_MS + 1, bite).reason).toBe('missed');
  });
});

describe('outcomeSummary reads the same for every input method', () => {
  it('describes the consequence in plain text (shown before confirming)', () => {
    expect(outcomeSummary(approachById('mining', 'deep'))).toContain('+1 yield');
    expect(outcomeSummary(approachById('steelworks', 'economical'))).toContain('less fuel');
    expect(outcomeSummary(approachById('manufacturing', 'tight'))).toContain('rework');
    expect(outcomeSummary(defaultApproach('steelworks'))).toBe('balanced');
  });
});
