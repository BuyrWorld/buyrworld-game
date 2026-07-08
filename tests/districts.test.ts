import { describe, it, expect } from 'vitest';
import { DISTRICTS, isDistrictOpen, districtForBuilding } from '../src/data/districts.ts';
import { V_OBJECTS, VCOLS, VROWS } from '../src/world/map.ts';

const byId = (id: string) => V_OBJECTS.find((o: any) => o.id === id);

describe('Districts registry', () => {
  it('every building (kind "bld") belongs to exactly one district', () => {
    const orphans: string[] = [];
    for (const o of V_OBJECTS as any[]) {
      if (o.kind !== 'bld') continue;
      const claimants = DISTRICTS.filter(d =>
        d.buildings.includes(o.id) || (d.prefixes || []).some(p => o.id.startsWith(p)));
      if (claimants.length !== 1) orphans.push(`${o.id} → ${claimants.length} districts`);
    }
    expect(orphans, orphans.join('\n')).toEqual([]);
  });

  it('districtForBuilding agrees for a few known buildings', () => {
    expect(districtForBuilding('bank')).toBe('financial');
    expect(districtForBuilding('furnace')).toBe('manufacturing');
    expect(districtForBuilding('nightclub')).toBe('retail');
    expect(districtForBuilding('home_11')).toBe('residential');   // via prefix
    expect(districtForBuilding('harbour_office')).toBe('harbour');
    expect(districtForBuilding('nope')).toBeNull();
  });

  it('every listed building id exists on the map', () => {
    const missing: string[] = [];
    for (const d of DISTRICTS) for (const id of d.buildings) if (!byId(id)) missing.push(`${d.id}: ${id}`);
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('every district hub is inside the map bounds', () => {
    for (const d of DISTRICTS) {
      expect(d.hub[0], d.id).toBeGreaterThanOrEqual(0);
      expect(d.hub[0], d.id).toBeLessThan(VCOLS);
      expect(d.hub[1], d.id).toBeGreaterThanOrEqual(0);
      expect(d.hub[1], d.id).toBeLessThan(VROWS);
    }
  });

  it('unlock rules gate correctly', () => {
    const fin = DISTRICTS.find(d => d.id === 'financial')!;
    const harbour = DISTRICTS.find(d => d.id === 'harbour')!;
    const robotics = DISTRICTS.find(d => d.id === 'robotics')!;
    const energy = DISTRICTS.find(d => d.id === 'energy')!;
    expect(isDistrictOpen(fin, 0)).toBe(true);              // open always
    expect(isDistrictOpen(harbour, 99)).toBe(false);        // gated
    expect(isDistrictOpen(harbour, 100)).toBe(true);
    expect(isDistrictOpen(robotics, 149)).toBe(false);      // robotics gated at 150
    expect(isDistrictOpen(robotics, 150)).toBe(true);
    expect(isDistrictOpen(energy, 9999)).toBe(false);       // planned never opens
  });

  it('still seeds a planned campus for future breadth', () => {
    const planned = DISTRICTS.filter(d => d.unlock.type === 'planned').map(d => d.id);
    expect(planned).toContain('energy');
  });
});
