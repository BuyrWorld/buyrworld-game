import { describe, it, expect } from 'vitest';
import { ANALYTICS_EVENTS, appendEvent, eventCounts, sanitizeProps, isAnalyticsEvent, ANALYTICS_CAP } from '../src/data/analytics.ts';

describe('analytics — privacy-safe funnel log', () => {
  it('defines exactly the nine required flagship events', () => {
    expect([...ANALYTICS_EVENTS]).toEqual([
      'flagship_opened', 'quotation_reviewed', 'supplier_selected', 'production_strategy_selected',
      'disruption_response', 'quality_decision', 'delivered', 'abandoned', 'final_margin',
    ]);
  });

  it('appends valid events and ignores unknown ones', () => {
    let log: any[] = [];
    log = appendEvent(log, 'flagship_opened', 1, { qty: 12 });
    log = appendEvent(log, 'not_a_real_event' as any, 2, {});
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ e: 'flagship_opened', t: 1, p: { qty: 12 } });
    expect(isAnalyticsEvent('final_margin')).toBe(true);
    expect(isAnalyticsEvent('nope')).toBe(false);
  });

  it('strips anything that could be PII — keeps only primitive game values', () => {
    const p = sanitizeProps({
      qty: 12, onTime: true, batch: 'careful',
      playerName: 'x'.repeat(64),                 // long free text → dropped
      email: 'a@b.com'.padEnd(40, 'z'),           // >32 chars → dropped
      nested: { secret: 1 }, fn: () => 1, nan: NaN,
    });
    expect(p).toEqual({ qty: 12, onTime: true, batch: 'careful' });
    expect('playerName' in p).toBe(false);
    expect('email' in p).toBe(false);
    expect('nested' in p).toBe(false);
  });

  it('counts events by name', () => {
    let log: any[] = [];
    log = appendEvent(log, 'supplier_selected', 1);
    log = appendEvent(log, 'supplier_selected', 2);
    log = appendEvent(log, 'delivered', 3);
    expect(eventCounts(log)).toEqual({ supplier_selected: 2, delivered: 1 });
  });

  it('caps the ring buffer so it never grows unbounded', () => {
    let log: any[] = [];
    for (let i = 0; i < ANALYTICS_CAP + 50; i++) log = appendEvent(log, 'final_margin', i);
    expect(log).toHaveLength(ANALYTICS_CAP);
    expect(log[log.length - 1].t).toBe(ANALYTICS_CAP + 49);   // newest kept
    expect(log[0].t).toBe(50);                                // oldest dropped
  });
});
