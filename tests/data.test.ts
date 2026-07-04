import { describe, it, expect } from 'vitest';
import { ITEMS }         from '../src/data/items';
import { SKILLS }        from '../src/data/skills';
import { NPCS }          from '../src/data/npcs';
import { UPGRADES }      from '../src/data/upgrades';
import { PETS }          from '../src/data/pets';
import { CLIENTS, CONTRACT_POOL } from '../src/data/contracts';
import { TRACKS }        from '../src/audio/tracks';
import { VMAP, V_OBJECTS, VCOLS, VROWS, TILE, VIEW_W, VIEW_H } from '../src/world/map';

/* ---- items ---- */
describe('ITEMS', () => {
  it('has exactly 17 items', () => {
    expect(Object.keys(ITEMS).length).toBe(17);
  });

  it('every item has a non-empty name', () => {
    for (const [id, item] of Object.entries(ITEMS)) {
      expect(item.n, `${id}.n`).toBeTruthy();
    }
  });

  it('every item has a non-empty icon', () => {
    for (const [id, item] of Object.entries(ITEMS)) {
      expect(item.ic, `${id}.ic`).toBeTruthy();
    }
  });

  it('every item value is a positive number', () => {
    for (const [id, item] of Object.entries(ITEMS)) {
      expect(item.v, `${id}.v`).toBeGreaterThan(0);
    }
  });
});

/* ---- skills ---- */
describe('SKILLS', () => {
  const SKILL_IDS = ['mining', 'steelworks', 'manufacturing', 'logistics', 'trading'];

  it('has exactly 5 skills', () => {
    expect(Object.keys(SKILLS).length).toBe(5);
  });

  it('contains all expected skill IDs', () => {
    expect(Object.keys(SKILLS)).toEqual(expect.arrayContaining(SKILL_IDS));
  });

  it('every action output references a valid item ID', () => {
    for (const [sk, skill] of Object.entries(SKILLS)) {
      for (const action of skill.actions) {
        for (const itemId of Object.keys(action.out)) {
          expect(ITEMS[itemId], `${sk}.${action.id} out.${itemId}`).toBeDefined();
        }
      }
    }
  });

  it('every action input references a valid item ID', () => {
    for (const [sk, skill] of Object.entries(SKILLS)) {
      for (const action of skill.actions) {
        if (!action.in) continue;
        for (const itemId of Object.keys(action.in)) {
          expect(ITEMS[itemId], `${sk}.${action.id} in.${itemId}`).toBeDefined();
        }
      }
    }
  });

  it('every action has level >= 1', () => {
    for (const skill of Object.values(SKILLS)) {
      for (const action of skill.actions) {
        expect(action.lvl).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every action has xp > 0', () => {
    for (const skill of Object.values(SKILLS)) {
      for (const action of skill.actions) {
        expect(action.xp).toBeGreaterThan(0);
      }
    }
  });

  it('every action has ms > 0', () => {
    for (const skill of Object.values(SKILLS)) {
      for (const action of skill.actions) {
        expect(action.ms).toBeGreaterThan(0);
      }
    }
  });

  it('action IDs are unique within each skill', () => {
    for (const [sk, skill] of Object.entries(SKILLS)) {
      const ids = skill.actions.map(a => a.id);
      expect(new Set(ids).size, `${sk} has duplicate action IDs`).toBe(ids.length);
    }
  });
});

/* ---- npcs ---- */
describe('NPCS', () => {
  it('has exactly 4 traders', () => {
    expect(NPCS.length).toBe(4);
  });

  it('every NPC stock item is a valid item ID', () => {
    for (const npc of NPCS) {
      for (const itemId of npc.stock) {
        expect(ITEMS[itemId], `${npc.id} stocks ${itemId}`).toBeDefined();
      }
    }
  });

  it('NPC levels are non-negative', () => {
    for (const npc of NPCS) {
      expect(npc.lvl).toBeGreaterThanOrEqual(0);
    }
  });

  it('NPC IDs are unique', () => {
    const ids = NPCS.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ---- upgrades ---- */
describe('UPGRADES', () => {
  const validSkills = ['mining', 'steelworks', 'manufacturing', 'logistics', 'trading'];

  it('has exactly 10 upgrades', () => {
    expect(UPGRADES.length).toBe(10);
  });

  it('all upgrades reference a valid skill', () => {
    for (const u of UPGRADES) {
      expect(validSkills, `${u.id}.skill`).toContain(u.skill);
    }
  });

  it('all upgrade costs are positive', () => {
    for (const u of UPGRADES) {
      expect(u.cost).toBeGreaterThan(0);
    }
  });

  it('upgrade prerequisites reference existing upgrade IDs', () => {
    const ids = UPGRADES.map(u => u.id);
    for (const u of UPGRADES) {
      if (u.req) {
        expect(ids, `${u.id}.req ${u.req}`).toContain(u.req);
      }
    }
  });

  it('no duplicate upgrade IDs', () => {
    const ids = UPGRADES.map(u => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ---- pets ---- */
describe('PETS', () => {
  it('has exactly 6 companions', () => {
    expect(PETS.length).toBe(6);
  });

  it('no duplicate pet IDs', () => {
    const ids = PETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all rarities are valid', () => {
    const validRar = ['common', 'rare', 'legendary'];
    for (const p of PETS) {
      expect(validRar, `${p.id}.rar`).toContain(p.rar);
    }
  });

  it('all drop chances are between 0 and 1', () => {
    for (const p of PETS) {
      expect(p.chance).toBeGreaterThan(0);
      expect(p.chance).toBeLessThanOrEqual(1);
    }
  });
});

/* ---- contracts ---- */
describe('CONTRACT_POOL', () => {
  it('has exactly 9 contract types', () => {
    expect(CONTRACT_POOL.length).toBe(9);
  });

  it('all contract items are valid item IDs', () => {
    for (const c of CONTRACT_POOL) {
      expect(ITEMS[c.item], `contract item ${c.item}`).toBeDefined();
    }
  });

  it('all contracts have minLvl >= 1', () => {
    for (const c of CONTRACT_POOL) {
      expect(c.minLvl).toBeGreaterThanOrEqual(1);
    }
  });

  it('has 8 distinct client names', () => {
    expect(CLIENTS.length).toBe(8);
    expect(new Set(CLIENTS).size).toBe(8);
  });
});

/* ---- audio tracks ---- */
describe('TRACKS', () => {
  const EXPECTED = ['valley', 'quarry', 'forge', 'line', 'market', 'barn'];

  it('has exactly 6 tracks', () => {
    expect(Object.keys(TRACKS).length).toBe(6);
  });

  it('contains all expected track names', () => {
    expect(Object.keys(TRACKS)).toEqual(expect.arrayContaining(EXPECTED));
  });

  it('all tracks have non-empty lead and bass sequences', () => {
    for (const [name, track] of Object.entries(TRACKS)) {
      expect(track.lead.length, `${name}.lead`).toBeGreaterThan(0);
      expect(track.bass.length, `${name}.bass`).toBeGreaterThan(0);
    }
  });

  it('all tracks have positive tempo', () => {
    for (const [name, track] of Object.entries(TRACKS)) {
      expect(track.tempo, `${name}.tempo`).toBeGreaterThan(0);
    }
  });
});

/* ---- world map ---- */
describe('VMAP', () => {
  it('has exactly VROWS rows', () => {
    expect(VMAP.length).toBe(VROWS);
  });

  it('every row has exactly VCOLS characters', () => {
    for (let r = 0; r < VMAP.length; r++) {
      expect(VMAP[r].length, `row ${r}`).toBe(VCOLS);
    }
  });

  it('only uses valid tile characters', () => {
    const valid = new Set(['T', 'C', 'D', 'G', 'P', 'W', 'S']);
    for (let r = 0; r < VMAP.length; r++) {
      for (const ch of VMAP[r]) {
        expect(valid.has(ch), `row ${r} char '${ch}'`).toBe(true);
      }
    }
  });
});

describe('V_OBJECTS', () => {
  it('rock objects reference valid item ore IDs', () => {
    for (const obj of V_OBJECTS) {
      if (obj.kind === 'rock' && obj.ore) {
        expect(ITEMS[obj.ore], `${obj.id}.ore ${obj.ore}`).toBeDefined();
      }
    }
  });

  it('building and stall objects have a tab property', () => {
    for (const obj of V_OBJECTS) {
      if (obj.kind === 'bld' || obj.kind === 'stall') {
        expect(obj.tab, `${obj.id}.tab`).toBeTruthy();
      }
    }
  });

  it('no duplicate object IDs', () => {
    const ids = V_OBJECTS.map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all tile positions are within map bounds', () => {
    for (const obj of V_OBJECTS) {
      expect(obj.tx).toBeGreaterThanOrEqual(0);
      expect(obj.ty).toBeGreaterThanOrEqual(0);
      expect(obj.tx).toBeLessThan(VCOLS);
      expect(obj.ty).toBeLessThan(VROWS);
    }
  });
});

/* ---- constants sanity ---- */
describe('Map constants', () => {
  it('TILE divides VIEW_W evenly', () => {
    expect(VIEW_W % TILE).toBe(0);
  });

  it('TILE divides VIEW_H evenly', () => {
    expect(VIEW_H % TILE).toBe(0);
  });

  it('viewport fits within map', () => {
    expect(VIEW_W / TILE).toBeLessThanOrEqual(VCOLS);
    expect(VIEW_H / TILE).toBeLessThanOrEqual(VROWS);
  });
});
