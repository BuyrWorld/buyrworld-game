// @ts-nocheck
// Weather — a light ambient layer over the village that rotates through
// season-appropriate conditions. Pure/testable selection; rendering + the
// separate seasonal particles (snow/leaves/blossom) live in main.ts.

export const WEATHER_TYPES = ['clear', 'overcast', 'rain', 'fog'] as const;

export const WEATHER_INFO: Record<string, { ic: string; n: string; toast?: string }> = {
  clear:    { ic:'☀️', n:'clear' },
  overcast: { ic:'☁️', n:'overcast' },
  rain:     { ic:'🌧️', n:'rain',  toast:'Rain patters across the valley.' },
  fog:      { ic:'🌫️', n:'fog',   toast:'A thick fog rolls in over Featherstone.' },
};

// Weighted pools per season (fair, but weighted by repetition). Snow is handled
// by the seasonal particle system, so winter leans on overcast/fog here.
export const SEASON_WEATHER: Record<string, string[]> = {
  spring: ['clear', 'clear', 'overcast', 'rain', 'rain'],
  summer: ['clear', 'clear', 'clear', 'overcast', 'fog'],
  autumn: ['clear', 'overcast', 'overcast', 'rain', 'fog'],
  winter: ['clear', 'overcast', 'overcast', 'fog', 'fog'],
};

export function pickWeather(season: string, rng: () => number = Math.random): string {
  const pool = SEASON_WEATHER[season] || SEASON_WEATHER.spring;
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

// Calm spells (clear/overcast) last longer than active weather (rain/fog). ms.
export function weatherDuration(type: string, rng: () => number = Math.random): number {
  const [lo, hi] = (type === 'clear' || type === 'overcast') ? [12, 18] : [4, 9];
  return (lo + rng() * (hi - lo)) * 60 * 1000;
}
