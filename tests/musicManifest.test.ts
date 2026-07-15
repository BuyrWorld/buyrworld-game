import { describe, it, expect } from 'vitest';
import {
  MUSIC_MANIFEST, SCENARIO_PRIORITY, scenarioRank, resolveScenario, enabledTracks,
  radioTracks, isRadioOnly, frostyPlaylist, frostySources, nightclubVenueMode, worldFlagOk,
  CHIPTUNE_MAP, chiptuneKeys, SOUNDTRACK_MODES, DEFAULT_SOUNDTRACK, VOLUME_STEPS, VOLUME_GAINS,
  DEFAULT_VOLUME, volumeGain,
} from '../src/data/musicManifest.ts';

describe('Music manifest — folder-authoritative categorisation', () => {
  it('every track has a stable id, Frosty artist, an mp3 source under music/frosty, and a real scenario', () => {
    const ids = new Set<string>();
    for (const t of MUSIC_MANIFEST) {
      expect(t.id).toBeTruthy(); expect(ids.has(t.id)).toBe(false); ids.add(t.id);
      expect(t.artist).toBe('Frosty');
      expect(t.source).toMatch(/^music\/frosty\/.+\.mp3$/);
      expect(['title','general','forest','holding','nightclub','frosty-radio']).toContain(t.scenario);
    }
  });
  it('each owner folder maps only to its own scenario (no cross-classification)', () => {
    const byScenario = (s: string) => MUSIC_MANIFEST.filter(t => t.scenario === s);
    expect(byScenario('title').every(t => /\/title\//.test(t.source))).toBe(true);
    expect(byScenario('general').every(t => /\/general-game\//.test(t.source))).toBe(true);
    expect(byScenario('forest').every(t => /\/forest\//.test(t.source))).toBe(true);
    expect(byScenario('holding').every(t => /\/holding-cell\//.test(t.source))).toBe(true);
    // radio tracks come from the frosty-exclusive folder, except "Life In Blackburn"
    // (also the title theme) which stays in title/ — files are never moved (req 10).
    expect(byScenario('frosty-radio').every(t => /\/frosty-exclusive\//.test(t.source) || t.id === 'radio-life-in-blackburn')).toBe(true);
    expect(byScenario('nightclub').every(t => /\/nightclub\//.test(t.source))).toBe(true);
  });
});

describe('Music manifest — Frosty Exclusive / radio', () => {
  it('every frosty-radio track is radioOnly and quest-gated — none free on a clean save (req 9b/9c)', () => {
    for (const t of MUSIC_MANIFEST) {
      if (t.scenario === 'frosty-radio') {
        expect(t.radioOnly).toBe(true);
        expect(t.unlockRequirement).toBeTruthy();          // each requires its configured Frosty quest
        expect(t.unlockAt).toBeGreaterThanOrEqual(1);      // NONE at unlockAt 0
      } else {
        expect(!!t.radioOnly).toBe(false);
      }
    }
    expect(radioTracks().length).toBeGreaterThan(0);
    expect(radioTracks().every(t => isRadioOnly(t.id))).toBe(true);
    expect(radioTracks().every(t => (t.unlockAt ?? 0) >= 1)).toBe(true);   // no exclusive available at 0
  });
  it('global Frosty playlists NEVER include radio-only tracks', () => {
    for (const s of ['title','general','forest','holding','nightclub'] as const) {
      expect(frostyPlaylist(s, { flags: { prisonExpansionBuilt: true, nightclubVenueMode: 'strip-club' } }).some(t => t.radioOnly)).toBe(false);
    }
    expect(frostyPlaylist('frosty-radio')).toEqual([]);   // radio is not a global playlist
  });
});

describe('Music manifest — nightclub venue separation & world-flag gating', () => {
  it('normal and strip tracks never cross playlists', () => {
    const normal = frostyPlaylist('nightclub', { venueMode: 'normal' });
    expect(normal.length).toBeGreaterThan(0);
    expect(normal.every(t => t.venueMode === 'normal')).toBe(true);
    const strip = frostyPlaylist('nightclub', { venueMode: 'strip-club', flags: { prisonExpansionBuilt: true } });
    expect(strip.every(t => t.venueMode === 'strip-club')).toBe(true);
    // no overlap
    expect(normal.some(n => strip.find(s => s.id === n.id))).toBe(false);
  });
  it('strip-club tracks require the world flag; the default venue is normal (not crime-driven)', () => {
    expect(nightclubVenueMode({})).toBe('normal');
    expect(nightclubVenueMode({ justice: { incidents: [{ level: 5 }] } } as any)).toBe('normal');  // crime does NOT flip it
    expect(nightclubVenueMode({ prisonExpansionBuilt: true, nightclubVenueMode: 'strip-club' })).toBe('strip-club');
    // requesting strip without the flag yields nothing
    expect(frostyPlaylist('nightclub', { venueMode: 'strip-club', flags: {} })).toEqual([]);
    expect(worldFlagOk('prisonExpansionBuilt', {})).toBe(false);
    expect(worldFlagOk(undefined, {})).toBe(true);
  });
});

describe('Music manifest — scenario priority', () => {
  it('orders Frosty radio > holding > nightclub > forest > title > general', () => {
    expect(SCENARIO_PRIORITY).toEqual(['frosty-radio', 'holding', 'nightclub', 'forest', 'title', 'general']);
    expect(resolveScenario(['general', 'forest'])).toBe('forest');
    expect(resolveScenario(['forest', 'nightclub', 'general'])).toBe('nightclub');
    expect(resolveScenario(['holding', 'nightclub', 'title'])).toBe('holding');
    expect(resolveScenario(['frosty-radio', 'holding'])).toBe('frosty-radio');
    expect(resolveScenario([])).toBe('general');
    expect(scenarioRank('frosty-radio')).toBeLessThan(scenarioRank('general'));
  });
});

describe('Music manifest — Classic Chiptune mirrors the scenario structure', () => {
  it('provides chiptune keys for every scenario including both nightclub venues', () => {
    for (const s of ['title','general','forest','holding'] as const) expect(chiptuneKeys(s).length).toBeGreaterThan(0);
    expect(chiptuneKeys('nightclub', 'normal').length).toBeGreaterThan(0);
    expect(chiptuneKeys('nightclub', 'strip-club').length).toBeGreaterThan(0);
    expect(CHIPTUNE_MAP['nightclub:normal']).not.toEqual(CHIPTUNE_MAP['nightclub:strip-club']);
  });
});

describe('Music manifest — modes, volume & defaults', () => {
  it('new saves default to Frosty Original and Low', () => {
    expect(SOUNDTRACK_MODES).toEqual(['frosty', 'chiptune']);
    expect(DEFAULT_SOUNDTRACK).toBe('frosty');
    expect(DEFAULT_VOLUME).toBe('low');
  });
  it('Off/Low/Medium/Loud are genuinely distinct and increasing', () => {
    expect(VOLUME_STEPS).toEqual(['off', 'low', 'med', 'loud']);
    expect(VOLUME_GAINS.off).toBe(0);
    expect(VOLUME_GAINS.low).toBeGreaterThan(0);
    expect(VOLUME_GAINS.low).toBeLessThan(VOLUME_GAINS.med);
    expect(VOLUME_GAINS.med).toBeLessThan(VOLUME_GAINS.loud);
    // clearly separated (not "all similar") — each step ≥ 2.5× the previous audible gain span
    expect(VOLUME_GAINS.med - VOLUME_GAINS.low).toBeGreaterThan(0.15);
    expect(volumeGain('nonsense')).toBe(VOLUME_GAINS.low);
  });
});
