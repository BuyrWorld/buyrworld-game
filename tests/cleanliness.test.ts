import { describe, it, expect } from 'vitest';
import {
  CLEAN_BANDS, cleanBand, START_CLEAN, ACTIVITY_DECLINE, activityDecline, applyActivity,
  OFFLINE_DECLINE_CAP, cappedOfflineDecline, MESS_KINDS, targetMessCount, messKindsFor, MAX_MESS,
  cleanGain, BIN_CAPACITY, binLevel, binHasRoom, isCollectionDay, daysUntilCollection,
  SHINE_MS, shineRemaining, isShiny, comfortScore, CLEAN_GOALS, cleanGoalById,
} from '../src/data/cleanliness.ts';

describe('Cleanliness — bands & start', () => {
  it('a new cottage starts lived-in-to-tidy, not perfect or dirty', () => {
    expect(START_CLEAN).toBeGreaterThanOrEqual(80);
    expect(START_CLEAN).toBeLessThan(95);
    expect(cleanBand(95).id).toBe('sparkling');
    expect(cleanBand(75).id).toBe('tidy');
    expect(cleanBand(50).id).toBe('lived_in');
    expect(cleanBand(30).id).toBe('messy');
    expect(cleanBand(5).id).toBe('filthy');
  });
});

describe('Cleanliness — declines through activity, not idle waiting', () => {
  it('household activities each cost a small amount', () => {
    expect(activityDecline('cook')).toBeGreaterThan(0);
    expect(applyActivity(85, 'cook')).toBe(85 - ACTIVITY_DECLINE.cook);
    expect(applyActivity(1, 'party')).toBe(0);          // clamps at 0
    expect(activityDecline('nonsense')).toBe(0);        // unknown activity = no mess
  });
  it('offline decline is tiny and hard-capped', () => {
    expect(cappedOfflineDecline(2)).toBeLessThanOrEqual(OFFLINE_DECLINE_CAP);
    expect(cappedOfflineDecline(9999)).toBe(OFFLINE_DECLINE_CAP);
    expect(cappedOfflineDecline(0)).toBe(0);
  });
});

describe('Cleanliness — mess thresholds', () => {
  it('tidy homes have no mess; messier homes have more, capped', () => {
    expect(targetMessCount(95)).toBe(0);
    expect(targetMessCount(50)).toBe(1);
    expect(targetMessCount(30)).toBe(3);
    expect(targetMessCount(5)).toBe(MAX_MESS);
    expect(targetMessCount(5)).toBeLessThanOrEqual(MAX_MESS);   // never unusable
  });
  it('mess kinds escalate in severity as it gets dirtier', () => {
    expect(messKindsFor(95)).toEqual([]);
    const filthy = messKindsFor(5).map(id => MESS_KINDS.find(m => m.id === id)!.tier);
    expect(Math.max(...filthy)).toBe(3);
    const livedIn = messKindsFor(50).map(id => MESS_KINDS.find(m => m.id === id)!.tier);
    expect(Math.max(...livedIn)).toBe(1);
  });
});

describe('Cleanliness — cleaning actions', () => {
  it('a full clean beats tidying beats a single pickup, and upgrades help', () => {
    expect(cleanGain('pickup')).toBeLessThan(cleanGain('tidy'));
    expect(cleanGain('tidy')).toBeLessThan(cleanGain('full'));
    expect(cleanGain('tidy', 2)).toBeGreaterThan(cleanGain('tidy', 0));
    expect(cleanGain('nonsense')).toBe(0);
  });
});

describe('Cleanliness — bin & weekly collection', () => {
  it('bin fills to a capacity and reports its level', () => {
    expect(binLevel(0)).toBe('empty');
    expect(binLevel(3)).toBe('partial');
    expect(binLevel(BIN_CAPACITY)).toBe('full');
    expect(binHasRoom(BIN_CAPACITY)).toBe(false);
    expect(binHasRoom(BIN_CAPACITY - 1)).toBe(true);
  });
  it('collection is one day a week and countdown is 0..6', () => {
    let count = 0;
    for (let d = 0; d < 7; d++) if (isCollectionDay(d)) count++;
    expect(count).toBe(1);
    expect(daysUntilCollection(0)).toBeGreaterThanOrEqual(0);
    expect(daysUntilCollection(0)).toBeLessThan(7);
  });
});

describe('Cleanliness — furniture shine', () => {
  it('newly placed furniture shines for a while then settles', () => {
    const now = 1_000_000;
    expect(isShiny(now, now)).toBe(true);
    expect(isShiny(now, now + SHINE_MS + 1)).toBe(false);
    expect(shineRemaining(now, now + SHINE_MS / 2)).toBeGreaterThan(0);
    expect(isShiny(0, now)).toBe(false);   // never placed
  });
});

describe('Cleanliness — comfort score (rewards balance, no cramming)', () => {
  it('cleanliness and furniture raise comfort, but overcrowding lowers it', () => {
    const roomy = comfortScore({ cleanliness: 90, furnitureCount: 5, variety: 4, homeTier: 2, totalCells: 32 });
    const crammed = comfortScore({ cleanliness: 90, furnitureCount: 30, variety: 4, homeTier: 2, totalCells: 32 });
    expect(roomy).toBeGreaterThan(crammed);            // filling every square is NOT optimal
    const dirty = comfortScore({ cleanliness: 10, furnitureCount: 5, variety: 4, homeTier: 2, totalCells: 32 });
    expect(roomy).toBeGreaterThan(dirty);
  });
});

describe('Cleanliness — first-time goals (one-off)', () => {
  it('has the named goals with modest one-off rewards', () => {
    for (const id of ['first_tidy', 'bin_day', 'house_proud', 'perfect_host', 'spring_clean']) {
      const g = cleanGoalById(id);
      expect(g).toBeTruthy();
      expect(g!.reward).toBeGreaterThan(0);
      expect(g!.reward).toBeLessThanOrEqual(150);   // modest, not a coin faucet
    }
    expect(CLEAN_GOALS.length).toBe(5);
  });
});
