// @ts-nocheck
// Dialogue system v2 — situational NPC speech. Villagers still have their own
// personal quips (data/villagers.ts), but now they also draw on shared lines that
// fit the moment: the time of day, the weather and the season. Pure/testable — the
// caller passes a context object and an rng, so no game import is needed here.

export const TIME_LINES: Record<string, string[]> = {
  morning: [
    "Morning! Lovely start to the day.",
    "Up with the larks, eh?",
    "Off to work — no rest for the busy.",
    "Kettle's just gone on if you fancy a brew.",
  ],
  afternoon: [
    "Grand afternoon, this.",
    "Busy old day, isn't it?",
    "Afternoon! Keeping well?",
    "Just stretching my legs before the next job.",
  ],
  evening: [
    "Evening's drawing in.",
    "Long day. Nearly done, mind.",
    "Fancy a pint at the Rose & Pallet later?",
    "Time I was thinking about heading home.",
  ],
  night: [
    "Bit late to be out, isn't it?",
    "Couldn't sleep — just getting some air.",
    "Quiet at this hour. I like it.",
    "Mind how you go in the dark.",
  ],
};

export const WEATHER_LINES: Record<string, string[]> = {
  rain: [
    "Should've brought a brolly.",
    "This rain's set in for the day.",
    "Proper wet out, isn't it?",
  ],
  fog: [
    "Can barely see the harbour in this fog.",
    "Mind how you go — thick out there.",
    "Fog's rolled right in off the sea.",
  ],
  overcast: [
    "Grey old sky today.",
    "Looks like it might turn later.",
    "Dry, at least. For now.",
  ],
  clear: [
    "Not a cloud in the sky!",
    "Gorgeous day, isn't it?",
    "Sun's out — makes all the difference.",
  ],
  snow: [
    "Brr — proper chilly today!",
    "First snow of the year, look at that.",
    "Wrap up warm out there.",
  ],
};

export const SEASON_LINES: Record<string, string[]> = {
  spring: [
    "Blossom's coming out lovely.",
    "Everything's waking up again.",
    "Lambs in the top field already.",
  ],
  summer: [
    "Warm one today!",
    "Perfect weather for the village fete.",
    "Long evenings — I do love summer.",
  ],
  autumn: [
    "Leaves are turning early this year.",
    "Harvest's in full swing.",
    "Bit of a nip in the air now, isn't there?",
  ],
  winter: [
    "Cold enough for you?",
    "Dark by four these days.",
    "Nothing beats a fire this time of year.",
  ],
};

// Map a 0–24 hour to a part of the day.
export function timeOfDay(hour: number): string {
  if (hour < 11) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

export interface DialogueContext { timeOfDay: string; weather: string; season: string; }

// The pool of situational lines that fit the current context.
export function contextLines(ctx: DialogueContext): string[] {
  const out: string[] = [];
  if (TIME_LINES[ctx.timeOfDay])   out.push(...TIME_LINES[ctx.timeOfDay]);
  if (WEATHER_LINES[ctx.weather])  out.push(...WEATHER_LINES[ctx.weather]);
  if (SEASON_LINES[ctx.season])    out.push(...SEASON_LINES[ctx.season]);
  return out;
}

// Choose what a villager says right now: mostly their own personal quip (keeps
// their character), sometimes a situational line that fits the moment.
// `rng` returns [0,1); deterministic given a seeded rng, so it's unit-testable.
export function pickLine(personalQuip: string, ctx: DialogueContext, rng: () => number, contextChance = 0.4): string {
  const pool = contextLines(ctx);
  if (pool.length && rng() < contextChance) {
    return pool[Math.floor(rng() * pool.length)] || personalQuip;
  }
  return personalQuip;
}
