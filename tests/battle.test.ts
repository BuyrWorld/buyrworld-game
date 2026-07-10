import { describe, it, expect } from 'vitest';
import {
  BR, BOT_NAMES, BOT_COLORS, spawnFighters, stormRadius, outsideStorm, applyDamage,
  aliveCount, aliveEnemies, player, playerWon, playerLost, nearestEnemy, aimAngle,
  bulletHits, clampToArena, STORM_CX, STORM_CY,
} from '../src/data/battle.ts';

describe('Battle Royale — setup', () => {
  it('has exactly the five named opponents', () => {
    expect(BOT_NAMES).toEqual(['Donna', 'Daz', 'Reanna', 'Becky', 'Noa']);
    for (const n of BOT_NAMES) expect(BOT_COLORS[n]).toBeTruthy();
  });
  it('spawns the player + 5 bots, all at full health inside the arena', () => {
    const f = spawnFighters();
    expect(f.length).toBe(6);
    expect(f.filter(x => x.isPlayer).length).toBe(1);
    expect(f.filter(x => !x.isPlayer).map(x => x.name)).toEqual(BOT_NAMES);
    for (const x of f){
      expect(x.hp).toBe(BR.MAX_HP);
      expect(x.alive).toBe(true);
      expect(x.x).toBeGreaterThanOrEqual(0); expect(x.x).toBeLessThanOrEqual(BR.W);
      expect(x.y).toBeGreaterThanOrEqual(0); expect(x.y).toBeLessThanOrEqual(BR.H);
    }
    expect(new Set(f.map(x => x.id)).size).toBe(6);
  });
});

describe('Battle Royale — storm', () => {
  it('safe zone shrinks monotonically to a small final circle', () => {
    const r0 = stormRadius(0), r1 = stormRadius(800), r2 = stormRadius(1600), r3 = stormRadius(3000);
    expect(r0).toBeGreaterThan(r1);
    expect(r1).toBeGreaterThan(r2);
    expect(r2).toBeGreaterThan(r3);
    expect(r3).toBeLessThan(40);
    expect(r0).toBeGreaterThan(Math.hypot(BR.W, BR.H) / 2); // covers the whole arena at first
  });
  it('detects a fighter outside the safe zone', () => {
    const f = { x: STORM_CX, y: STORM_CY };
    expect(outsideStorm(f, 50)).toBe(false);
    expect(outsideStorm({ x: STORM_CX + 100, y: STORM_CY }, 50)).toBe(true);
  });
});

describe('Battle Royale — combat', () => {
  it('applyDamage eliminates at zero HP and reports it', () => {
    const f = { hp: 20, alive: true };
    expect(applyDamage(f, 10)).toBe(false);
    expect(f.hp).toBe(10);
    expect(applyDamage(f, 15)).toBe(true);   // eliminated
    expect(f.alive).toBe(false);
    expect(f.hp).toBe(0);
    expect(applyDamage(f, 5)).toBe(false);   // already dead, no-op
  });
  it('bulletHits finds an alive enemy but never the owner', () => {
    const fighters = [
      { id: 0, x: 100, y: 100, alive: true },
      { id: 1, x: 102, y: 101, alive: true },
      { id: 2, x: 300, y: 300, alive: true },
    ];
    expect(bulletHits({ x: 101, y: 100, owner: 0 }, fighters).id).toBe(1);
    expect(bulletHits({ x: 101, y: 100, owner: 1 }, fighters).id).toBe(0);
    expect(bulletHits({ x: 400, y: 400, owner: 0 }, fighters)).toBeNull();
    fighters[1].alive = false;
    expect(bulletHits({ x: 101, y: 100, owner: 0 }, fighters)).toBeNull();
  });
  it('nearestEnemy returns the closest living opponent', () => {
    const fighters = [
      { id: 0, x: 0, y: 0, alive: true },
      { id: 1, x: 50, y: 0, alive: true },
      { id: 2, x: 10, y: 0, alive: true },
    ];
    expect(nearestEnemy(fighters[0], fighters).id).toBe(2);
    fighters[2].alive = false;
    expect(nearestEnemy(fighters[0], fighters).id).toBe(1);
  });
  it('aimAngle points from shooter to target', () => {
    expect(aimAngle(0, 0, 10, 0)).toBeCloseTo(0);
    expect(aimAngle(0, 0, 0, 10)).toBeCloseTo(Math.PI / 2);
  });
});

describe('Battle Royale — win / lose', () => {
  it('player wins only when alive and every bot is out', () => {
    const f = spawnFighters();
    expect(playerWon(f)).toBe(false);
    f.filter(x => !x.isPlayer).forEach(x => { x.alive = false; });
    expect(playerWon(f)).toBe(true);
    expect(aliveCount(f)).toBe(1);
  });
  it('player loses when eliminated', () => {
    const f = spawnFighters();
    player(f).alive = false;
    expect(playerLost(f)).toBe(true);
    expect(playerWon(f)).toBe(false);
    expect(aliveEnemies(f, 0).length).toBe(5);
  });
});

describe('Battle Royale — bounds', () => {
  it('clampToArena keeps a fighter on the field', () => {
    const f = { x: -50, y: 9999 };
    clampToArena(f);
    expect(f.x).toBe(BR.FIGHTER_R);
    expect(f.y).toBe(BR.H - BR.FIGHTER_R);
  });
});
