// @ts-nocheck
// 8-ball pool — pure physics + rack helpers for the pub minigame. The renderer,
// input and turn logic live in main.ts; everything here is deterministic and
// testable. Units are pixels on a fixed 600×300 logical table; velocities are
// px per physics tick (main.ts runs several sub-steps per frame).

export const POOL = {
  W: 600, H: 300,          // logical felt size (playable area)
  R: 10,                   // ball radius
  POCKET: 19,              // pocket capture radius
  REST: 0.92,              // cushion restitution
  FRICTION: 0.985,         // per-tick rolling friction
  STOP: 0.06,              // speed below which a ball is considered stopped
  MAXV: 30,                // max launch speed
};

// 6 pockets: 4 corners + 2 on the middle of the long rails.
export const POCKETS = [
  { x: 0, y: 0 }, { x: POOL.W / 2, y: -3 }, { x: POOL.W, y: 0 },
  { x: 0, y: POOL.H }, { x: POOL.W / 2, y: POOL.H + 3 }, { x: POOL.W, y: POOL.H },
];

export const BALL_COLORS = {
  0:'#f4f0e6', 1:'#e6bf1f', 2:'#1f4fc0', 3:'#d92222', 4:'#6a2596', 5:'#df6f1f',
  6:'#1f8a45', 7:'#7a1a1a', 8:'#141414',
  9:'#e6bf1f', 10:'#1f4fc0', 11:'#d92222', 12:'#6a2596', 13:'#df6f1f', 14:'#1f8a45', 15:'#7a1a1a',
};

export function ballGroup(n){ return n === 0 ? 'cue' : n === 8 ? 'eight' : n <= 7 ? 'solid' : 'stripe'; }
export function isStripe(n){ return n >= 9 && n <= 15; }

// Cue ball on the "kitchen" spot; 15 object balls racked as a triangle with the
// 8 in the centre of the third column and a solid/stripe in the back corners.
export function rackBalls(){
  const balls = [{ n: 0, x: POOL.W * 0.26, y: POOL.H / 2, vx: 0, vy: 0, potted: false }];
  const order = [1, 9, 2, 3, 8, 10, 4, 11, 5, 12, 13, 6, 14, 7, 15];
  const apexX = POOL.W * 0.62, sp = POOL.R * 2 + 0.6;
  let idx = 0;
  for (let col = 0; col < 5; col++){
    for (let row = 0; row <= col; row++){
      balls.push({
        n: order[idx++],
        x: apexX + col * sp * 0.9,
        y: POOL.H / 2 + (row - col / 2) * sp,
        vx: 0, vy: 0, potted: false,
      });
    }
  }
  return balls;
}

export function allStopped(balls){
  return balls.every(b => b.potted || (b.vx === 0 && b.vy === 0));
}
export function anyMoving(balls){ return !allStopped(balls); }

// Advance the simulation one tick. Movement is internally sub-stepped so no ball
// travels more than ~0.6R per increment — this prevents fast balls from tunnelling
// through each other or through a cushion. Returns the events that occurred:
// potted ball numbers, the first object ball the cue struck (foul rules), cushion hits.
export function stepBalls(balls){
  const potted = [];
  let firstHit = null;
  let cushion = false;

  let maxSpeed = 0;
  for (const b of balls){ if (!b.potted){ const s = Math.hypot(b.vx, b.vy); if (s > maxSpeed) maxSpeed = s; } }
  const nsub = Math.max(1, Math.ceil(maxSpeed / (POOL.R * 0.6)));

  for (let sub = 0; sub < nsub; sub++){
    // integrate a fraction of this tick's velocity
    for (const b of balls){ if (b.potted) continue; b.x += b.vx / nsub; b.y += b.vy / nsub; }
    // pockets — a ball is captured once, then skipped (never double-counted)
    for (const b of balls){
      if (b.potted) continue;
      for (const p of POCKETS){
        if (Math.hypot(b.x - p.x, b.y - p.y) < POOL.POCKET){ b.potted = true; b.vx = 0; b.vy = 0; potted.push(b.n); break; }
      }
    }
    // cushions
    for (const b of balls){
      if (b.potted) continue;
      if (b.x < POOL.R){ b.x = POOL.R; b.vx = -b.vx * POOL.REST; cushion = true; }
      else if (b.x > POOL.W - POOL.R){ b.x = POOL.W - POOL.R; b.vx = -b.vx * POOL.REST; cushion = true; }
      if (b.y < POOL.R){ b.y = POOL.R; b.vy = -b.vy * POOL.REST; cushion = true; }
      else if (b.y > POOL.H - POOL.R){ b.y = POOL.H - POOL.R; b.vy = -b.vy * POOL.REST; cushion = true; }
    }
    // ball-ball (equal mass elastic) + positional separation
    for (let i = 0; i < balls.length; i++){
      const a = balls[i]; if (a.potted) continue;
      for (let j = i + 1; j < balls.length; j++){
        const b = balls[j]; if (b.potted) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < POOL.R * 2){
          const nx = dx / d, ny = dy / d, overlap = POOL.R * 2 - d;
          a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
          b.x += nx * overlap / 2; b.y += ny * overlap / 2;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0){
            a.vx += rel * nx; a.vy += rel * ny;
            b.vx -= rel * nx; b.vy -= rel * ny;
            if (firstHit === null && (a.n === 0 || b.n === 0)) firstHit = a.n === 0 ? b.n : a.n;
          }
        }
      }
    }
  }
  // rolling friction, applied once per tick; snap to rest below the threshold (no jitter)
  for (const b of balls){
    if (b.potted) continue;
    b.vx *= POOL.FRICTION; b.vy *= POOL.FRICTION;
    if (Math.hypot(b.vx, b.vy) < POOL.STOP){ b.vx = 0; b.vy = 0; }
  }
  return { potted, firstHit, cushion };
}

// Pure 8-ball shot resolution. Given the settled table and what happened during
// the shot, decides group assignment, fouls, whose turn is next, and game over.
// `groups` is { you, rex } (each 'solid' | 'stripe' | null). `potted` is the list
// of ball numbers sunk this shot; `firstHit` is the first object ball the cue hit.
export function resolveShot(balls, shooter, groups, potted, firstHit){
  const cuePotted = potted.includes(0);
  const eightPotted = potted.includes(8);
  const objPotted = potted.filter(n => n !== 0 && n !== 8);
  const other = shooter === 'you' ? 'rex' : 'you';
  const gStart = groups[shooter];
  const newGroups = { you: groups.you, rex: groups.rex };
  let g = gStart;
  // assign groups on the first legally potted object ball (open table)
  if (!g && objPotted.length && !eightPotted){
    g = ballGroup(objPotted[0]);
    newGroups[shooter] = g;
    newGroups[other] = g === 'solid' ? 'stripe' : 'solid';
  }
  // foul: scratch, no ball contacted, or (already assigned) hitting the wrong group first
  const foul = cuePotted || firstHit == null
    || (gStart && firstHit !== 8 && ballGroup(firstHit) !== gStart);

  if (eightPotted){
    const clearedBefore = g ? remaining(balls, g) === 0 : false;
    const won = !!g && clearedBefore && !cuePotted && !foul;
    return { groups: newGroups, foul, cuePotted, over: true, result: won ? 'win' : 'lose',
             keepTurn: false, nextTurn: shooter, respotCue: false };
  }
  const pottedOwn = g ? objPotted.some(n => ballGroup(n) === g) : objPotted.length > 0;
  const keepTurn = !foul && pottedOwn;
  return { groups: newGroups, foul, cuePotted, over: false, result: null,
           keepTurn, nextTurn: keepTurn ? shooter : other, respotCue: cuePotted };
}

// Launch the cue ball toward (angle) with normalised power in [0,1].
export function shootCue(balls, angle, power){
  const cue = balls.find(b => b.n === 0);
  if (!cue || cue.potted) return;
  const v = Math.max(0, Math.min(1, power)) * POOL.MAXV;
  cue.vx = Math.cos(angle) * v;
  cue.vy = Math.sin(angle) * v;
}

// Count remaining (un-potted) balls of a group among object balls.
export function remaining(balls, group){
  return balls.filter(b => !b.potted && ballGroup(b.n) === group).length;
}
