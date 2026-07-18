import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * COHERENT HOUSE, FURNITURE & CLEANLINESS
 * -----------------------------------------------------------------------------
 * Acceptance: a new player can ACQUIRE and PLACE their first item through the
 * visual grid (no text-placement interface), and warehouse / storage / placed
 * furniture reconcile — including Finn's now-placeable homeware (the Table Lamp).
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
  await gate(page, 'flagGiveCoins', 5000);
  await gate(page, 'uiFinishTutorial');
  await gate(page, 'uiUnlockTab', 'myhome');
}

// Synchronous in-page click — the decor modal re-renders on each action, so driving
// the real pointer to a (possibly restyled) node is racy; a direct .click() is stable.
async function tap(page: Page, sel: string) {
  return page.evaluate((s) => { const el = document.querySelector(s) as HTMLElement; if (el) { el.click(); return true; } return false; }, sel);
}
// Place the currently-selected piece: click an empty floor square, then Confirm.
async function placeAt(page: Page, gx: number, gy: number) {
  await tap(page, `#decor-modal [data-decor-cell="${gx},${gy}"]`);
  await tap(page, '#decor-modal [data-decor-confirm]');
}

test.describe('House, furniture & cleanliness', () => {
  test('a new player owns a free starter piece and can place it via the visual grid', async ({ page }) => {
    await start(page);
    const s0 = await gate(page, 'uiCottageState');
    expect(s0.starter, 'starter flag set').toBe(true);
    expect(s0.owned.furn_chair, 'free starter chair granted').toBeGreaterThanOrEqual(1);

    await gate(page, 'uiOpenDecorate');
    await expect(page.locator('#decor-modal')).toBeVisible({ timeout: 8000 });
    // pick the starter from storage (a visual button, not a text field) and place it
    await tap(page, '#decor-modal [data-decor-item="furn_chair"]');
    await placeAt(page, 2, 2);
    const s1 = await gate(page, 'uiCottageState');
    expect(s1.placed.some((p: any) => p.id === 'furn_chair'), 'chair placed on the grid').toBe(true);
    expect(s1.owned.furn_chair || 0, 'starter consumed from storage').toBe((s0.owned.furn_chair || 1) - 1);
  });

  test("Finn's Table Lamp is placeable and reconciles with the warehouse", async ({ page }) => {
    await start(page);
    await gate(page, 'uiGiveItem', 'lamp', 2);           // buy 2 lamps from Finn (into the warehouse)
    const before = await gate(page, 'uiCottageState');
    expect(before.lamp).toBe(2);

    await gate(page, 'uiOpenDecorate');
    await expect(page.locator('#decor-modal')).toBeVisible({ timeout: 8000 });
    // the lamp appears in the decorate palette (from the warehouse) — proof it's placeable
    await expect(page.locator('#decor-modal [data-decor-item="lamp"]')).toBeVisible();
    await tap(page, '#decor-modal [data-decor-item="lamp"]');
    await placeAt(page, 6, 1);
    const after = await gate(page, 'uiCottageState');
    expect(after.placed.some((p: any) => p.id === 'lamp'), 'lamp placed').toBe(true);
    expect(after.lamp, 'one lamp left the warehouse').toBe(1);        // reconciles: 2 → 1 placed
  });

  test('carried-rubbish text is never shown at zero', async ({ page }) => {
    await start(page);
    await gate(page, 'uiOpenDecorate');
    await expect(page.locator('#decor-modal')).toBeVisible({ timeout: 8000 });
    const s = await gate(page, 'uiCottageState');
    const txt = await page.locator('#decor-modal').innerText();
    if ((s.carried || 0) === 0) {
      expect(txt).not.toMatch(/Carrying 0 rubbish/);
      expect(txt).toContain('Hands empty');
    }
  });
});
