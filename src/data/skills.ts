import data from './skills.json';

export interface SkillAction {
  id: string; n: string; lvl: number; ms: number; xp: number;
  out: Record<string, number>;
  in?: Record<string, number>;
}
export interface SkillDef { n: string; ic: string; desc: string; actions: SkillAction[]; }

export const SKILLS: Record<string, SkillDef> = data as Record<string, SkillDef>;
