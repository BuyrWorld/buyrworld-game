// @ts-nocheck
// M22 — Career Paths. Four data-driven careers layered OVER the existing skills: each
// maps to a "lane" of related skills, and its RANK is derived from the average level of
// those skills (no new grind — it reflects what you already do). The player FOCUSES one
// career at a time; the focused career's rank-scaled perk (a lane XP boost) is what's
// live, so specialising is a real choice. Pure + deterministic here; the S.career state,
// the perk hook and the track UI live in main.ts. Leaves a clean seat for AI mentors.

export interface Career {
  id: string;
  n: string;
  ic: string;
  blurb: string;
  skills: string[];    // the lane's skills (existing skill ids); rank = avg of their levels
  ranks: string[];     // rank titles, index 0 = "no rank yet" up to the top
}

// 5 real ranks (index 1..5); index 0 is the pre-rank state.
export const CAREER_RANK_THRESHOLDS = [0, 5, 15, 25, 40, 60];   // avg lane level for rank 0..5
export const CAREER_MAX_RANK = 5;

export const CAREERS: Career[] = [
  { id:'buyer', n:'Buyer', ic:'🛒', blurb:'Sourcing and trade — the deal-maker of the supply chain.',
    skills:['trading','logistics'],
    ranks:['Unranked','Junior Buyer','Buyer','Senior Buyer','Category Manager','Head of Procurement'] },
  { id:'engineer', n:'Engineer', ic:'⚙️', blurb:'Smelting and fabrication — turning raw stock into product.',
    skills:['steelworks','manufacturing'],
    ranks:['Unranked','Apprentice','Fabricator','Engineer','Senior Engineer','Chief Engineer'] },
  { id:'artisan', n:'Artisan', ic:'🧺', blurb:'Crafted goods from what the land and garden give.',
    skills:['crafting','foraging','farming'],
    ranks:['Unranked','Hobbyist','Craftsperson','Artisan','Master Artisan','Guild Master'] },
  { id:'prospector', n:'Prospector', ic:'⛏️', blurb:'Extraction — ore, timber and the day\'s catch.',
    skills:['mining','woodcutting','fishing'],
    ranks:['Unranked','Digger','Prospector','Veteran Prospector','Pit Boss','Frontier Legend'] },
];

export function careerById(id: string): Career | null {
  return CAREERS.find(c => c.id === id) || null;
}

// The lane "score" = average level across the career's skills (rounded down).
export function careerScore(career: Career, levelOf: (skill: string) => number): number {
  if (!career || !career.skills.length) return 0;
  const sum = career.skills.reduce((a, s) => a + Math.max(0, levelOf(s) || 0), 0);
  return Math.floor(sum / career.skills.length);
}

// Rank (0..CAREER_MAX_RANK) for a given lane score.
export function careerRank(score: number): number {
  const s = Math.max(0, score || 0);
  let r = 0;
  for (let k = 1; k < CAREER_RANK_THRESHOLDS.length; k++) if (s >= CAREER_RANK_THRESHOLDS[k]) r = k;
  return r;
}

export function rankTitle(career: Career, rank: number): string {
  const r = Math.max(0, Math.min(CAREER_MAX_RANK, rank | 0));
  return career.ranks[r] || career.ranks[0];
}

// The lane XP bonus fraction from the FOCUSED career at a rank (+4% per rank; rank 5 = +20%).
export function careerXpPct(rank: number): number {
  return Math.max(0, Math.min(CAREER_MAX_RANK, rank | 0)) * 0.04;
}

// The lane score needed for the next rank, or null at the top.
export function nextRankAt(rank: number): number | null {
  const r = Math.max(0, Math.min(CAREER_MAX_RANK, rank | 0));
  return r < CAREER_MAX_RANK ? CAREER_RANK_THRESHOLDS[r + 1] : null;
}

// Progress 0..1 from the current rank's threshold toward the next (1 at the top).
export function careerProgress(score: number): number {
  const s = Math.max(0, score || 0);
  const r = careerRank(s);
  if (r >= CAREER_MAX_RANK) return 1;
  const lo = CAREER_RANK_THRESHOLDS[r], hi = CAREER_RANK_THRESHOLDS[r + 1];
  const span = hi - lo;
  return span > 0 ? Math.max(0, Math.min(1, (s - lo) / span)) : 1;
}
