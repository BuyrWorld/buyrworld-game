// @ts-nocheck
// "Battle Royale" — the mini game on the console in the player's cottage. A
// top-down last-one-standing shooter with a shrinking safe zone: outlast five
// bots (Donna, Daz, Reanna, Becky, Noa) to win a Victory Medal. Pure/testable
// core here; input, rendering and the game loop live in main.ts.

export const BR = {
  W: 480, H: 360,          // arena logical size
  MAX_HP: 100,
  SPEED: 2.2,              // move speed (px/tick)
  SPRINT: 3.4,
  BULLET_SPEED: 7,
  BULLET_DMG: 16,
  FIRE_CD: 20,             // ticks between shots
  MAG: 6,
  RELOAD: 95,             // ticks to reload
  FIGHTER_R: 9,
  BULLET_R: 3,
  STORM_DMG: 0.45,         // hp per tick outside the safe zone
  BOT_RANGE: 200,          // how close a bot shoots
};

export const BOT_NAMES = ['Donna', 'Daz', 'Reanna', 'Becky', 'Noa'];
export const BOT_COLORS = {
  Donna: '#e84a8a', Daz: '#4a8ae8', Reanna: '#9a5ae8', Becky: '#e8a84a', Noa: '#3ad07a',
};

// Player at the bottom, bots spread around the arena edges.
export function spawnFighters(){
  const P = (id, name, x, y, isPlayer, color) => ({ id, name, x, y, hp: BR.MAX_HP, alive: true, isPlayer, color, fireCd: 0 });
  const spots = [ [80, 60], [400, 60], [60, 300], [420, 300], [240, 44] ];
  const fighters = [P(0, 'You', BR.W / 2, BR.H - 44, true, '#f2f2f2')];
  BOT_NAMES.forEach((n, i) => fighters.push(P(i + 1, n, spots[i][0], spots[i][1], false, BOT_COLORS[n])));
  return fighters;
}

// Safe-zone centre (fixed at arena centre for this mini).
export const STORM_CX = BR.W / 2;
export const STORM_CY = BR.H / 2;

// Shrinking safe-zone radius over elapsed ticks (piecewise linear).
const STORM_PHASES = (() => {
  const R0 = Math.hypot(BR.W, BR.H) / 2 + 10;   // covers the whole arena at the start
  return [ [0, R0], [500, R0 * 0.66], [1050, R0 * 0.42], [1650, R0 * 0.22], [2300, 26] ];
})();
export function stormRadius(tick){
  const ph = STORM_PHASES;
  if (tick <= ph[0][0]) return ph[0][1];
  for (let i = 1; i < ph.length; i++){
    if (tick <= ph[i][0]){
      const [t0, r0] = ph[i - 1], [t1, r1] = ph[i];
      return r0 + (r1 - r0) * ((tick - t0) / (t1 - t0));
    }
  }
  return ph[ph.length - 1][1];
}

export function outsideStorm(f, r, cx = STORM_CX, cy = STORM_CY){
  return Math.hypot(f.x - cx, f.y - cy) > r;
}

export function applyDamage(f, dmg){
  if (!f.alive) return false;
  f.hp -= dmg;
  if (f.hp <= 0){ f.hp = 0; f.alive = false; return true; }   // returns true on elimination
  return false;
}

export function aliveFighters(fighters){ return fighters.filter(f => f.alive); }
export function aliveCount(fighters){ return aliveFighters(fighters).length; }
export function aliveEnemies(fighters, id){ return fighters.filter(f => f.alive && f.id !== id); }
export function player(fighters){ return fighters.find(f => f.isPlayer); }

export function playerWon(fighters){
  const p = player(fighters);
  return !!p && p.alive && fighters.every(f => f.isPlayer || !f.alive);
}
export function playerLost(fighters){
  const p = player(fighters);
  return !!p && !p.alive;
}

export function nearestEnemy(from, fighters){
  let best = null, bd = Infinity;
  for (const f of fighters){
    if (!f.alive || f.id === from.id) continue;
    const d = Math.hypot(f.x - from.x, f.y - from.y);
    if (d < bd){ bd = d; best = f; }
  }
  return best;
}

export function aimAngle(fx, fy, tx, ty){ return Math.atan2(ty - fy, tx - fx); }

// The first alive fighter (other than the shooter) a bullet is currently touching.
export function bulletHits(bullet, fighters){
  for (const f of fighters){
    if (!f.alive || f.id === bullet.owner) continue;
    if (Math.hypot(f.x - bullet.x, f.y - bullet.y) < BR.FIGHTER_R + BR.BULLET_R) return f;
  }
  return null;
}

export function clampToArena(f){
  f.x = Math.max(BR.FIGHTER_R, Math.min(BR.W - BR.FIGHTER_R, f.x));
  f.y = Math.max(BR.FIGHTER_R, Math.min(BR.H - BR.FIGHTER_R, f.y));
}
