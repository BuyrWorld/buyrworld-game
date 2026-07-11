import { describe, it, expect } from 'vitest';
import {
  OFFENCES, offenceDef, computeSeverity, severityLabel, strikePointsFor,
  shouldEscalate, legalStatus, consequenceFor, spentDaysFor, isSpent,
  daysUntilSpent, debtCleared, roleEligibility, COMMUNITY_TASKS,
  communityTaskById, communityRehabDays,
  CRIMINAL_RANKS, criminalNotoriety, criminalRank, criminalRankIndex,
  atTopOfCriminalPath, nextCriminalRank, TOP_CRIMINAL_RANK_INDEX,
} from '../src/data/justice.ts';

describe('Justice — offence definitions', () => {
  it('defines all supported offences with a category', () => {
    for (const id of ['trespassing','theft','burglary','shoplifting','property_damage','antisocial','drunk_disorderly','financial']) {
      expect(offenceDef(id)).toBeTruthy();
      expect(['property','public-order','financial']).toContain(OFFENCES[id].category);
    }
    expect(offenceDef('murder')).toBeNull();   // excluded categories aren't defined
  });
});

describe('Justice — severity', () => {
  it('trespassing escalates when a warning is ignored, but a bare trespass stays low', () => {
    const bare = computeSeverity('trespassing', {});
    const warned = computeSeverity('trespassing', { warningsIgnored: true });
    expect(warned.level).toBeGreaterThan(bare.level);
    expect(bare.level).toBeLessThanOrEqual(2);      // never a major punishment for a first trespass
  });

  it('theft severity rises with item value', () => {
    expect(computeSeverity('theft', { value: 20 }).level)
      .toBeLessThan(computeSeverity('theft', { value: 500 }).level);
  });

  it('burglary is strictly more serious than theft of the same value', () => {
    for (const v of [10, 100, 300]) {
      expect(computeSeverity('burglary', { value: v }).level)
        .toBeGreaterThan(computeSeverity('theft', { value: v }).level);
    }
  });

  it('returning stolen goods reduces severity', () => {
    expect(computeSeverity('theft', { value: 150, returned: true }).level)
      .toBeLessThan(computeSeverity('theft', { value: 150 }).level);
  });

  it('drunk & disorderly requires a disruptive act — a drink alone is no offence', () => {
    expect(computeSeverity('drunk_disorderly', { intoxicated: true, disruptiveAction: false }).level).toBe(0);
    expect(computeSeverity('drunk_disorderly', { intoxicated: true, disruptiveAction: true }).level).toBeGreaterThan(0);
  });

  it('financial crime is serious and scales with value', () => {
    expect(computeSeverity('financial', { value: 50 }).level).toBeGreaterThanOrEqual(3);
    expect(computeSeverity('financial', { value: 1000 }).level).toBe(5);
  });

  it('gives a plain-language explanation (reasons, no formulas)', () => {
    const s = computeSeverity('theft', { value: 120, isHome: true });
    expect(s.reasons.length).toBeGreaterThan(0);
    expect(severityLabel(s.level)).toBeTruthy();
  });
});

describe('Justice — strike points & escalation', () => {
  it('maps severity to proportionate strike points (not one-per-offence)', () => {
    expect(strikePointsFor(1)).toBe(0);     // warning
    expect(strikePointsFor(2)).toBe(0.5);   // minor
    expect(strikePointsFor(3)).toBe(1);     // moderate
    expect(strikePointsFor(4)).toBe(2);     // serious
    expect(strikePointsFor(5)).toBe(3);     // major
  });

  it('escalates at three strike points OR on a single major offence', () => {
    expect(shouldEscalate(3, 2)).toBe(true);      // three strikes
    expect(shouldEscalate(0, 5)).toBe(true);      // single major
    expect(shouldEscalate(1, 2)).toBe(false);
  });

  it('legal status reflects the active strike total', () => {
    expect(legalStatus(0)).toBe('Clear record');
    expect(legalStatus(3)).toBe('Case escalated');
  });
});

describe('Justice — consequences (money cannot erase a record)', () => {
  it('a warning has no fine; a serious offence carries fine + community + detention', () => {
    expect(consequenceFor('trespassing', 1, {}).warningOnly).toBe(true);
    const c = consequenceFor('burglary', 4, { value: 200, hasGoods: true });
    expect(c.fine).toBeGreaterThan(0);
    expect(c.confiscate).toBe(true);
    expect(c.community).toBeGreaterThan(0);
    expect(c.detain).toBe(true);
  });
  it('a major offence flags escalation regardless of payment', () => {
    expect(consequenceFor('financial', 5, { value: 1000 }).escalate).toBe(true);
  });
});

describe('Justice — spent / rehabilitation', () => {
  const inc = { day: 10, level: 3, type: 'theft', fine: 40, finePaid: false, compensation: 0, compPaid: true };
  it('cannot become spent while a fine is outstanding', () => {
    expect(debtCleared(inc)).toBe(false);
    expect(isSpent(inc, 9999)).toBe(false);
  });
  it('becomes spent after the period once debts are cleared', () => {
    const paid = { ...inc, finePaid: true };
    expect(isSpent(paid, paid.day)).toBe(false);
    expect(isSpent(paid, paid.day + spentDaysFor('theft', 3))).toBe(true);
    expect(daysUntilSpent(paid, paid.day)).toBeGreaterThan(0);
  });
  it('an escalated case never quietly lapses', () => {
    expect(isSpent({ day: 0, level: 5, type: 'financial', escalate: true }, 99999)).toBe(false);
  });
  it('rehabilitation shortens the spent period (but never to nothing)', () => {
    expect(spentDaysFor('theft', 3, 3)).toBeLessThan(spentDaysFor('theft', 3, 0));
    expect(spentDaysFor('theft', 3, 999)).toBeGreaterThanOrEqual(2);
  });
});

describe('Justice — employment eligibility', () => {
  it('an active serious financial offence blocks high-trust money roles, with a clear reason', () => {
    const r = roleEligibility([{ type: 'financial', category: 'financial', level: 4 }], 'money');
    expect(r.eligible).toBe(false);
    expect(r.reason.length).toBeGreaterThan(20);
    expect(r.reason).not.toMatch(/you cannot do this/i);
  });
  it('an active theft blocks security roles', () => {
    expect(roleEligibility([{ type: 'theft', level: 3 }], 'security').eligible).toBe(false);
  });
  it('a clean record is eligible for everything', () => {
    expect(roleEligibility([], 'money').eligible).toBe(true);
    expect(roleEligibility([], 'security').eligible).toBe(true);
    expect(roleEligibility([{ type: 'trespassing', level: 2 }], 'money').eligible).toBe(true);
  });
});

describe('Justice — community service (no farming)', () => {
  it('has assignable tasks and a capped rehab credit', () => {
    expect(COMMUNITY_TASKS.length).toBeGreaterThanOrEqual(4);
    expect(communityTaskById(COMMUNITY_TASKS[0].id)).toBeTruthy();
    expect(communityTaskById('nope')).toBeNull();
    expect(communityRehabDays(100)).toBeLessThanOrEqual(4);   // capped, can't grind
    expect(communityRehabDays(0)).toBe(0);
  });
});

describe('Justice — criminal career ladder (Con-venue gate)', () => {
  const inc = (level, n = 1) => Array.from({ length: n }, () => ({ level }));

  it('warnings and a single minor slip never make someone a career criminal', () => {
    expect(criminalNotoriety(inc(1, 5))).toBe(0);           // level-1 warnings don't count
    expect(criminalRank([]).id).toBe('clean');
    expect(criminalRankIndex(inc(2))).toBeLessThan(TOP_CRIMINAL_RANK_INDEX);
    expect(atTopOfCriminalPath(inc(2))).toBe(false);        // one minor offence: still a civilian
    expect(atTopOfCriminalPath(inc(4))).toBe(false);        // even one serious offence isn't the top
  });

  it('notoriety accumulates by severity and ranks climb monotonically', () => {
    expect(criminalNotoriety([{ level: 2 }, { level: 4 }, { level: 5 }])).toBe(1 + 6 + 10);
    let last = -1;
    for (const n of [0, 5, 15, 30, 50, 100]) {
      const idx = criminalRankIndex(inc(5, Math.ceil(n / 10)));
      expect(idx).toBeGreaterThanOrEqual(last);
      last = idx;
    }
  });

  it('only sustained serious offending reaches the top rank / Con venue', () => {
    expect(atTopOfCriminalPath(inc(5, 6))).toBe(false);     // 60 notoriety — Underworld fixer, not yet
    expect(atTopOfCriminalPath(inc(5, 7))).toBe(true);      // 70 — Kingpin: the Con venue unlocks
    expect(criminalRank(inc(5, 7)).id).toBe('kingpin');
    expect(nextCriminalRank(inc(5, 7))).toBeNull();         // nothing above the top
    // a persistent petty criminal can also get there, but it takes a LOT of offences
    expect(atTopOfCriminalPath(inc(2, 69))).toBe(false);
    expect(atTopOfCriminalPath(inc(2, 70))).toBe(true);
  });

  it('the ladder is ordered low→high with the top index consistent', () => {
    for (let i = 1; i < CRIMINAL_RANKS.length; i++) expect(CRIMINAL_RANKS[i].min).toBeGreaterThan(CRIMINAL_RANKS[i - 1].min);
    expect(TOP_CRIMINAL_RANK_INDEX).toBe(CRIMINAL_RANKS.length - 1);
    expect(CRIMINAL_RANKS[TOP_CRIMINAL_RANK_INDEX].id).toBe('kingpin');
  });
});
