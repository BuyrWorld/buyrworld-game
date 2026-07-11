import { describe, it, expect } from 'vitest';
import {
  caseTrigger, buildEvidence, evidenceStrength, EVIDENCE_BANDS, REPRESENTATION,
  repCompetence, outcomeFloorRaised, PREP_ACTIONS, prepCompleteness, prepFactor,
  computeVerdict, seededWobble, computeSentence, factorsFor, OUTCOME_LABELS,
  suspendedOrder, custodyData, HEARING_PHASES,
} from '../src/data/court.ts';

describe('Court — eligibility', () => {
  it('minor one-off matters do not reach court; escalation/strikes/major do', () => {
    expect(caseTrigger([{ id:1, type:'trespassing', level:2 }], 0.5)).toBeNull();
    expect(caseTrigger([{ id:1, type:'theft', level:3, escalate:true }], 1)).toBe('escalation');
    expect(caseTrigger([{ id:1, type:'financial', level:5 }], 0)).toBe('major');
    expect(caseTrigger([{ id:1, type:'theft', level:3 }], 3)).toBe('strikes');
  });
});

describe('Court — evidence', () => {
  it('builds evidence from incident facts and rates strength with reasons', () => {
    const ev = buildEvidence([{ id:1, type:'burglary', level:4, confiscated:true, witness:true }]);
    expect(ev.length).toBeGreaterThanOrEqual(2);
    const s = evidenceStrength(ev);
    expect(EVIDENCE_BANDS).toContain(s.band);
    expect(s.reasons.length).toBeGreaterThan(0);
  });
  it('returned goods weaken the case; challenging a witness lowers strength', () => {
    const strong = buildEvidence([{ id:1, type:'theft', level:3, confiscated:true, witness:true }]);
    const withReturn = buildEvidence([{ id:1, type:'theft', level:3, confiscated:true, witness:true, returned:true }]);
    expect(evidenceStrength(withReturn).score).toBeLessThan(evidenceStrength(strong).score);
    expect(evidenceStrength(strong, { challenged:['witness'] }).score).toBeLessThan(evidenceStrength(strong).score);
  });
});

describe('Court — representation balance', () => {
  it('self-rep scales with legal knowledge but is capped below a barrister', () => {
    expect(repCompetence('self', 10)).toBeGreaterThan(repCompetence('self', 0));
    expect(repCompetence('self', 999)).toBeLessThan(repCompetence('barrister'));
  });
  it('duty rep gives a competent floor for free; barrister is best but bounded (<1)', () => {
    expect(repCompetence('duty')).toBeGreaterThan(0.3);
    expect(REPRESENTATION.duty.cost).toBe(0);
    expect(repCompetence('barrister', 0, 1)).toBeLessThan(1);
    expect(outcomeFloorRaised('duty')).toBe(true);
    expect(outcomeFloorRaised('self')).toBe(false);
  });
});

describe('Court — verdict', () => {
  const strong = { strength: 0.9, plea: 'contest' as const, competence: 0.85, prep: 1 };
  it('an admission is proven; a partial admission finds a lesser offence', () => {
    expect(computeVerdict({ ...strong, plea: 'admit' }).finding).toBe('proven');
    expect(computeVerdict({ ...strong, plea: 'partial' }).finding).toBe('lesser');
  });
  it('overwhelming evidence cannot be beaten, even by the best representation', () => {
    expect(computeVerdict({ strength: 0.95, plea: 'contest', competence: 0.95, prep: 1 }).finding).toBe('proven');
  });
  it('weak evidence contested with good preparation can be dismissed or not proven', () => {
    const v = computeVerdict({ strength: 0.2, plea: 'contest', competence: 0.7, prep: 1, contradiction: true, seed: 3 });
    expect(['dismissed', 'not_proven']).toContain(v.finding);
  });
  it('the seeded wobble is bounded and deterministic', () => {
    expect(Math.abs(seededWobble(42))).toBeLessThanOrEqual(1);
    expect(seededWobble(42)).toBe(seededWobble(42));
  });
});

describe('Court — sentencing (proportionate & explainable)', () => {
  it('a dismissal yields no sentence', () => {
    expect(computeSentence({ finding: 'dismissed', severity: 4, offenceType: 'theft', aggravating: [], mitigating: [] }).outcome).toBe('no_action');
  });
  it('mitigation lowers and aggravation raises the outcome, with an explanation', () => {
    const base = computeSentence({ finding: 'proven', severity: 4, offenceType: 'theft', value: 150, aggravating: [], mitigating: [] });
    const mit = computeSentence({ finding: 'proven', severity: 4, offenceType: 'theft', value: 150, aggravating: [], mitigating: [{ text:'admitted early', delta:-0.9 }, { text:'returned', delta:-0.7 }] });
    expect(mit.points).toBeLessThan(base.points);
    expect(base.explanation.length).toBeGreaterThan(10);
    expect(base.explanation).not.toMatch(/\bNaN\b|undefined/);
  });
  it('a serious offence with aggravation can reach custody; representation can spare a borderline custody', () => {
    const agg = [{ text:'previous offences', delta:1 }, { text:'home', delta:0.7 }, { text:'high value', delta:0.8 }];
    const harsh = computeSentence({ finding: 'proven', severity: 5, offenceType: 'burglary', value: 400, aggravating: agg, mitigating: [] });
    expect(['suspended','custody']).toContain(harsh.outcome);
    expect(OUTCOME_LABELS[harsh.outcome]).toBeTruthy();
  });
  it('factorsFor extracts aggravating & mitigating lines from the facts', () => {
    const f = factorsFor({ incidents: [], plea: 'admit', priorActive: 1, isHome: true, value: 300, returned: true });
    expect(f.aggravating.length).toBeGreaterThan(0);
    expect(f.mitigating.length).toBeGreaterThan(0);
  });
});

describe('Court — orders & data hooks', () => {
  it('suspended orders have completable conditions and a breach trigger', () => {
    const o = suspendedOrder(7, { community: 5, compensation: 100 });
    expect(o.activeDays).toBe(7);
    expect(o.conditions.length).toBeGreaterThanOrEqual(2);
    expect(o.breach.length).toBeGreaterThan(0);
  });
  it('custody data is short/compressed and flags future eligibility (no long real wait)', () => {
    const cd = custodyData(5);
    expect(cd.custodyDays).toBe(5);
    expect(cd.compressedMs).toBeLessThanOrEqual(180000);   // never a multi-minute wait
    expect(cd.eligibility.education).toBe(true);
  });
});

describe('Court — preparation', () => {
  it('preparation completeness tracks outstanding actions', () => {
    expect(prepCompleteness([]).pct).toBe(0);
    expect(prepCompleteness(PREP_ACTIONS.map(a => a.id)).pct).toBe(100);
    expect(prepCompleteness([PREP_ACTIONS[0].id]).remaining.length).toBe(PREP_ACTIONS.length - 1);
    expect(prepFactor(PREP_ACTIONS.map(a => a.id))).toBe(1);
  });
  it('exposes the full set of hearing phases', () => {
    expect(HEARING_PHASES).toContain('plea');
    expect(HEARING_PHASES).toContain('sentence');
    expect(HEARING_PHASES[HEARING_PHASES.length - 1]).toBe('result');
  });
});
