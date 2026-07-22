import { describe, it, expect } from 'vitest';
import { NEWS_MASTHEAD, pickMovers, compileEdition } from '../src/data/news.ts';

const item = (id: string, pressure: number) => ({ id, name: id, ic: '📦', pressure });

describe('M23 Featherstone Chronicle — pure compiler', () => {
  it('picks risers (scarce) and fallers (glut), biggest moves first', () => {
    const { risers, fallers } = pickMovers([
      item('a', 1.40), item('b', 1.10), item('c', 0.60), item('d', 0.90), item('e', 1.00),
    ]);
    expect(risers.map(m => m.id)).toEqual(['a', 'b']);         // 1.00 neutral excluded, sorted desc
    expect(risers[0].pct).toBe(40);
    expect(risers[0].arrow).toBe('↑');
    expect(fallers.map(m => m.id)).toEqual(['c', 'd']);        // most-fallen first
    expect(fallers[0].pct).toBe(-40);
    expect(fallers[0].arrow).toBe('↓');
  });

  it('caps movers at n and ignores malformed pressures', () => {
    const many = Array.from({ length: 10 }, (_, i) => item('r' + i, 1.1 + i * 0.02));
    const { risers } = pickMovers([...many, { id: 'bad' } as any, null as any], 4);
    expect(risers.length).toBe(4);
  });

  it('compiles a complete, well-formed edition', () => {
    const ed = compileEdition({
      day: 12, dateline: 'Day 12',
      phase: { head: '📈 Boom', tone: 'good', flavour: ['fat margins', 'hiring'] },
      pressures: [item('iron', 1.3), item('wood', 0.7)],
      market: [{ icon: '📈', text: 'Iron up', tone: 'good' }],
      valley: ['Spring Fair opens'],
      headlines: [{ ic: '📦', text: 'You delivered 50 brackets.' }],
    });
    expect(ed.masthead).toBe(NEWS_MASTHEAD);
    expect(ed.day).toBe(12);
    expect(ed.climate.head).toBe('📈 Boom');
    expect(ed.risers[0].id).toBe('iron');
    expect(ed.fallers[0].id).toBe('wood');
    expect(ed.business[0].text).toContain('brackets');
    expect(ed.filler.length).toBeGreaterThan(0);
  });

  it('is deterministic: same day → same flavour + filler', () => {
    const ctx = {
      day: 7, dateline: 'Day 7',
      phase: { head: 'h', tone: '', flavour: ['x', 'y', 'z'] },
      pressures: [], market: [], valley: [], headlines: [],
    };
    const a = compileEdition(ctx), b = compileEdition(ctx);
    expect(a.climate.flavour).toBe(b.climate.flavour);
    expect(a.filler).toBe(b.filler);
    // a different day can select different flavour/ad (deterministically)
    const c = compileEdition({ ...ctx, day: 8 });
    expect(typeof c.filler).toBe('string');
  });

  it('bounds each section and tolerates empty inputs', () => {
    const ed = compileEdition({
      day: 0, dateline: '',
      phase: null as any,
      pressures: [],
      market: Array.from({ length: 20 }, (_, i) => ({ icon: '•', text: 't' + i, tone: '' })),
      valley: Array.from({ length: 20 }, (_, i) => 'v' + i),
      headlines: Array.from({ length: 20 }, (_, i) => ({ ic: '•', text: 'h' + i })),
    });
    expect(ed.climate.head).toBeTruthy();     // safe default when phase missing
    expect(ed.market.length).toBe(6);
    expect(ed.valley.length).toBe(4);
    expect(ed.business.length).toBe(6);
    expect(ed.risers).toEqual([]);
    expect(ed.fallers).toEqual([]);
  });
});
