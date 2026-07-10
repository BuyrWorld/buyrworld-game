import { describe, it, expect } from 'vitest';
import {
  BR, BOT_NAMES, BOT_COLORS, spawnFighters, stormRadius, outsideStorm, applyDamage,
  aliveCount, aliveEnemies, player, playerWon, playerLost, nearestEnemy, aimAngle,
  bulletHits, clampToArena, STORM_CX, STORM_CY,
  WEAPONS, weaponById, weaponDamage, applyHit, BR_SHIELD_MAX, PERSONALITIES,
  COVER, POIS, pointBlocked, segmentBlocked, moveFighter, spawnLoot,
  BR_MEDALS, evaluateMedals, stormClosing, stormNextRadius, stormTicksToClose, stormDamage,
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

describe('Battle Royale — weapons (P2)', () => {
  it('has the four distinct weapon types with full stat lines', () => {
    for (const id of ['pistol', 'shotgun', 'rifle', 'marksman']) {
      const w = WEAPONS[id];
      expect(w).toBeTruthy();
      for (const k of ['dmg','fireCd','mag','reload','bulletSpeed','spread','recoil','range','falloff','pellets','sfx']) expect(w[k] !== undefined).toBe(true);
    }
    expect(WEAPONS.shotgun.pellets).toBeGreaterThan(1);   // multi-pellet
    expect(WEAPONS.rifle.auto).toBe(true);                // automatic
    expect(WEAPONS.marksman.range).toBeGreaterThan(WEAPONS.shotgun.range); // long vs short
    expect(weaponById('nope').id).toBe('pistol');
  });
  it('damage falls off with distance', () => {
    const w = WEAPONS.pistol;
    expect(weaponDamage(w, 0)).toBe(w.dmg);
    expect(weaponDamage(w, w.range)).toBeLessThan(w.dmg);
    expect(weaponDamage(w, w.range * 5)).toBeGreaterThanOrEqual(1);  // never below 1
  });
});

describe('Battle Royale — shield & hits (P5)', () => {
  it('shield soaks damage before health, and reports the hit', () => {
    const f = { alive: true, hp: 100, shield: 30 };
    let r = applyHit(f, 20);
    expect(f.shield).toBe(10); expect(f.hp).toBe(100); expect(r.shieldHit).toBe(true); expect(r.elim).toBe(false);
    r = applyHit(f, 20);
    expect(f.shield).toBe(0); expect(f.hp).toBe(90);   // 10 to shield, 10 to hp
    r = applyHit(f, 200);
    expect(r.elim).toBe(true); expect(f.alive).toBe(false); expect(f.hp).toBe(0);
    expect(applyHit(f, 5).dmg).toBe(0);                 // dead = no-op
  });
});

describe('Battle Royale — cover & terrain (P3)', () => {
  it('has at least three POIs and solid cover', () => {
    expect(POIS.length).toBeGreaterThanOrEqual(3);
    expect(COVER.length).toBeGreaterThanOrEqual(8);
  });
  it('spawns never start inside cover', () => {
    for (const f of spawnFighters()) expect(pointBlocked(f.x, f.y, BR.FIGHTER_R)).toBe(false);
  });
  it('pointBlocked / segmentBlocked detect solid cover', () => {
    const c = COVER[0];
    expect(pointBlocked(c.x + c.w / 2, c.y + c.h / 2)).toBe(true);
    expect(pointBlocked(-20, -20)).toBe(false);
    expect(segmentBlocked(c.x - 30, c.y + c.h / 2, c.x + c.w + 30, c.y + c.h / 2)).toBe(true);  // straight through
    expect(segmentBlocked(-40, -40, -20, -20)).toBe(false);
  });
  it('moveFighter slides along cover instead of entering it', () => {
    const c = COVER.find(x => x.x === 230 && x.type === 'crate');  // isolated central crate
    const f = { x: c.x - BR.FIGHTER_R, y: c.y + c.h / 2 };         // just left of it
    moveFighter(f, 12, 0);                                         // push right into it (small step)
    expect(f.x).toBeLessThan(c.x);                                // blocked on x
    moveFighter(f, 0, 30);                                         // but can slide down past it
    expect(f.y).toBeGreaterThan(c.y + c.h / 2);
  });
});

describe('Battle Royale — loot, personalities, medals', () => {
  it('spawnLoot places weapons, shields, health and a utility item', () => {
    const loot = spawnLoot();
    expect(loot.some(l => l.kind === 'weapon')).toBe(true);
    expect(loot.some(l => l.kind === 'shield')).toBe(true);
    expect(loot.some(l => l.kind === 'health')).toBe(true);
    expect(loot.some(l => l.kind === 'dash')).toBe(true);   // utility (movement item)
    expect(loot.every(l => l.taken === false)).toBe(true);
  });
  it('bots get personalities + weapons; player starts with a pistol', () => {
    const f = spawnFighters();
    expect(player(f).weapon).toBe('pistol');
    for (const b of f.filter(x => !x.isPlayer)) {
      expect(PERSONALITIES[b.personality]).toBeTruthy();
      expect(WEAPONS[b.weapon]).toBeTruthy();
    }
  });
  it('medals are skill-based, not for merely playing', () => {
    expect(evaluateMedals({ placement: 6, elims: 0, shots: 0, hits: 0, damageTaken: 50 }).length).toBe(0);
    const m = evaluateMedals({ placement: 1, elims: 3, shots: 10, hits: 7, damageTaken: 0, minHp: 100, stormTicks: 0, wasLowHp: false, firstElim: true });
    const ids = m.map(x => x.id);
    expect(ids).toContain('survivor');
    expect(ids).toContain('triple');
    expect(ids).toContain('sharpshooter');
    expect(ids).toContain('flawless');
    expect(ids).toContain('first_blood');
  });
});

describe('Battle Royale — full-match simulation (P15)', () => {
  it('a headless match terminates with one survivor, no tunnelling, no NaN', () => {
    const F = spawnFighters();
    const bullets = [];
    let tick = 0;
    while (aliveCount(F) > 1 && tick < 6000) {
      tick++;
      const r = stormRadius(tick), sd = stormDamage(tick);
      for (const f of F) {
        if (!f.alive) continue;
        if (f.fireCd > 0) f.fireCd--;
        if (f.reloadT > 0) { f.reloadT--; if (f.reloadT <= 0) f.ammo = weaponById(f.weapon).mag; }
        if (f.spawnProtect > 0) f.spawnProtect--;
        const tgt = nearestEnemy(f, F); if (!tgt) continue;
        const ang = aimAngle(f.x, f.y, tgt.x, tgt.y);
        moveFighter(f, Math.cos(ang) * 1.6, Math.sin(ang) * 1.6);
        const w = weaponById(f.weapon);
        if (f.fireCd <= 0 && f.reloadT <= 0 && f.ammo > 0 && !segmentBlocked(f.x, f.y, tgt.x, tgt.y)) {
          const a = ang + (Math.random() - 0.5) * w.spread * 2;
          bullets.push({ x: f.x, y: f.y, ox: f.x, oy: f.y, vx: Math.cos(a) * w.bulletSpeed, vy: Math.sin(a) * w.bulletSpeed, owner: f.id, wid: w.id, life: 80 });
          f.ammo = Math.max(0, f.ammo - 1); f.fireCd = w.fireCd; if (f.ammo <= 0) f.reloadT = w.reload;
          expect(f.ammo).toBeGreaterThanOrEqual(0);   // never negative
        }
      }
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bl = bullets[i]; let gone = false;
        const sub = Math.max(1, Math.ceil(Math.hypot(bl.vx, bl.vy) / 4));
        for (let s = 0; s < sub && !gone; s++) {
          bl.x += bl.vx / sub; bl.y += bl.vy / sub;
          if (bl.x < 0 || bl.x > BR.W || bl.y < 0 || bl.y > BR.H || pointBlocked(bl.x, bl.y)) { gone = true; break; }
          const h = bulletHits(bl, F);
          if (h) { if (h.spawnProtect <= 0) applyHit(h, weaponDamage(weaponById(bl.wid), Math.hypot(bl.x - bl.ox, bl.y - bl.oy))); gone = true; break; }
        }
        if (gone || --bl.life <= 0) bullets.splice(i, 1);
      }
      for (const f of F) { if (f.alive && f.spawnProtect <= 0 && outsideStorm(f, r)) applyDamage(f, sd); }
      for (const f of F) { expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true); }
    }
    expect(tick).toBeLessThan(6000);                 // the storm guarantees it ends
    expect(aliveCount(F)).toBeLessThanOrEqual(1);    // exactly one survivor (or none to the storm)
  });
});

describe('Battle Royale — storm phases (P7)', () => {
  it('alternates warning holds and closing shrinks', () => {
    expect(stormClosing(100)).toBe(false);          // warning 1 (stable)
    expect(stormClosing(600)).toBe(true);           // closing 1 (420→780)
    expect(stormClosing(1000)).toBe(false);         // holding (780→1200)
    expect(stormNextRadius(100)).toBeLessThan(stormRadius(100));
    expect(stormTicksToClose(100)).toBeGreaterThan(0); // warning → countdown to close
    expect(stormTicksToClose(600)).toBe(0);            // already closing
    expect(stormDamage(2400)).toBeGreaterThan(stormDamage(100)); // ramps up
  });
});
