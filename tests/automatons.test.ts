import { describe, it, expect } from 'vitest';
import { AUTOMATONS, SKILL_GROUP, automatonById, automatonsForSkill, autoSpeedMult, autoYieldChance } from '../src/data/automatons.ts';
import ITEMS from '../src/data/items.json';

describe('Robotics automatons', () => {
  it('every automaton targets a real group and has a valid effect', () => {
    for (const a of AUTOMATONS) {
      expect(['gather', 'process']).toContain(a.group);
      expect(['speed', 'yield']).toContain(a.kind);
      if (a.kind === 'speed') { expect(a.val).toBeGreaterThan(0); expect(a.val).toBeLessThan(1); } // <1 = faster
      if (a.kind === 'yield') { expect(a.val).toBeGreaterThan(0); expect(a.val).toBeLessThanOrEqual(0.5); }
      expect(a.cost.coins).toBeGreaterThan(0);
    }
  });

  it('every build-cost item exists in the item registry', () => {
    for (const a of AUTOMATONS) for (const id of Object.keys(a.cost.items)) {
      expect((ITEMS as any)[id], `${a.id} → ${id}`).toBeTruthy();
    }
  });

  it('offers only group-appropriate automatons per skill', () => {
    for (const skill of Object.keys(SKILL_GROUP)) {
      const opts = automatonsForSkill(skill);
      expect(opts.length).toBeGreaterThan(0);
      for (const a of opts) expect(a.group).toBe(SKILL_GROUP[skill]);
    }
    expect(automatonsForSkill('trading')).toEqual([]); // non-action skills can't be automated
  });

  it('speed & yield bonuses apply only to a matching assignment', () => {
    const drone = AUTOMATONS.find(a => a.id === 'gather_drone')!;   // speed, gather
    const opt = AUTOMATONS.find(a => a.id === 'yield_optimizer')!;   // yield, process
    // gather drone speeds a gather skill, not a process skill
    expect(autoSpeedMult('mining', drone.id)).toBe(drone.val);
    expect(autoSpeedMult('steelworks', drone.id)).toBe(1);
    expect(autoSpeedMult('mining', undefined)).toBe(1);
    // yield optimizer boosts a process skill only
    expect(autoYieldChance('manufacturing', opt.id)).toBe(opt.val);
    expect(autoYieldChance('mining', opt.id)).toBe(0);
    // a speed bot grants no yield chance and vice-versa
    expect(autoYieldChance('mining', drone.id)).toBe(0);
    expect(autoSpeedMult('manufacturing', opt.id)).toBe(1);
  });

  it('automatonById resolves and rejects unknowns', () => {
    expect(automatonById('fab_arm')?.name).toBe('Fabricator Arm');
    expect(automatonById('nope')).toBeUndefined();
  });
});
