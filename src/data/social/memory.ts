// NPC memory + controlled rumour model. Pure. Memories are held per-NPC; important
// ones persist, low-value flavour decays or is summarised so saves never bloat.
import type { NpcMemory, MemoryCategory } from './types.ts';

export const MEMORY_CAP_PER_NPC = 24;          // hard cap; weakest are summarised away
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

// Create a memory with sensible defaults. `id` MUST be stable so re-writing the same
// event dedupes rather than duplicating (idempotent memory writes).
export function makeMemory(npc: string, day: number, m: Partial<NpcMemory> & { id: string; category: MemoryCategory; subject: string; summaryKey: string }): NpcMemory {
  return {
    id: m.id, npc, category: m.category, subject: m.subject, summaryKey: m.summaryKey,
    emotion: Math.max(-100, Math.min(100, Math.round(m.emotion ?? 0))),
    strength: clamp(m.strength ?? 50),
    source: m.source ?? 'experienced',
    confidence: clamp(m.confidence ?? (m.source === 'heard' ? 45 : 90)),
    truth: m.truth,
    createdDay: m.createdDay ?? day,
    lastRefDay: m.lastRefDay ?? day,
    expiresDay: m.expiresDay,
    tags: m.tags ?? [],
    refs: m.refs,
  };
}

// Insert or update (by id). Returns a NEW list, capped/summarised. Never duplicates.
export function writeMemory(list: NpcMemory[], mem: NpcMemory): NpcMemory[] {
  const out = list.filter(x => x.id !== mem.id);
  out.push(mem);
  return capMemories(out, mem.createdDay);
}

export function forgetMemory(list: NpcMemory[], id: string): NpcMemory[] { return list.filter(x => x.id !== id); }

// Find memories, most-salient first.
export function recallMemories(list: NpcMemory[], q: { category?: MemoryCategory; subject?: string; tag?: string; minStrength?: number } = {}): NpcMemory[] {
  return list
    .filter(m =>
      (q.category === undefined || m.category === q.category) &&
      (q.subject === undefined || m.subject === q.subject) &&
      (q.tag === undefined || m.tags.includes(q.tag)) &&
      (q.minStrength === undefined || m.strength >= q.minStrength))
    .sort((a, b) => (b.strength * (0.5 + b.confidence / 200)) - (a.strength * (0.5 + a.confidence / 200)));
}
export function hasMemory(list: NpcMemory[], q: Parameters<typeof recallMemories>[1]): boolean { return recallMemories(list, q).length > 0; }

// A memory's effective salience decays with age unless it is important (high strength
// or a promise/betrayal/crime), and is refreshed when referenced.
const PERSISTENT: MemoryCategory[] = ['promise', 'betrayal', 'crime', 'contract'];
export function decayStrength(m: NpcMemory, day: number): number {
  if (PERSISTENT.includes(m.category) || m.strength >= 80) return m.strength;   // important memories persist
  const age = Math.max(0, day - m.lastRefDay);
  const loss = Math.min(m.strength, Math.floor(age * 1.5));
  return Math.max(0, m.strength - loss);
}

// Daily maintenance: apply decay, drop expired/faded flavour, keep under the cap.
export function decayMemories(list: NpcMemory[], day: number): NpcMemory[] {
  const kept: NpcMemory[] = [];
  for (const m of list) {
    if (m.expiresDay !== undefined && day >= m.expiresDay && !PERSISTENT.includes(m.category)) continue;
    const s = decayStrength(m, day);
    if (s <= 0 && !PERSISTENT.includes(m.category)) continue;   // faded flavour is forgotten
    kept.push({ ...m, strength: s });
  }
  return capMemories(kept, day);
}

// Enforce the per-NPC cap by summarising away the weakest non-persistent memories.
export function capMemories(list: NpcMemory[], day: number): NpcMemory[] {
  if (list.length <= MEMORY_CAP_PER_NPC) return list;
  const persistent = list.filter(m => PERSISTENT.includes(m.category) || m.strength >= 80);
  const rest = list.filter(m => !(PERSISTENT.includes(m.category) || m.strength >= 80))
    .sort((a, b) => b.strength - a.strength);
  const room = Math.max(0, MEMORY_CAP_PER_NPC - persistent.length);
  return [...persistent, ...rest.slice(0, room)];
}

// Reference a memory (refreshes it so it stops decaying while it stays relevant).
export function referenceMemory(list: NpcMemory[], id: string, day: number): NpcMemory[] {
  return list.map(m => m.id === id ? { ...m, lastRefDay: day, strength: Math.min(100, m.strength + 4) } : m);
}

// ---- Rumours: controlled knowledge spread --------------------------------
// A rumour is a memory with source 'heard' and reduced confidence. It only spreads at
// deliberate ticks, and only to a bounded set of NPCs — never omniscient broadcast.
export function rumourFromEvent(origin: NpcMemory, hearer: string, day: number): NpcMemory {
  // second-hand: lower confidence, slightly distorted emotion, marked as heard
  return makeMemory(hearer, day, {
    id: `rumour:${origin.id}:${hearer}`,
    category: 'rumour',
    subject: origin.subject,
    summaryKey: origin.summaryKey,
    emotion: Math.round(origin.emotion * 0.6),
    strength: Math.max(10, Math.round(origin.strength * 0.6)),
    source: 'heard',
    confidence: Math.max(15, Math.round(origin.confidence * 0.5)),
    truth: origin.truth,          // preserves truth state; distortion is in confidence
    tags: [...origin.tags, 'rumour'],
    refs: origin.refs,
  });
}
