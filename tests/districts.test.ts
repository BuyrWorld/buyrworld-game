import { describe, it, expect } from 'vitest';
import { DISTRICTS, isDistrictOpen, districtForBuilding, nextGatedDistrict } from '../src/data/districts.ts';
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
    expect(isDistrictOpen(harbour, 99)).toBe(false);        // harbour gated at 100
    expect(isDistrictOpen(harbour, 100)).toBe(true);
    expect(isDistrictOpen(robotics, 149)).toBe(false);      // robotics gated at 150
    expect(isDistrictOpen(robotics, 150)).toBe(true);
    expect(isDistrictOpen(energy, 199)).toBe(false);        // energy gated at 200
    expect(isDistrictOpen(energy, 200)).toBe(true);
  });

  it('has a progression of level-gated advanced districts', () => {
    const gates = DISTRICTS.filter(d => d.unlock.type === 'level').map(d => (d.unlock as any).n).sort((a, b) => a - b);
    expect(gates).toEqual([100, 150, 200]);
  });

  it('nextGatedDistrict points at the next unlock, then null once all are reached', () => {
    expect(nextGatedDistrict(0)?.id).toBe('harbour');       // 100 is next
    expect(nextGatedDistrict(100)?.id).toBe('robotics');    // 150 is next
    expect(nextGatedDistrict(150)?.id).toBe('energy');      // 200 is next
    expect(nextGatedDistrict(200)).toBeNull();              // all unlocked
  });
});
