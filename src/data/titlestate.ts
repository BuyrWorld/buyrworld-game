// Milestone 4 — polished new-game experience. Pure, testable helpers for the
// title-screen state, safe name handling and Continue save-summary. The DOM title
// screen, settings panel and tick-gating live in main.ts and use these.

// The new-game tutorial's first objective is the deterministic 6 ore from M1 —
// never the old 5. (Single source so the welcome text can't drift.)
export const NEW_GAME_FIRST_ORE = 6;

// While the title screen is up, no world simulation runs.
export function simulationActive(titleUp: boolean): boolean { return !titleUp; }

// ---- Safe player-name handling -------------------------------------------
export const NAME_MAX = 16;
export interface NameResult { ok: boolean; name: string; error: string; }
// Trim, collapse whitespace, strip characters that could inject HTML/script, require
// at least one visible character, cap the length. Ordinary names pass unchanged.
export function cleanName(raw: string): NameResult {
  const stripped = String(raw == null ? '' : raw).replace(/[<>&"'`\\/]/g, '').replace(/\s+/g, ' ').trim();
  if (!stripped) return { ok: false, name: '', error: 'Please enter a name.' };
  return { ok: true, name: stripped.slice(0, NAME_MAX), error: '' };
}

// ---- Continue: save summary ----------------------------------------------
export interface SaveMeta { name?: string; totalLevel?: number; coins?: number; lastSeen?: number; legacy?: number; }
export interface SaveSummary { name: string; totalLevel: number; coins: number; date: string; chapter: string; }
// A one-line, player-facing summary for the Continue button. Null when there's no
// valid named save (so Continue is hidden rather than shown empty/disabled).
export function saveSummary(s: SaveMeta | null | undefined): SaveSummary | null {
  if (!s || !s.name) return null;
  return {
    name: s.name,
    totalLevel: Math.max(1, s.totalLevel || 0),
    coins: Math.max(0, Math.round(s.coins || 0)),
    date: s.lastSeen ? new Date(s.lastSeen).toLocaleDateString() : '',
    chapter: (s.legacy || 0) > 0 ? `Chapter ${(s.legacy || 0) + 1}` : '',
  };
}

// ---- Settings ------------------------------------------------------------
export const TEXT_SCALES = ['small', 'normal', 'large'] as const;
export type TextScale = typeof TEXT_SCALES[number];
export function textScaleValue(scale: string): number {
  return scale === 'small' ? 0.9 : scale === 'large' ? 1.15 : 1.0;
}
// Defaults for a NEW/unset save: Frosty Original soundtrack, everything at Low.
export const DEFAULT_SETTINGS = { music: true, vol: 'low', sfx: true, sfxVol: 'low', soundtrack: 'frosty', motion: true, textScale: 'normal' as TextScale, couch: false };
