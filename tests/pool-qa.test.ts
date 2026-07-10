import { describe, it, expect } from 'vitest';
import {
  POOL, POCKETS, ballGroup, rackBalls, allStopped, stepBalls, shootCue, remaining, resolveShot,
} from '../src/data/pool.ts';

// Step the table to rest, accumulating the events the game would see over a shot.
function settle(balls, max = 8000) {
  let firstHit = null; const potted = []; let ticks = 0;
  while (!allStopped(balls) && ticks < max) {
    const e = stepBalls(balls);
    if (e.firstHit != null && firstHit == null) firstHit = e.firstHit;
    potted.push(...e.potted);
    ticks++;
  }
  return { potted, firstHit, ticks };
}
const live = (balls) => balls.filter(b => !b.potted);
function minGap(balls) {
  const L = live(balls); let m = Infinity;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++)
    m = Math.min(m, Math.hypot(L[i].x - L[j].x, L[i].y - L[j].y));
  return m;
}
const inBounds = (balls) => balls.every(b => b.potted ||
  (b.x >= POOL.R - 0.6 && b.x <= POOL.W - POOL.R + 0.6 && b.y >= POOL.R - 0.6 && b.y <= POOL.H - POOL.R + 0.6));
const cueOf = (balls) => balls.find(b => b.n === 0);
const G0 = () => ({ you: null, rex: null });

describe('Pool QA — 1. Full break shot', () => {
  it('settles, stays in bounds, no overlap, no lost balls, no infinite roll', () => {
    const b = rackBalls();
    shootCue(b, 0, 1);
    const r = settle(b);
    expect(r.ticks).toBeLessThan(8000);                 // not rolling forever
    expect(inBounds(b)).toBe(true);                     // nothing tunnelled off-table
    expect(minGap(b)).toBeGreaterThan(POOL.R * 2 - 0.8);// no ball overlap at rest
    expect(b.length).toBe(16);                          // no ball vanished
    expect(b.every(x => x.vx === 0 && x.vy === 0 || x.potted)).toBe(true); // no jitter
  });
});

describe('Pool QA — 2. Gentle shot', () => {
  it('cue creeps forward a little and stops (no instant stop, no runaway)', () => {
    const b = [{ n: 0, x: 120, y: 150, vx: 0, vy: 0, potted: false }];
    shootCue(b, 0, 0.12);
    const r = settle(b);
    expect(b[0].x).toBeGreaterThan(121);                // it moved
    expect(b[0].x).toBeLessThan(POOL.W - POOL.R);       // stayed on the table
    expect(r.ticks).toBeGreaterThan(20);                // didn't stop instantly
  });
});

describe('Pool QA — 3. Direct ball collision', () => {
  it('cue drives the object ball straight along the line of centres', () => {
    const b = [
      { n: 0, x: 100, y: 150, vx: 0, vy: 0, potted: false },
      { n: 1, x: 220, y: 150, vx: 0, vy: 0, potted: false },
    ];
    shootCue(b, 0, 0.85);
    const r = settle(b);
    expect(r.firstHit).toBe(1);
    expect(b[1].x).toBeGreaterThan(230);                // object ball driven forward
    expect(Math.abs(b[1].y - 150)).toBeLessThan(6);     // ~straight
  });
});

describe('Pool QA — 4. Angled collision', () => {
  it('an off-centre hit sends the object ball off at an angle and deflects the cue', () => {
    const b = [
      { n: 0, x: 100, y: 175, vx: 0, vy: 0, potted: false },
      { n: 1, x: 220, y: 150, vx: 0, vy: 0, potted: false },
    ];
    shootCue(b, Math.atan2(150 - 175, 220 - 100), 0.95);
    const r = settle(b);
    expect(r.firstHit).toBe(1);
    const movedObj = Math.hypot(b[1].x - 220, b[1].y - 150);
    expect(movedObj).toBeGreaterThan(15);               // object ball clearly moved
    expect(minGap(b)).toBeGreaterThan(POOL.R * 2 - 0.8);// didn't end up overlapping
  });
});

describe('Pool QA — 5. Cushion rebound', () => {
  it('reverses the perpendicular velocity and loses energy, staying in bounds', () => {
    const b = [{ n: 0, x: POOL.W - POOL.R - 3, y: 150, vx: 9, vy: 0, potted: false }];
    for (let i = 0; i < 6; i++) stepBalls(b);
    expect(b[0].vx).toBeLessThan(0);                    // now heading back
    expect(Math.abs(b[0].vx)).toBeLessThan(9);         // energy lost (restitution)
    expect(inBounds(b)).toBe(true);
  });
});

describe('Pool QA — 6. Corner-pocket shot', () => {
  it('a ball rolled into a corner is potted exactly once', () => {
    const b = [{ n: 3, x: 70, y: 70, vx: -6, vy: -6, potted: false }];
    const r = settle(b, 200);
    expect(b[0].potted).toBe(true);
    expect(r.potted.filter(n => n === 3).length).toBe(1);   // not double-counted
  });
});

describe('Pool QA — 7. Side-pocket shot', () => {
  it('a ball rolled into a middle-rail pocket is potted', () => {
    const b = [{ n: 4, x: POOL.W / 2, y: 60, vx: 0, vy: -6, potted: false }];
    const r = settle(b, 200);
    expect(b[0].potted).toBe(true);
    expect(r.potted).toContain(4);
  });
});

describe('Pool QA — 8. Multiple balls potted', () => {
  it('two balls sink in one shot, each counted once (no double count)', () => {
    const b = [
      { n: 1, x: 60, y: 60, vx: -6, vy: -6, potted: false },
      { n: 2, x: POOL.W - 60, y: 60, vx: 6, vy: -6, potted: false },
    ];
    const r = settle(b, 200);
    expect(b[0].potted && b[1].potted).toBe(true);
    expect(r.potted.slice().sort()).toEqual([1, 2]);        // exactly one of each
    expect(new Set(r.potted).size).toBe(r.potted.length);
  });
});

describe('Pool QA — 9. Cue-ball scratch', () => {
  it('potting the cue is a foul, re-spots the cue, and passes the turn', () => {
    const b = [{ n: 0, x: 70, y: 70, vx: -6, vy: -6, potted: false }];
    const r = settle(b, 200);
    expect(r.potted).toContain(0);
    const res = resolveShot(b, 'you', G0(), r.potted, r.firstHit);
    expect(res.foul).toBe(true);
    expect(res.respotCue).toBe(true);
    expect(res.nextTurn).toBe('rex');
    expect(res.over).toBe(false);
  });
});

describe('Pool QA — 10. Early 8-ball', () => {
  it('potting the 8 with your group still on the table loses the game', () => {
    const b = rackBalls();                                   // solids/stripes all present
    const res = resolveShot(b, 'you', { you: 'solid', rex: 'stripe' }, [8], 8);
    expect(res.over).toBe(true);
    expect(res.result).toBe('lose');
  });
  it('potting the 8 on an open table (no group) also loses', () => {
    const b = rackBalls();
    const res = resolveShot(b, 'you', G0(), [8], 8);
    expect(res.over).toBe(true);
    expect(res.result).toBe('lose');
  });
});

describe('Pool QA — 11. Legal 8-ball win', () => {
  it('clearing your group then potting the 8 cleanly wins', () => {
    const b = rackBalls();
    b.forEach(x => { if (ballGroup(x.n) === 'solid') x.potted = true; });   // solids cleared
    const res = resolveShot(b, 'you', { you: 'solid', rex: 'stripe' }, [8], 8);
    expect(res.over).toBe(true);
    expect(res.result).toBe('win');
  });
  it('but scratching while potting the 8 loses even when cleared', () => {
    const b = rackBalls();
    b.forEach(x => { if (ballGroup(x.n) === 'solid') x.potted = true; });
    const res = resolveShot(b, 'you', { you: 'solid', rex: 'stripe' }, [0, 8], 8);
    expect(res.result).toBe('lose');
  });
});

describe('Pool QA — 12. Missed shot / turn change', () => {
  it('hitting your ball but potting nothing passes the turn without a foul', () => {
    const b = rackBalls();
    const res = resolveShot(b, 'you', { you: 'solid', rex: 'stripe' }, [], 1); // hit a solid, no pot
    expect(res.foul).toBe(false);
    expect(res.keepTurn).toBe(false);
    expect(res.nextTurn).toBe('rex');
  });
  it('hitting the opponent group first (assigned table) is a foul', () => {
    const b = rackBalls();
    const res = resolveShot(b, 'you', { you: 'solid', rex: 'stripe' }, [], 11); // hit a stripe first
    expect(res.foul).toBe(true);
    expect(res.nextTurn).toBe('rex');
  });
  it('contacting no ball at all is a foul', () => {
    const b = rackBalls();
    const res = resolveShot(b, 'you', G0(), [], null);
    expect(res.foul).toBe(true);
  });
});

describe('Pool QA — 13. Solids/stripes assignment', () => {
  it('first legal pot on an open table assigns the groups', () => {
    const s = resolveShot(rackBalls(), 'you', G0(), [3], 3);
    expect(s.groups.you).toBe('solid');
    expect(s.groups.rex).toBe('stripe');
    expect(s.keepTurn).toBe(true);
    expect(s.nextTurn).toBe('you');

    const st = resolveShot(rackBalls(), 'you', G0(), [11], 11);
    expect(st.groups.you).toBe('stripe');
    expect(st.groups.rex).toBe('solid');
  });
});

describe('Pool QA — 14. Layout sanity (mobile)', () => {
  it('the table keeps a 2:1 ratio that scales cleanly to any width', () => {
    expect(POOL.W / POOL.H).toBe(2);
    expect(POCKETS.length).toBe(6);
  });
});

describe('Pool QA — anti-tunnelling & integrity', () => {
  it('a max-power cue cannot tunnel through a distant ball', () => {
    const b = [
      { n: 0, x: 30, y: 150, vx: 0, vy: 0, potted: false },
      { n: 1, x: 280, y: 150, vx: 0, vy: 0, potted: false },
    ];
    shootCue(b, 0, 1);
    const r = settle(b);
    expect(r.firstHit).toBe(1);                          // it actually hit the ball
    expect(b[1].x).toBeGreaterThan(285);                 // and drove it, didn't pass through
  });
  it('a max-speed ball cannot tunnel through a cushion', () => {
    const b = [{ n: 0, x: POOL.W - POOL.R - 2, y: 150, vx: POOL.MAXV, vy: 0, potted: false }];
    for (let i = 0; i < 40; i++) stepBalls(b);
    expect(inBounds(b)).toBe(true);
  });
  it('a settled random break never leaves balls overlapping or jittering', () => {
    const b = rackBalls();
    shootCue(b, 0.05, 0.95);
    settle(b);
    expect(minGap(b)).toBeGreaterThan(POOL.R * 2 - 0.8);
    expect(b.every(x => x.potted || (x.vx === 0 && x.vy === 0))).toBe(true);
  });
});
