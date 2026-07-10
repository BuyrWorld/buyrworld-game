import { describe, it, expect } from 'vitest';
import {
  STORY, chapterComplete, chapterProgress, currentChapterIndex, currentChapter, isStoryComplete,
} from '../src/data/story.ts';

describe("The Founder's Trail — data", () => {
  it('every chapter is well-formed', () => {
    for (const c of STORY) {
      expect(c.id && c.ic && c.title && c.story && c.objText).toBeTruthy();
      expect(c.metric).toBeTruthy();
      expect(c.target).toBeGreaterThan(0);
      expect(c.reward.coins).toBeGreaterThan(0);
    }
  });
  it('chapter ids are unique and the finale grants a title', () => {
    expect(new Set(STORY.map(c => c.id)).size).toBe(STORY.length);
    expect(STORY[STORY.length - 1].reward.title).toBeTruthy();
  });
});

describe("The Founder's Trail — progression", () => {
  it('a chapter completes when its metric hits target', () => {
    const forge = STORY.find(c => c.id === 'forge')!;   // goods >= 20
    expect(chapterComplete(forge, { goods: 19 })).toBe(false);
    expect(chapterComplete(forge, { goods: 20 })).toBe(true);
    expect(chapterComplete(forge, {})).toBe(false);
  });
  it('chapterProgress clamps and reports pct', () => {
    const forge = STORY.find(c => c.id === 'forge')!;
    expect(chapterProgress(forge, { goods: 0 })).toEqual({ cur: 0, max: 20, pct: 0 });
    expect(chapterProgress(forge, { goods: 10 })).toEqual({ cur: 10, max: 20, pct: 50 });
    expect(chapterProgress(forge, { goods: 99 })).toEqual({ cur: 20, max: 20, pct: 100 });
  });
  it('current chapter walks the arc, then null and complete', () => {
    expect(currentChapterIndex(0)).toBe(0);
    expect(currentChapter(0)!.id).toBe(STORY[0].id);
    expect(currentChapter(2)!.id).toBe(STORY[2].id);
    expect(currentChapter(STORY.length)).toBeNull();
    expect(isStoryComplete(STORY.length)).toBe(true);
    expect(isStoryComplete(0)).toBe(false);
  });
});
