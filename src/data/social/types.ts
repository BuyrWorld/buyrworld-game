// ============================================================================
// SOCIAL / DIALOGUE ENGINE — typed, serialisable data model.
// ----------------------------------------------------------------------------
// A data-driven NPC dialogue, relationship and memory system. Everything here is
// PURE and testable: content authors declare graphs of nodes/choices with typed
// CONDITIONS and typed EFFECTS (descriptors, never functions), so dialogue stays
// deterministic, serialisable and console-certifiable. main.ts owns the runtime
// state (S.social) and the adapters that turn effect descriptors into real game
// changes; this module never imports the game.
// ============================================================================

export const SOCIAL_CONTENT_VERSION = 1;

// ---- Relationships ---------------------------------------------------------
export type RelationshipDim = 'warmth' | 'trust' | 'respect' | 'suspicion';
export interface NpcRelationship {
  warmth: number;      // 0..100 — how much they like you
  trust: number;       // 0..100 — how much they rely on your word
  respect: number;     // 0..100 — how much they rate your competence
  suspicion: number;   // 0..100 — how wary they are of you/your associates
  lastInteractionDay: number;
  interactionCount: number;
  stage: RelationshipStage;
}
export type RelationshipStage = 'stranger' | 'acquaintance' | 'familiar' | 'friend' | 'confidant' | 'wary' | 'hostile';

// ---- Memory ----------------------------------------------------------------
export type MemoryCategory =
  | 'promise' | 'help' | 'betrayal' | 'business' | 'gift' | 'crime'
  | 'rumour' | 'relationship' | 'contract' | 'supplier' | 'lifestyle' | 'social';
export type MemorySource = 'witnessed' | 'experienced' | 'heard';

export interface NpcMemory {
  id: string;               // stable, unique — dedupes writes
  npc: string;              // the NPC who holds this memory
  category: MemoryCategory;
  subject: string;          // what/who it is about (npc id, contract id, item id, 'player'…)
  summaryKey: string;       // localisation key / short text
  emotion: number;          // -100..100 — how it makes them feel about the subject
  strength: number;         // 0..100 — salience; low-value flavour decays first
  source: MemorySource;
  confidence: number;       // 0..100 — how sure they are it's true (rumours < experienced)
  truth?: boolean;          // where knowable; undefined = unverified
  createdDay: number;
  lastRefDay: number;
  expiresDay?: number;      // optional hard expiry
  tags: string[];
  refs?: { contract?: string; quest?: string; supplier?: string; npc?: string; location?: string };
}

// ---- Conditions (typed registry keys, not functions) -----------------------
export type Expr =
  | { op: 'first_meeting' }
  | { op: 'returning' }
  | { op: 'time_of_day'; is: 'morning' | 'afternoon' | 'evening' | 'night' }
  | { op: 'season'; is: string }
  | { op: 'location'; is: string }
  | { op: 'mood'; is: string }
  | { op: 'rel'; dim: RelationshipDim; gte?: number; lte?: number }
  | { op: 'stage'; is: RelationshipStage }
  | { op: 'chose'; choice: string }               // a prior committed choice id
  | { op: 'has_memory'; category?: MemoryCategory; subject?: string; tag?: string; minStrength?: number }
  | { op: 'flag'; key: string; is?: boolean }      // dialogue flag set by effects
  | { op: 'tut_done' }
  | { op: 'contract_active' }
  | { op: 'contract_deliverable' }
  | { op: 'contract_expired_recently' }
  | { op: 'pipeline_stage'; is: string }
  | { op: 'customer_rep'; client: string; gte?: number; lte?: number }
  | { op: 'supplier_short'; offer?: string }
  | { op: 'has_item'; item: string; gte?: number }
  | { op: 'cash'; gte?: number; lte?: number }
  | { op: 'skill'; skill: string; gte?: number }
  | { op: 'owns_business'; is: string }
  | { op: 'economy'; phase?: string; demand_gte?: number; demand_lte?: number }
  | { op: 'crime_suspicion'; gte?: number }
  | { op: 'companion'; is?: string }
  | { op: 'home_tier'; gte?: number }
  | { op: 'seen'; node: string }
  | { op: 'not_seen'; node: string }
  | { op: 'cooldown_ok'; key: string }
  | { op: 'not'; expr: Expr }
  | { op: 'all'; of: Expr[] }
  | { op: 'any'; of: Expr[] };

// ---- Effects (typed descriptors; adapters apply them idempotently) ---------
export type Effect =
  | { id: string; kind: 'relationship'; dim: RelationshipDim; delta: number }
  | { id: string; kind: 'memory'; write: Omit<NpcMemory, 'npc' | 'createdDay' | 'lastRefDay'> & { npc?: string } }
  | { id: string; kind: 'forget'; memoryId: string }
  | { id: string; kind: 'flag'; key: string; value: boolean }
  | { id: string; kind: 'log'; text: string; tone?: 'good' | 'bad' | '' }
  | { id: string; kind: 'followup'; graph: string; afterDays: number }
  | { id: string; kind: 'radio_unlock'; label?: string }
  | { id: string; kind: 'grant_coins'; amount: number }
  | { id: string; kind: 'grant_item'; item: string; qty: number }
  | { id: string; kind: 'take_item'; item: string; qty: number }
  | { id: string; kind: 'reputation'; client: string; delta: number }
  | { id: string; kind: 'contract_offer'; tag?: string }
  | { id: string; kind: 'supplier_intel'; offer: string; note: string }
  | { id: string; kind: 'crime_suspicion'; delta: number }
  | { id: string; kind: 'rumour'; category: MemoryCategory; subject: string; summaryKey: string; truth?: boolean; spreadTo?: number };

export type ChoiceTone = 'kind' | 'neutral' | 'firm' | 'shrewd' | 'reckless' | 'apologetic';

export interface DialogueChoice {
  id: string;
  text: string;
  tone?: ChoiceTone;
  when?: Expr;                 // availability
  disabledReason?: string;    // shown greyed when `when` fails but the choice is still listed
  showDisabled?: boolean;     // list even when unavailable (with the reason)
  requireSkill?: { skill: string; lvl: number };
  effects?: Effect[];
  next?: string;              // node id, or omitted to end
}

export type Expression = 'neutral' | 'happy' | 'concerned' | 'angry' | 'suspicious' | 'surprised' | 'disappointed';

export interface DialogueNode {
  id: string;
  speaker?: 'npc' | 'player';
  expression?: Expression;
  text: string | Array<{ when?: Expr; text: string }>;   // conditional text variants
  when?: Expr;
  choices?: DialogueChoice[];
  autoEffects?: Effect[];      // applied once when the node is first shown
  next?: string;               // auto-advance when there are no choices
  cooldownKey?: string;
  tags?: string[];
}

export interface DialogueGraph {
  id: string;
  npc: string;
  entry: string;               // entry node id
  priority: number;            // 1 (urgent) … 9 (generic) — see PRIORITY_TIERS
  when?: Expr;                 // graph-level guard
  once?: boolean;              // play at most once ever
  cooldownDays?: number;       // days before it can replay
  nodes: DialogueNode[];
  version: number;
}

// The conversation-selection priority tiers (Part 5).
export const PRIORITY_TIERS = {
  URGENT_CONTRACT: 1,
  IMMEDIATE_CONSEQUENCE: 2,
  PROMISE_FOLLOWUP: 3,
  ACTIVE_REQUEST: 4,
  RELATIONSHIP: 5,
  SUPPLIER_INTEL: 6,
  WORLD_CONTEXT: 7,
  FLAVOUR: 8,
  GREETING: 9,
} as const;

// ---- NPC profile + voice ---------------------------------------------------
export interface VoiceProfile {
  sentenceLength: 'short' | 'medium' | 'long';
  formality: 'blunt' | 'plain' | 'formal';
  humour: 'none' | 'dry' | 'warm' | 'sly';
  temper: 'calm' | 'testy' | 'fiery';
  values: string[];
  taboo: string[];
  earnsWarmth: string;
  earnsTrust: string;
  earnsRespect: string;
  raisesSuspicion: string;
  signature: string[];         // signature phrases
  expertise: string[];
  ambition: string;
  hiddenConcern: string;
}

export interface NpcProfile {
  id: string;
  displayName: string;
  occupation: string;
  organisation?: string;
  portrait: string;            // an emoji/icon token (real art can replace later)
  expressions?: Partial<Record<Expression, string>>;
  voice: VoiceProfile;
  values?: string[];
  dislikes?: string[];
  ambitions?: string[];
  secrets?: string[];
  defaultTopics?: string[];
  relationshipConfig?: { startWarmth?: number; startTrust?: number; startRespect?: number; startSuspicion?: number };
}
