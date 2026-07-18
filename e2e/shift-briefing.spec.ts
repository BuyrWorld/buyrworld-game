import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * RETURNING-PLAYER "BACK ON SHIFT" BRIEFING
 * -----------------------------------------------------------------------------
 * A concise, skippable briefing after a meaningful absence: recommended action
 * focused first, dismiss returns to play, reopenable from the Journal, and the
 * "don't show for short breaks" preference is respected.
 */
const SAVE_KEY = 'buyrworld_game_save_v1';
const gate = (page: Page, m: string, ...a: any[]) =>
  page.evaluate(([mm, aa]) => (window as any).__gate[mm as string](...(aa as any[])), [m, a] as const);
async function cleanLoad(page: Page) {
  let lastErr: unknown;
  for (let a = 0; a < 4; a++) {
    try {
      await page.goto('/', { waitUntil: 'commit', timeout: 60_000 });
      await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
      await page.reload({ waitUntil: 'commit', timeout: 45_000 });
      await expect(page.locator('#title')).toBeVisible({ timeout: 45_000 });
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
async function start(page: Page) {
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 20000 });
  const hint = page.locator('#play-hint-overlay');
  if (await hint.count()) { const b = hint.locator('button'); if (await b.count()) await b.first().click().catch(()=>{}); }
  await gate(page, 'uiFinishTutorial');
}
const openShift = (page: Page, reopen = false) => page.evaluate((r) => (window as any).openShiftBriefing(r), reopen);

test.describe('Back on Shift briefing', () => {
  test('a returning player sees the briefing with the recommended action focused', async ({ page }) => {
    await start(page);
    await gate(page, 'uiSetMethod', 'gamepad');           // controller player
    await gate(page, 'uiSetLastSeen', 3 * 3600 * 1000);   // returned after 3 hours
    const prev = await gate(page, 'uiShiftPreview');
    expect(prev.show).toBe(true);
    expect(prev.recommended).toBeTruthy();

    await openShift(page);
    await expect(page.locator('#shift-modal')).toBeVisible({ timeout: 8000 });
    // controller focus begins on the recommended action ([data-primary])
    const primary = page.locator('#shift-modal [data-primary]');
    await expect(primary).toBeVisible();
    await expect.poll(async () => (await gate(page, 'uiFocusRing')).has, { timeout: 4000 }).toBe(true);
    const ring = await gate(page, 'uiFocusRing');
    expect(ring.action).toBeTruthy();   // the ring is on a real recommended control

    // Dismiss returns the player to the world (no focus trap, never blocks play)
    await page.evaluate(() => (document.querySelector('#shift-modal [data-shift="dismiss"]') as HTMLElement)?.click());
    await expect(page.locator('#shift-modal')).toHaveCount(0);
    expect(await page.locator('#hud-coins').isVisible()).toBe(true);
  });

  test('reopenable from the Journal at any time', async ({ page }) => {
    await start(page);
    await gate(page, 'uiSetLastSeen', 60 * 1000);         // even with no meaningful absence…
    await gate(page, 'uiOpenObjectives');                 // open the Valley Journal
    await expect(page.locator('#journal-modal')).toBeVisible({ timeout: 8000 });
    // the Journal exposes a "Back on Shift" reopen control
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#journal-modal button')).find(b => /Back on Shift/i.test(b.textContent || '')) as HTMLElement;
      btn?.click();
    });
    await expect(page.locator('#shift-modal')).toBeVisible({ timeout: 8000 });   // shown on demand even though absence was tiny
  });

  test('"don\'t show for short breaks" is respected', async ({ page }) => {
    await start(page);
    // turn the preference on via the briefing itself
    await gate(page, 'uiSetLastSeen', 3 * 3600 * 1000);
    await openShift(page);
    await expect(page.locator('#shift-modal')).toBeVisible({ timeout: 8000 });
    await page.evaluate(() => (document.querySelector('#shift-modal [data-shift="skipshort"]') as HTMLElement)?.click());
    await expect(page.locator('#shift-modal')).toHaveCount(0);
    expect(await gate(page, 'uiShiftSkipShort')).toBe(true);

    // now a SHORT absence no longer auto-shows, but a long one still does
    await gate(page, 'uiSetLastSeen', 6 * 60 * 1000);     // 6 min = short
    expect((await gate(page, 'uiShiftPreview')).show).toBe(false);
    await gate(page, 'uiSetLastSeen', 4 * 3600 * 1000);   // 4 hr = long
    expect((await gate(page, 'uiShiftPreview')).show).toBe(true);
  });

  test('the briefing is never manipulative (no loss-aversion or streak language)', async ({ page }) => {
    await start(page);
    await gate(page, 'uiSetLastSeen', 5 * 3600 * 1000);
    await openShift(page);
    await expect(page.locator('#shift-modal')).toBeVisible({ timeout: 8000 });
    const txt = await page.locator('#shift-modal').innerText();
    expect(txt).not.toMatch(/penalty|you lost|don't lose|streak|failed you|hurry|last chance/i);
  });
});
