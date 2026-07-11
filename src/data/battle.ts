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

// ---- Weapons (P2) — centralised roster ----
export const WEAPONS = {
  pistol:   { id:'pistol',   n:'Pistol',         ic:'🔫', dmg:16, fireCd:20, mag:9,  reload:70,  bulletSpeed:7.5, spread:0.030, recoil:0.5, range:190, falloff:0.45, pellets:1, auto:false, sfx:'pistol' },
  shotgun:  { id:'shotgun',  n:'Shotgun',        ic:'💥', dmg:9,  fireCd:44, mag:5,  reload:100, bulletSpeed:6.8, spread:0.170, recoil:1.5, range:105, falloff:0.85, pellets:6, auto:false, sfx:'shotgun' },
  rifle:    { id:'rifle',    n:'Assault Rifle',  ic:'🪖', dmg:12, fireCd:9,  mag:26, reload:90,  bulletSpeed:8.5, spread:0.055, recoil:0.8, range:230, falloff:0.40, pellets:1, auto:true,  sfx:'rifle' },
  marksman: { id:'marksman', n:'Marksman Rifle', ic:'🎯', dmg:44, fireCd:58, mag:5,  reload:110, bulletSpeed:11,  spread:0.006, recoil:1.3, range:360, falloff:0.12, pellets:1, auto:false, sfx:'marksman' },
};
export function weaponById(id){ return WEAPONS[id] || WEAPONS.pistol; }
// Range-scaled damage: full at point-blank, reduced by `falloff` toward the edge of range.
export function weaponDamage(w, dist){
  const f = Math.max(0, Math.min(1, dist / w.range));
  return Math.max(1, Math.round(w.dmg * (1 - w.falloff * f)));
}

export const BR_SHIELD_MAX = 100;
// Apply a hit — shield soaks first, then health. Returns what happened (for feedback).
export function applyHit(f, dmg){
  if (!f.alive) return { dmg: 0, shieldHit: false, elim: false };
  let remaining = dmg, shieldHit = false;
  if (f.shield > 0){ const s = Math.min(f.shield, remaining); f.shield -= s; remaining -= s; shieldHit = s > 0; }
  if (remaining > 0) f.hp -= remaining;
  const elim = f.hp <= 0;
  if (elim){ f.hp = 0; f.alive = false; }
  return { dmg, shieldHit, elim };
}

// ---- AI personalities (P6) ----
// keepDist values are tuned to the 480×360 arena (half-diagonal ~300) so nobody
// perpetually retreats into a corner.
export const PERSONALITIES = {
  aggressive: { push: 0.7,  coverBias: 0.3, keepDist: 80,  accuracy: 0.58 },
  cautious:   { push: 0.35, coverBias: 0.9, keepDist: 130, accuracy: 0.64 },
  scavenger:  { push: 0.25, coverBias: 0.7, keepDist: 120, accuracy: 0.55 },
  marksman:   { push: 0.5,  coverBias: 0.6, keepDist: 165, accuracy: 0.72 },
};
const BOT_PERSONALITY = { Donna: 'aggressive', Daz: 'marksman', Reanna: 'cautious', Becky: 'scavenger', Noa: 'aggressive' };
const BOT_WEAPON = { aggressive: 'shotgun', marksman: 'marksman', cautious: 'rifle', scavenger: 'pistol' };

// Player + bots at spawn-safe positions (clear of cover), each with a weapon + shield.
export function spawnFighters(){
  const mk = (id, name, x, y, isPlayer, color, personality) => {
    const wid = isPlayer ? 'pistol' : (BOT_WEAPON[personality] || 'pistol');
    const w = WEAPONS[wid];
    return { id, name, x, y, hp: BR.MAX_HP, shield: isPlayer ? 0 : (personality==='cautious'||personality==='marksman'?30:15),
             alive: true, isPlayer, color, personality, weapon: wid, ammo: w.mag, reloadT: 0, fireCd: 0,
             state: 'engage', spawnProtect: 150, elims: 0, hitFlash: 0 };
  };
  const spots = [ [60, 40], [420, 50], [40, 180], [420, 320], [240, 40] ];   // all clear of COVER
  const fighters = [mk(0, 'You', BR.W / 2, BR.H - 30, true, '#f2f2f2', null)];
  BOT_NAMES.forEach((n, i) => fighters.push(mk(i + 1, n, spots[i][0], spots[i][1], false, BOT_COLORS[n], BOT_PERSONALITY[n])));
  return fighters;
}

// ---- Cover & terrain (P3) — three POIs plus a few lane pieces. All solid. ----
export const COVER = [
  // Warehouse Yard (top-left)
  { x:70,  y:60,  w:8,  h:56, type:'wall'  },
  { x:100, y:70,  w:20, h:20, type:'crate' },
  { x:132, y:96,  w:20, h:20, type:'crate' },
  { x:96,  y:112, w:20, h:20, type:'crate' },
  // Woodland Camp (bottom-left)
  { x:80,  y:250, w:22, h:18, type:'rock'  },
  { x:130, y:244, w:16, h:16, type:'tree'  },
  { x:108, y:292, w:16, h:16, type:'tree'  },
  { x:150, y:296, w:22, h:16, type:'rock'  },
  // Service Station (right)
  { x:348, y:150, w:60, h:36, type:'wall'  },
  { x:338, y:210, w:40, h:20, type:'car'   },
  { x:412, y:150, w:6,  h:78, type:'fence' },
  // central lane pieces
  { x:230, y:158, w:22, h:22, type:'crate' },
  { x:280, y:98,  w:22, h:18, type:'rock'  },
  { x:198, y:252, w:22, h:22, type:'crate' },
];
export const POIS = [
  { n:'Warehouse Yard',  x:112, y:96  },
  { n:'Woodland Camp',   x:118, y:276 },
  { n:'Service Station', x:376, y:196 },
];
// Is a point (optionally a fighter of radius r) inside solid cover?
export function pointBlocked(x, y, r = 0){
  for (const c of COVER){ if (x > c.x - r && x < c.x + c.w + r && y > c.y - r && y < c.y + c.h + r) return true; }
  return false;
}
// Does a straight shot from A to B pass through cover? (line of sight / bullet block)
export function segmentBlocked(x0, y0, x1, y1){
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4) + 1;
  for (let i = 0; i <= steps; i++){ const t = i / steps; if (pointBlocked(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true; }
  return false;
}
// Move a fighter by (dx,dy), sliding along solid cover (axis-separated).
export function moveFighter(f, dx, dy){
  const r = BR.FIGHTER_R * 0.8;
  if (!pointBlocked(f.x + dx, f.y, r)) f.x += dx;
  if (!pointBlocked(f.x, f.y + dy, r)) f.y += dy;
  clampToArena(f);
}

// ---- Loot (P4, lightweight ground pickups near the POIs) ----
export function spawnLoot(){
  return [
    { x:130, y:96,  kind:'weapon', weapon:'rifle',    taken:false },
    { x:376, y:172, kind:'weapon', weapon:'marksman', taken:false },
    { x:96,  y:276, kind:'weapon', weapon:'shotgun',  taken:false },
    { x:112, y:120, kind:'shield', taken:false },
    { x:392, y:200, kind:'shield', taken:false },
    { x:250, y:180, kind:'health', taken:false },
    { x:118, y:250, kind:'health', taken:false },
    { x:240, y:300, kind:'weapon', weapon:'rifle',    taken:false },
    { x:376, y:220, kind:'dash',   taken:false },      // utility: temporary movement boost
    { x:150, y:120, kind:'dash',   taken:false },
  ];
}

// ---- Match medals (P11) — skill-based, never for merely playing ----
export const BR_MEDALS = [
  { id:'first_blood', n:'First Elimination', test: s => !!s.firstElim },
  { id:'sharpshooter',n:'Sharpshooter',      test: s => s.shots >= 8 && s.hits / s.shots >= 0.55 },
  { id:'triple',      n:'Triple Elimination',test: s => s.elims >= 3 },
  { id:'survivor',    n:'Survivor',          test: s => s.placement === 1 },
  { id:'storm_runner',n:'Storm Runner',      test: s => s.stormTicks >= 120 && s.placement <= 2 },
  { id:'close_call',  n:'Close Call',        test: s => s.placement === 1 && s.minHp <= 18 },
  { id:'flawless',    n:'No Damage Taken',   test: s => s.placement === 1 && s.damageTaken === 0 },
  { id:'comeback',    n:'Comeback',          test: s => s.placement === 1 && s.wasLowHp },
];
export function evaluateMedals(stats){
  return BR_MEDALS.filter(m => { try { return m.test(stats); } catch (e) { return false; } }).map(m => ({ id: m.id, n: m.n }));
}

// Safe-zone centre (fixed at arena centre for this mini).
export const STORM_CX = BR.W / 2;
export const STORM_CY = BR.H / 2;

// Phased safe zone: stable "warning" holds punctuated by "closing" shrinks. A
// short round (~52s at 60fps) — intentionally brisk for a pub console game.
const STORM_PHASES = (() => {
  const R0 = Math.hypot(BR.W, BR.H) / 2 + 10;   // covers the whole arena at the start
  return [
    [0, R0], [420, R0],               // warning 1
    [780, R0 * 0.62], [1200, R0 * 0.62],
    [1560, R0 * 0.40], [1980, R0 * 0.40],
    [2340, R0 * 0.22], [2760, R0 * 0.22],
    [3120, 24],
  ];
})();
export const STORM_END = 3120;
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
// Is the zone actively shrinking right now?
export function stormClosing(tick){ return stormRadius(tick + 6) < stormRadius(tick) - 0.05; }
// The radius the storm is heading toward (for the next-zone preview ring).
export function stormNextRadius(tick){
  const cur = stormRadius(tick);
  for (const [t, r] of STORM_PHASES){ if (t > tick && r < cur - 0.5) return r; }
  return STORM_PHASES[STORM_PHASES.length - 1][1];
}
// Ticks until the next closing starts (0 = closing now, -1 = no more closes).
export function stormTicksToClose(tick){
  if (stormClosing(tick)) return 0;
  for (let i = 1; i < STORM_PHASES.length; i++){
    const [t0, r0] = STORM_PHASES[i - 1], [t1, r1] = STORM_PHASES[i];
    if (t1 > tick && r1 < r0 - 0.5) return tick < t0 ? t0 - tick : 0;
  }
  return -1;
}
// Storm damage ramps up over the match (forgiving early, dangerous late).
export function stormDamage(tick){ return BR.STORM_DMG * (1 + Math.min(2.5, tick / 1200)); }

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
