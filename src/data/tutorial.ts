// ============================================================================
// THE ONE AUTHORITATIVE FROSTY TUTORIAL DEFINITION
// ----------------------------------------------------------------------------
// Every stage's instructions, objective, destination, recipe, quantity, reward,
// unlocks, completion condition and order live here. Every UI surface (welcome
// modal, Frosty banner, objective tracker, quest markers, completion summary)
// derives its wording and numbers from this module — so contradictions like
// "Frost vs Frosty", "5 vs 6 ore", "bottom vs top tabs" or differently-worded
// destinations can never drift again. Pure & testable: no game-state imports.
// ============================================================================

/** The guide is always Frosty. */
export const TUTORIAL_GUIDE = 'Frosty';

/** Accurate description of the CURRENT navigation: category tabs across the TOP. */
export const NAV_HINT = 'Your category tabs run across the <b>top</b> of the screen — more unlock as you play.';

export interface TutorialStage {
  id: string;                    // stage ID
  guide: string;                 // always 'Frosty'
  dialogue: string;              // Frosty dialogue (template: {name}, {n}=this stage qty, {prev}=previous stage qty; may contain <b>)
  objective: string;             // objective text (template: {n})
  destination: { id: string; name: string; marker: string };  // world-object id · panel/where name · on-map marker
  quantity: number;              // required quantity for this stage
  recipe: { in: Record<string, number>; out: Record<string, number> } | null;  // null for mine/deliver
  produces: string | null;       // item yielded into inventory (null for the delivery stage)
  reward: { coins: number };     // stage-completion reward
  unlocks: string[];             // skills/features this stage introduces (informational)
  completion:                    // completion condition (declarative)
    | { metric: 'inventory'; item: string; count: number }
    | { metric: 'flag'; flag: string };
  next: string | null;           // next stage ID (null = final stage)
}

export const TUTORIAL_STAGES: TutorialStage[] = [
  {
    id: 'mine', guide: TUTORIAL_GUIDE,
    dialogue: "Hey {name}! Frosty here — I keep things cool around the valley. Follow the path <b>west</b> into the quarry canyon and tap the <b>Iron Rock</b> to mine <b>{n} Iron Ore</b>. It'll stop on its own when you've got enough.",
    objective: 'Mine {n} Iron Ore',
    destination: { id: 'rock_iron4', name: 'Quarry (far west)', marker: '⛏️ Iron Rock — tap to mine!' },
    quantity: 6, recipe: null, produces: 'iron_ore', reward: { coins: 40 },
    unlocks: ['mining'], completion: { metric: 'inventory', item: 'iron_ore', count: 6 }, next: 'smelt',
  },
  {
    id: 'smelt', guide: TUTORIAL_GUIDE,
    dialogue: "Nice swing, {name}! Ore's no good raw. Walk to the <b>Furnace</b> (the building with the chimney, west of the quarry) and smelt <b>{n} Iron Bars</b> — exactly what your {prev} ore makes.",
    objective: 'Smelt {n} Iron Bars',
    destination: { id: 'furnace', name: 'The Furnace', marker: '🔥 Furnace — smelt here' },
    quantity: 3, recipe: { in: { iron_ore: 2 }, out: { iron_bar: 1 } }, produces: 'iron_bar', reward: { coins: 50 },
    unlocks: ['steelworks'], completion: { metric: 'inventory', item: 'iron_bar', count: 3 }, next: 'make',
  },
  {
    id: 'make', guide: TUTORIAL_GUIDE,
    dialogue: "Toasty! Now make something someone will pay for — pop into the <b>Workshop</b> next door and press <b>{n} Brackets</b> from your {prev} bars.",
    objective: 'Press {n} Brackets',
    destination: { id: 'workshop', name: 'The Workshop', marker: '🏭 Workshop — craft here' },
    quantity: 3, recipe: { in: { iron_bar: 1 }, out: { bracket: 1 } }, produces: 'bracket', reward: { coins: 60 },
    unlocks: ['manufacturing'], completion: { metric: 'inventory', item: 'bracket', count: 3 }, next: 'deliver',
  },
  {
    id: 'deliver', guide: TUTORIAL_GUIDE,
    dialogue: "Last step: head to the <b>Depot</b> and deliver the <b>Tutorial Order</b> — it wants exactly your <b>{n} Brackets</b>, pinned to the top of your contracts.",
    objective: 'Deliver the Tutorial Order',
    destination: { id: 'depot', name: 'The Depot', marker: '📦 Depot — deliver here' },
    quantity: 3, recipe: null, produces: null, reward: { coins: 60 },
    unlocks: ['contracts'], completion: { metric: 'flag', flag: 'tutContractDone' }, next: null,
  },
];

/** One-time coin bonus for completing the whole chain. */
export const TUTORIAL_COMPLETE_BONUS = 100;

/**
 * The guaranteed Tutorial Order: pinned to the top of the contract board, never
 * expires (deadline-free), and delivering it is reputation-safe.
 */
export const TUTORIAL_CONTRACT = {
  client: 'Featherstone Works (Tutorial Order)',
  item: 'bracket', qty: 3, coins: 150, xp: 30,
  tutorial: true, pinned: true, deadlineFree: true, reputationSafe: true,
};

// ---- Derived lookups & helpers (all pure) ---------------------------------
export function stageById(id: string): TutorialStage | null { return TUTORIAL_STAGES.find(s => s.id === id) || null; }
export function stageIndex(id: string): number { return TUTORIAL_STAGES.findIndex(s => s.id === id); }

/** item → exact tutorial target quantity, derived from the stages (iron_ore:6, iron_bar:3, bracket:3). */
export const TUTORIAL_TARGETS: Record<string, number> =
  Object.fromEntries(TUTORIAL_STAGES.filter(s => s.produces).map(s => [s.produces as string, s.quantity]));

/** Back-compat shape used by older callers/tests. */
export const TUTORIAL_STEPS = TUTORIAL_STAGES.map(s => ({
  key: s.id,
  item: s.produces || (s.completion.metric === 'inventory' ? s.completion.item : TUTORIAL_CONTRACT.item),
  need: s.quantity,
  where: s.destination.name,
  target: s.destination.id,
}));

/** A tutorial production run must halt at exactly the target amount (no surplus). */
export function tutorialShouldStop(itemId: string, currentCount: number): boolean {
  const t = TUTORIAL_TARGETS[itemId];
  return t != null && currentCount >= t;
}
export function isTutorialItem(itemId: string): boolean { return itemId in TUTORIAL_TARGETS; }

/** Interpolate a stage template. The game supplies the player name; {prev} = the
 *  previous stage's quantity (for copy like "your 6 ore"). */
export function fillTemplate(tpl: string, opts: { name?: string; n?: number; prev?: number } = {}): string {
  return tpl
    .replace(/\{name\}/g, opts.name ?? 'Founder')
    .replace(/\{n\}/g, opts.n != null ? String(opts.n) : '')
    .replace(/\{prev\}/g, opts.prev != null ? String(opts.prev) : '');
}

/**
 * Safe recovery for a save stranded mid-tutorial without the inputs for its
 * current stage (old 5/2/1 amounts, or resources consumed by another action).
 * Returns only the deficit, or {} when nothing is owed — so it never double-grants.
 */
export function tutorialRecovery(step: number, inv: { iron_ore?: number; iron_bar?: number; bracket?: number }): Record<string, number> {
  const ore = inv.iron_ore || 0, bar = inv.iron_bar || 0, brk = inv.bracket || 0;
  const smelt = stageById('smelt')!, make = stageById('make')!, deliver = stageById('deliver')!;
  if (step === stageIndex('smelt')){       // need enough ORE to smelt the required bars
    const needBar = Math.max(0, smelt.quantity - bar);
    const needOre = Math.max(0, needBar * (smelt.recipe!.in.iron_ore) - ore);
    return needOre > 0 ? { iron_ore: needOre } : {};
  }
  if (step === stageIndex('make')){         // need enough BARS to press the required brackets
    const needBrk = Math.max(0, make.quantity - brk);
    const needBar = Math.max(0, needBrk * (make.recipe!.in.iron_bar) - bar);
    return needBar > 0 ? { iron_bar: needBar } : {};
  }
  if (step === stageIndex('deliver')){      // need the brackets to deliver
    const needBrk = Math.max(0, deliver.quantity - brk);
    return needBrk > 0 ? { bracket: needBrk } : {};
  }
  return {};
}
