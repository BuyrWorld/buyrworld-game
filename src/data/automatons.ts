// @ts-nocheck
// Robotics & Automation Campus — helper "automatons" (mechanical bots, NOT the
// gated AI-mentor features). Each is built from crafted parts + coins in the
// Automation Lab and assigned one-per-skill for a passive, idle-safe bonus:
// either faster actions or a chance of bonus yield. Pure/testable; wired into
// speedMult()/completeAction() in main.ts exactly like pet bonuses.

// Which automaton group can help each timed action skill.
export const SKILL_GROUP: Record<string, string> = {
  mining:'gather', woodcutting:'gather', foraging:'gather', fishing:'gather',
  steelworks:'process', manufacturing:'process', crafting:'process',
};

export interface Automaton {
  id: string; name: string; ic: string; group: 'gather'|'process';
  kind: 'speed'|'yield'; val: number; ds: string;
  cost: { coins: number; items: Record<string, number> };
}

export const AUTOMATONS: Automaton[] = [
  { id:'gather_drone',    name:'Gathering Drone', ic:'🛸', group:'gather',  kind:'speed', val:0.90, ds:'−10% action time',
    cost:{ coins:2500, items:{ gearbox:2, sensor:1 } } },
  { id:'auto_harvester',  name:'Auto-Harvester',  ic:'🌾', group:'gather',  kind:'yield', val:0.14, ds:'+14% chance of bonus yield',
    cost:{ coins:3200, items:{ gearbox:1, sensor:2 } } },
  { id:'fab_arm',         name:'Fabricator Arm',  ic:'🦾', group:'process', kind:'speed', val:0.90, ds:'−10% action time',
    cost:{ coins:3600, items:{ chassis:2, sensor:1 } } },
  { id:'yield_optimizer', name:'Yield Optimizer', ic:'📊', group:'process', kind:'yield', val:0.14, ds:'+14% chance of bonus yield',
    cost:{ coins:4200, items:{ chassis:1, sensor:2 } } },
];

export function automatonById(id: string): Automaton | undefined {
  return AUTOMATONS.find(a => a.id === id);
}
export function automatonsForSkill(skill: string): Automaton[] {
  const g = SKILL_GROUP[skill];
  return g ? AUTOMATONS.filter(a => a.group === g) : [];
}
// Speed multiplier (≤1) an assigned automaton grants on a skill; 1 = no effect.
export function autoSpeedMult(skill: string, assignedId?: string): number {
  const a = automatonById(assignedId || '');
  return (a && a.group === SKILL_GROUP[skill] && a.kind === 'speed') ? a.val : 1;
}
// Bonus-yield chance (0..1) an assigned automaton grants on a skill.
export function autoYieldChance(skill: string, assignedId?: string): number {
  const a = automatonById(assignedId || '');
  return (a && a.group === SKILL_GROUP[skill] && a.kind === 'yield') ? a.val : 0;
}
