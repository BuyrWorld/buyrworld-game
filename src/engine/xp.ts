/** RuneScape-style XP curve. t[level] = XP required to BE that level. */
export const XP_TABLE: number[] = (() => {
  const t: number[] = [0, 0];
  let pts = 0;
  for (let l = 1; l < 100; l++) {
    pts += Math.floor(l + 300 * Math.pow(2, l / 7));
    t.push(Math.floor(pts / 4));
  }
  return t;
})();

export function levelFromXp(xp: number): number {
  let l = 1;
  while (l < 99 && xp >= XP_TABLE[l + 1]) l++;
  return l;
}
