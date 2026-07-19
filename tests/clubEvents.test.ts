import { describe, it, expect } from 'vitest';
import {
  CLUB_INCIDENTS, clubIncidentIndex, clubIncidentFor, clubChoiceById, resolveClubChoice,
  CLUB_EVENTS, clubEventForVisit, clubEventById,
} from '../src/data/clubEvents.ts';
import { DAY_DURATION_MS } from '../src/world/daynight.ts';

const EPOCH = Date.UTC(2026, 0, 5);

describe('Club backstage micro-contract', () => {
  it('has well-formed incidents, each with 2+ choices', () => {
    expect(CLUB_INCIDENTS.length).toBeGreaterThanOrEqual(4);
    for (const inc of CLUB_INCIDENTS) {
      expect(inc.id && inc.title && inc.problem).toBeTruthy();
      expect(inc.choices.length).toBeGreaterThanOrEqual(2);
      for (const c of inc.choices) {
        expect(c.id && c.label).toBeTruthy();
        expect(c.cost).toBeGreaterThanOrEqual(0);
        expect(c.risk).toBeGreaterThanOrEqual(0);
        expect(c.risk).toBeLessThanOrEqual(1);
        if (c.risk > 0) expect(c.bad.length).toBeGreaterThan(0);   // risky options carry a failure line
      }
    }
  });

  it('rotates one incident per game day, deterministically and in range', () => {
    expect(clubIncidentIndex(EPOCH)).toBe(0);
    expect(clubIncidentIndex(EPOCH + DAY_DURATION_MS)).toBe(1);
    expect(clubIncidentIndex(EPOCH + CLUB_INCIDENTS.length * DAY_DURATION_MS)).toBe(0);
    for (const now of [EPOCH - 5 * DAY_DURATION_MS, EPOCH - 1, EPOCH + 999, Date.now()]) {
      const i = clubIncidentIndex(now);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(CLUB_INCIDENTS.length);
    }
    expect(clubIncidentFor(EPOCH).id).toBe(CLUB_INCIDENTS[0].id);
  });

  it('resolveClubChoice is deterministic given the roll (safe options never fail)', () => {
    const inc = CLUB_INCIDENTS[0];
    const safe = inc.choices.find(c => c.risk === 0)!;
    const r1 = resolveClubChoice(inc, safe.id, 0.0);
    const r2 = resolveClubChoice(inc, safe.id, 0.99);
    expect(r1!.failed).toBe(false);
    expect(r2!.failed).toBe(false);
    expect(r1!.cost).toBe(safe.cost);
    expect(r1!.rep).toBe(safe.rep);
  });

  it('risky options fail below their risk threshold and succeed above it', () => {
    const inc = CLUB_INCIDENTS.find(i => i.choices.some(c => c.risk > 0))!;
    const risky = inc.choices.find(c => c.risk > 0)!;
    const failRoll = resolveClubChoice(inc, risky.id, risky.risk - 0.001);
    const okRoll = resolveClubChoice(inc, risky.id, Math.min(0.999, risky.risk + 0.001));
    expect(failRoll!.failed).toBe(true);
    expect(failRoll!.rep).toBeLessThanOrEqual(0);      // failure never grants positive rep
    expect(okRoll!.failed).toBe(false);
    expect(okRoll!.message).toBe(risky.ok);
  });

  it('unknown choice ids resolve to null', () => {
    expect(resolveClubChoice(CLUB_INCIDENTS[0], 'nope')).toBeNull();
    expect(clubChoiceById(CLUB_INCIDENTS[0], 'nope')).toBeNull();
  });
});

describe('Club dynamic event pool', () => {
  it('has well-formed events with responses', () => {
    expect(CLUB_EVENTS.length).toBeGreaterThanOrEqual(4);
    for (const e of CLUB_EVENTS) {
      expect(e.id && e.title && e.prompt).toBeTruthy();
      expect(e.responses.length).toBeGreaterThanOrEqual(2);
      for (const r of e.responses) { expect(r.id && r.label).toBeTruthy(); expect(typeof r.rep).toBe('number'); }
    }
  });

  it('clubEventForVisit is deterministic and cycles (same visit → same event)', () => {
    expect(clubEventForVisit(0)).toBe(CLUB_EVENTS[0]);
    expect(clubEventForVisit(CLUB_EVENTS.length)).toBe(CLUB_EVENTS[0]);
    expect(clubEventForVisit(-1)).toBe(CLUB_EVENTS[CLUB_EVENTS.length - 1]);   // never out of range
    expect(clubEventForVisit(3)).toBe(clubEventForVisit(3));
  });

  it('clubEventById resolves known ids', () => {
    expect(clubEventById(CLUB_EVENTS[0].id)).toBe(CLUB_EVENTS[0]);
    expect(clubEventById('nope')).toBeNull();
  });
});
