// ============================================================================
// ANALYTICS — a tiny, privacy-safe event log for the Contract-to-Cash slice.
// ----------------------------------------------------------------------------
// Records the nine flagship funnel events. NO personal information: props are
// sanitised to primitive game values only (numbers / short enum strings / bools);
// player name, email and free text can never enter the log. Capped ring buffer so
// it never grows unbounded. Pure — main.ts appends + persists.
// ============================================================================

export const ANALYTICS_EVENTS = [
  'flagship_opened',
  'quotation_reviewed',
  'supplier_selected',
  'production_strategy_selected',
  'disruption_response',
  'quality_decision',
  'delivered',
  'abandoned',
  'final_margin',
] as const;
export type AnalyticsEvent = typeof ANALYTICS_EVENTS[number];

export const ANALYTICS_CAP = 300;
export interface AnalyticsRecord { e: AnalyticsEvent; t: number; p: Record<string, number | string | boolean>; }

export function isAnalyticsEvent(e: string): e is AnalyticsEvent {
  return (ANALYTICS_EVENTS as readonly string[]).includes(e);
}

// Keep only primitive, non-identifying values. Strings are length-capped so no
// free text / names can slip in. Anything else is dropped.
export function sanitizeProps(p: any): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {};
  if (p && typeof p === 'object') {
    for (const k of Object.keys(p)) {
      const v = p[k];
      const t = typeof v;
      if (t === 'number' && isFinite(v)) out[k] = v;
      else if (t === 'boolean') out[k] = v;
      else if (t === 'string' && v.length <= 32) out[k] = v;
    }
  }
  return out;
}

/** Append an event, returning a NEW capped log (oldest dropped past the cap). */
export function appendEvent(log: AnalyticsRecord[], e: AnalyticsEvent, t: number, p?: any, cap = ANALYTICS_CAP): AnalyticsRecord[] {
  if (!isAnalyticsEvent(e)) return Array.isArray(log) ? log : [];
  const rec: AnalyticsRecord = { e, t, p: sanitizeProps(p || {}) };
  const next = (Array.isArray(log) ? log : []).concat([rec]);
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Count events by name (for a quick funnel read / tests). */
export function eventCounts(log: AnalyticsRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of (log || [])) out[r.e] = (out[r.e] || 0) + 1;
  return out;
}
