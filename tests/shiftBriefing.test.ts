import { describe, it, expect } from 'vitest';
import { buildBriefing, awayLabel, MIN_ABSENCE_MS, SHORT_ABSENCE_MS, type ShiftInput } from '../src/data/shiftBriefing.ts';

// A calm baseline: returned after 2 hours, nothing pending, mid-journey.
function base(overrides: Partial<ShiftInput> = {}): ShiftInput {
  const now = 1_000_000_000;
  return {
    now,
    lastSeen: now - 2 * 3600 * 1000,
    offline: { coins: 0, lines: [] },
    journey: { title: 'Open for Business', desc: 'Strike 5 deals at the Market Hall.', cur: 2, max: 5, pct: 40, claimable: false, complete: false },
    contracts: { pending: 0, deliverable: 0, expiredDuringAbsence: 0 },
    flagship: { active: false, stageLabel: null, decision: false },
    economy: { phaseName: 'Steady Trade', phaseId: 'steady', changed: false, demand: 1 },
    reputation: { expiredDent: false, delta: 0, note: null },
    claimable: { any: false, label: null },
    cottage: { active: false, band: 'Tidy', needsClean: false },
    production: { running: false, label: null },
    ...overrides,
  };
}
const ids = (b: ReturnType<typeof buildBriefing>) => b.items.map(i => i.id);

describe('shift briefing — visibility rules', () => {
  it('does not brief for a barely-there absence', () => {
    const b = buildBriefing(base({ lastSeen: 999_999_000 /* ~1s ago */ }), { skipShort: false });
    expect(b.show).toBe(false);
  });

  it('SHORT absence: shown by default, suppressed once "don\'t show for short" is on', () => {
    const shortInput = base({ lastSeen: base().now - 5 * 60 * 1000 });   // 5 min
    expect(buildBriefing(shortInput, { skipShort: false }).show).toBe(true);
    expect(buildBriefing(shortInput, { skipShort: true }).show).toBe(false);
    expect(buildBriefing(shortInput, { skipShort: false }).short).toBe(true);
  });

  it('LONG absence is always shown', () => {
    const b = buildBriefing(base({ lastSeen: base().now - 6 * 3600 * 1000 }), { skipShort: true });
    expect(b.show).toBe(true);
    expect(b.short).toBe(false);
    expect(b.awayLabel).toMatch(/hr/);
  });

  it('important events pierce the skip-short preference (expired / claimable / flagship decision)', () => {
    const shortAway = base().now - 5 * 60 * 1000;
    expect(buildBriefing(base({ lastSeen: shortAway, contracts: { pending: 1, deliverable: 0, expiredDuringAbsence: 2 } }), { skipShort: true }).show).toBe(true);
    expect(buildBriefing(base({ lastSeen: shortAway, claimable: { any: true, label: 'Welcome gift ready' } }), { skipShort: true }).show).toBe(true);
    expect(buildBriefing(base({ lastSeen: shortAway, flagship: { active: true, stageLabel: 'production', decision: true } }), { skipShort: true }).show).toBe(true);
  });
});

describe('shift briefing — content is relevant only', () => {
  it('no pending work: a calm briefing that still recommends the journey next step', () => {
    const b = buildBriefing(base(), { skipShort: false });
    expect(b.show).toBe(true);
    expect(ids(b)).not.toContain('expired');
    expect(ids(b)).not.toContain('cottage');
    expect(ids(b)).toContain('journey');
    expect(b.recommended?.action).toBe('start');                 // fall back to the journey objective
    expect(b.recommended?.label).toContain('Market Hall');
  });

  it('active flagship order: surfaces the stage and recommends resuming', () => {
    const b = buildBriefing(base({ flagship: { active: true, stageLabel: 'dispatch decision', decision: true } }), { skipShort: false });
    expect(ids(b)).toContain('flagship');
    expect(b.recommended?.action).toBe('resume');
  });

  it('expired contract: explained fairly (no penalty framing) and never blames the player', () => {
    const b = buildBriefing(base({ contracts: { pending: 3, deliverable: 0, expiredDuringAbsence: 2 } }), { skipShort: false });
    const item = b.items.find(i => i.id === 'expired')!;
    expect(item.kind).toBe('warn');
    expect(item.text).toMatch(/sourced elsewhere/i);
    expect(item.text).toMatch(/no fee lost/i);          // fair: not framed as a loss/punishment
    expect(item.text).not.toMatch(/penalty|failed|you lost/i);
  });

  it('claimable milestone: recommends claiming above everything else', () => {
    const b = buildBriefing(base({ journey: { ...base().journey, claimable: true, title: 'Trader' }, contracts: { pending: 2, deliverable: 1, expiredDuringAbsence: 0 } }), { skipShort: false });
    expect(b.recommended?.action).toBe('claim');
    expect(b.items.find(i => i.id === 'journey')?.kind).toBe('good');
  });

  it('cottage cleaning required: shown + a cottage button, but a tidy home is never nagged', () => {
    const dirty = buildBriefing(base({ cottage: { active: true, band: 'Messy', needsClean: true } }), { skipShort: false });
    expect(ids(dirty)).toContain('cottage');
    expect(dirty.showCottageButton).toBe(true);

    const clean = buildBriefing(base({ cottage: { active: true, band: 'Sparkling', needsClean: false } }), { skipShort: false });
    expect(ids(clean)).not.toContain('cottage');
    expect(clean.showCottageButton).toBe(false);
  });

  it('does not invent offline production and only echoes real earnings', () => {
    const none = buildBriefing(base(), { skipShort: false });
    expect(ids(none)).not.toContain('offline');
    const some = buildBriefing(base({ offline: { coins: 120, lines: ['🏦 Bank interest: +120'] } }), { skipShort: false });
    const off = some.items.find(i => i.id === 'offline')!;
    expect(off.text).toContain('+120 coins');
    expect(off.text).toContain('Bank interest');
  });

  it('market change only surfaces when the phase actually changed', () => {
    expect(ids(buildBriefing(base({ economy: { phaseName: 'Boom', phaseId: 'boom', changed: false, demand: 1.1 } }), { skipShort: false }))).not.toContain('economy');
    expect(ids(buildBriefing(base({ economy: { phaseName: 'Boom', phaseId: 'boom', changed: true, demand: 1.1 } }), { skipShort: false }))).toContain('economy');
  });

  it('recommendation priority: deliverable contract beats cottage cleaning', () => {
    const b = buildBriefing(base({ contracts: { pending: 1, deliverable: 1, expiredDuringAbsence: 0 }, cottage: { active: true, band: 'Messy', needsClean: true } }), { skipShort: false });
    expect(b.recommended?.action).toBe('contracts');
  });
});

describe('awayLabel', () => {
  it('formats minutes, hours and days', () => {
    expect(awayLabel(5 * 60 * 1000)).toBe('5 min');
    expect(awayLabel(2 * 3600 * 1000)).toMatch(/2.*hr/);
    expect(awayLabel(3 * 24 * 3600 * 1000)).toBe('3 days');
  });
});
