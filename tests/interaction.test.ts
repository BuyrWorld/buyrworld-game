import { describe, it, expect } from 'vitest';
import {
  TARGET_PRIORITY, INTERACT_RANGE, NEARBY_RADIUS, HIT_PAD,
  pointInBox, hitTest, inRange, npcBox, footprintBox, interactVerb, cycleTarget,
  type Hit,
} from '../src/data/interaction.ts';

const TILE = 24;

describe('interaction — hitbox geometry', () => {
  it('pointInBox respects padding', () => {
    const b = { x: 10, y: 10, w: 20, h: 20 };
    expect(pointInBox(15, 15, b)).toBe(true);
    expect(pointInBox(9, 15, b)).toBe(false);
    expect(pointInBox(9, 15, b, 2)).toBe(true);   // pad reaches it
    expect(pointInBox(35, 15, b)).toBe(false);
  });

  it('npcBox is a tight sprite-sized box, not a wide grab radius', () => {
    const b = npcBox(100, 100, TILE);
    expect(b.w).toBeLessThanOrEqual(TILE);          // narrower than a tile
    expect(b.h).toBeGreaterThan(TILE);              // taller than wide (a standing figure)
    // centred horizontally on the sprite, extends up to the head and down to the feet
    expect(b.x).toBe(100 - b.w / 2);                // centred on the sprite anchor
    expect(b.y).toBeLessThan(100);                  // top is above the anchor
    expect(b.y + b.h).toBeGreaterThan(100);         // bottom is below the anchor (feet)
  });
});

describe('interaction — clicking behind an NPC lands on terrain', () => {
  const npc: Hit = { id: 'npc1', kind: 'npc', box: npcBox(200, 200, TILE) };
  it('a tap on the NPC body selects the NPC', () => {
    expect(hitTest(200, 195, [npc])).toBe(npc);     // on the torso
  });
  it('a tap clearly on the ground behind/below the NPC misses (→ move)', () => {
    expect(hitTest(200, 200 + TILE, [npc])).toBeNull();   // well below the feet
    expect(hitTest(200 + TILE, 200, [npc])).toBeNull();   // a full tile to the side
  });
});

describe('interaction — explicit priority resolves overlaps', () => {
  // an NPC standing in front of a cottage: the boxes overlap
  const building: Hit = { id: 'cottage', kind: 'building', box: footprintBox(180, 170, 3 * TILE, 3 * TILE) };
  const npc: Hit = { id: 'agnes', kind: 'npc', box: npcBox(200, 210, TILE) };
  it('tapping the person in front of the building selects the person', () => {
    // a point inside BOTH boxes → npc wins (higher priority)
    const p = hitTest(200, 205, [building, npc]);
    expect(p!.id).toBe('agnes');
    expect(TARGET_PRIORITY.npc).toBeGreaterThan(TARGET_PRIORITY.building);
  });
  it('tapping the building wall away from the person selects the building', () => {
    const p = hitTest(185, 175, [building, npc]);   // top-left of the cottage, no NPC there
    expect(p!.id).toBe('cottage');
  });
  it('order-independent: same winner regardless of array order', () => {
    expect(hitTest(200, 205, [npc, building])!.id).toBe('agnes');
    expect(hitTest(200, 205, [building, npc])!.id).toBe('agnes');
  });
  it('on a priority tie the smaller (tighter) hitbox wins', () => {
    const big: Hit = { id: 'big', kind: 'sign', box: { x: 0, y: 0, w: 100, h: 100 }, pad: 0 };
    const small: Hit = { id: 'small', kind: 'sign', box: { x: 40, y: 40, w: 10, h: 10 }, pad: 0 };
    expect(hitTest(45, 45, [big, small])!.id).toBe('small');
  });
});

describe('interaction — touch padding never swallows a neighbouring tile', () => {
  it('every kind pad is smaller than half a tile', () => {
    for (const k of Object.keys(HIT_PAD) as (keyof typeof HIT_PAD)[]) {
      expect(HIT_PAD[k]).toBeLessThan(TILE / 2);
    }
  });
  it('a resource node does not grab a tap a full tile away', () => {
    const rock: Hit = { id: 'rock', kind: 'resource', box: footprintBox(0, 0, TILE, TILE) };
    expect(hitTest(TILE + TILE * 0.6, TILE / 2, [rock])).toBeNull();
  });
});

describe('interaction — range', () => {
  it('inRange uses the shared default and honours overrides', () => {
    expect(inRange(0, 0, 30, 0)).toBe(true);          // within INTERACT_RANGE (46)
    expect(inRange(0, 0, 60, 0)).toBe(false);
    expect(inRange(0, 0, 60, 0, NEARBY_RADIUS)).toBe(true);
    expect(INTERACT_RANGE).toBe(46);
  });
});

describe('interaction — contextual verbs', () => {
  it('resources read Mine / Chop', () => {
    expect(interactVerb('resource', { resource: 'rock' })).toBe('Mine');
    expect(interactVerb('resource', { resource: 'tree' })).toBe('Chop');
  });
  it('buildings read a precise verb from their tab', () => {
    expect(interactVerb('building', { tab: 'fishing' })).toBe('Fish');
    expect(interactVerb('building', { tab: 'trade' })).toBe('Shop');
    expect(interactVerb('building', { tab: 'mining' })).toBe('Gather');
    expect(interactVerb('building', { tab: 'steelworks' })).toBe('Enter');
    expect(interactVerb('building', { tab: 'myhome' })).toBe('Enter');
  });
  it('npc / sign / prop verbs', () => {
    expect(interactVerb('npc')).toBe('Chat');
    expect(interactVerb('sign')).toBe('Read');
    expect(interactVerb('prop')).toBe('Inspect');
  });
});

describe('interaction — D-pad target cycling (no movement)', () => {
  const ids = ['a', 'b', 'c'];
  it('cycles forward and wraps', () => {
    expect(cycleTarget(ids, null, 1)).toBe('a');
    expect(cycleTarget(ids, 'a', 1)).toBe('b');
    expect(cycleTarget(ids, 'c', 1)).toBe('a');
  });
  it('cycles backward and wraps', () => {
    expect(cycleTarget(ids, null, -1)).toBe('c');
    expect(cycleTarget(ids, 'b', -1)).toBe('a');
    expect(cycleTarget(ids, 'a', -1)).toBe('c');
  });
  it('an unknown current id restarts at an end; empty list yields null', () => {
    expect(cycleTarget(ids, 'zzz', 1)).toBe('a');
    expect(cycleTarget([], null, 1)).toBeNull();
  });
});
