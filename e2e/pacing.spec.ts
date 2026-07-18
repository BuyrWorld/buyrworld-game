import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * FIRST-SESSION NOTIFICATION & UNLOCK PACING
 * -----------------------------------------------------------------------------
 * Verifies that while Frosty's tutorial runs, nothing competes with it — no
 * festival toast, no radio unlock, no ambient customer contract, no notice-board
 * quests — and that unrelated rewards (awards, journal) are DEFERRED (still
 * logged), then surfaced calmly afterwards: one summary, a "Choose Your Next
 * Step" screen with a recommendation, and staged unlock cards — never more than
 * one reward modal at a time. Driven through the real functions via __gate.
 */

const SAVE_KEY = 'buyrworld_game_save_v1';

async function cleanLoad(page: Page) {
  await page.addInitScript((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.goto('/?pres=off', { waitUntil: 'commit', timeout: 30_000 });
      await expect(page.locator('#title')).toBeVisible({ timeout: 30_000 });
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
async function dismissHint(page: Page) {
  const hint = page.locator('#play-hint-overlay');
  if (await hint.count()) { const b = hint.locator('button'); if (await b.count()) await b.first().click().catch(()=>{}); await hint.waitFor({ state:'detached', timeout:5000 }).catch(()=>{}); }
}
async function quickStart(page: Page) {
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#title')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
  await dismissHint(page);
}
const gate = (page: Page, method: string, ...args: any[]) =>
  page.evaluate(([m, a]) => (window as any).__gate[m as string](...(a as any[])), [method, args] as const);

test.describe('First-session pacing', () => {
  // req 1/10 -----------------------------------------------------------------
  test('the whole tutorial runs with NO festival, radio, ambient-contract or notice interruptions', async ({ page }) => {
    await quickStart(page);
    const before = await gate(page, 'pacing');
    expect(before.tutActive).toBe(true);
    expect(before.logCollapsed).toBe(true);              // req 3 — log starts minimised

    // let the real tick loop run for a while WHILE the tutorial is still active —
    // this is when festival/delivery/notice/radio spawners would normally fire.
    await page.waitForTimeout(1800);
    const during = await gate(page, 'pacing');
    expect(during.tutActive).toBe(true);                 // still mid-tutorial
    expect(during.festivalToastFired).toBe(false);       // req 1/10 — nothing competed
    expect(during.deliveryReq).toBe(false);
    expect(during.noticeQuests).toBe(0);
    expect(during.radioAnnounced).toBe(0);

    // now complete the tutorial — awards earned along the way were DEFERRED, not
    // shown as interruptions, and are ready to combine into the summary.
    await gate(page, 'runChain');
    const p = await gate(page, 'pacing');
    expect(p.deferredCount).toBeGreaterThan(0);
    expect(p.deferredCategories).toContain('award');
  });

  // req 2/9 ------------------------------------------------------------------
  test('after the tutorial: one summary, then Next-Step, then unlock cards — never two modals at once', async ({ page }) => {
    await quickStart(page);
    await gate(page, 'runChain');
    // the completion summary is the ONLY modal up
    let p = await gate(page, 'pacing');
    expect(p.summaryOpen).toBe(true);
    expect(p.modalCount).toBe(1);

    // Continue → Choose Your Next Step (still exactly one modal, req 9)
    p = await gate(page, 'pacingClickSummaryContinue');
    expect(p.nextStepOpen).toBe(true);
    expect(p.summaryOpen).toBe(false);
    expect(p.modalCount).toBe(1);
    // a path is recommended from stock/progression (req 5)
    const rec = await gate(page, 'pacingRecommend');
    expect(['production', 'contract', 'explore']).toContain(rec);

    // choose a path → it opens ONLY its destination (authoritative, req 4): the
    // choice no longer chains the unlock tour, so nothing else pops up over it.
    p = await gate(page, 'pacingChooseStep', 'contract');
    expect(p.nextStepOpen).toBe(false);
    expect(p.unlockCardOpen).toBe(false);               // NOT chained anymore
    expect(p.modalCount).toBe(0);                        // no competing modal

    // The staged unlock tour still exists — decoupled, surfaced at a later beat.
    // It introduces a SMALL group one card at a time, then stops (never a cascade).
    p = await gate(page, 'pacingStartUnlockTour');
    expect(p.unlockCardOpen).toBe(true);
    expect(p.modalCount).toBe(1);
    p = await gate(page, 'pacingUnlockLater');
    expect(p.modalCount).toBeLessThanOrEqual(1);
    expect(p.unlockShown.length).toBeGreaterThanOrEqual(1);
    p = await gate(page, 'pacingUnlockLater');
    expect(p.modalCount).toBe(0);                        // group finished — no cascade of every icon
    expect(p.unlockShown.length).toBeGreaterThanOrEqual(2);
  });

  // req 8 --------------------------------------------------------------------
  test('deferred notices remain reviewable in the activity log', async ({ page }) => {
    await quickStart(page);
    await gate(page, 'runChain');
    // the log holds the award lines even though they never interrupted
    const logHasAward = await page.evaluate(() => {
      const log = document.getElementById('log');
      return !!(log && /Award unlocked/i.test(log.textContent || ''));
    });
    expect(logHasAward).toBe(true);
  });
});
