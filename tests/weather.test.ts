import { describe, it, expect } from 'vitest';
import { WEATHER_TYPES, WEATHER_INFO, SEASON_WEATHER, pickWeather, weatherDuration } from '../src/data/weather.ts';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

describe('Weather system', () => {
  it('every season pool only contains known weather types', () => {
    for (const s of SEASONS) {
      expect(SEASON_WEATHER[s], s).toBeTruthy();
      for (const w of SEASON_WEATHER[s]) expect(WEATHER_TYPES).toContain(w);
    }
  });

  it('pickWeather always returns a valid type for the season', () => {
    for (const s of SEASONS) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
        const w = pickWeather(s, () => r);
        expect(WEATHER_TYPES).toContain(w);
        expect(SEASON_WEATHER[s]).toContain(w);
      }
    }
    // unknown season falls back gracefully
    expect(WEATHER_TYPES).toContain(pickWeather('monsoon', () => 0.5));
  });

  it('active weather (rain/fog) is shorter than calm spells (clear/overcast)', () => {
    const calm = weatherDuration('clear', () => 0);
    const active = weatherDuration('rain', () => 0.999);
    expect(calm).toBeGreaterThan(active);
    for (const t of WEATHER_TYPES) {
      expect(weatherDuration(t, () => 0.5)).toBeGreaterThan(0);
    }
  });

  it('rain and fog have player-facing toasts; clear/overcast are quiet', () => {
    expect(WEATHER_INFO.rain.toast).toBeTruthy();
    expect(WEATHER_INFO.fog.toast).toBeTruthy();
    expect(WEATHER_INFO.clear.toast).toBeUndefined();
    expect(WEATHER_INFO.overcast.toast).toBeUndefined();
  });

  it('winter leans on overcast/fog (snow is the particle system, not weather)', () => {
    expect(SEASON_WEATHER.winter).not.toContain('rain');
    expect(SEASON_WEATHER.winter.filter(w => w === 'fog').length).toBeGreaterThan(0);
  });
});
