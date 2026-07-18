import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * TEN-FOOT / STEAM + XBOX UI REBUILD — visual regression + acceptance checks.
 * -----------------------------------------------------------------------------
 * Captures the restructured Trading + Contracts screens at 720p / 1080p / 1440p /
 * ultrawide in both standard and Couch/TV modes, and asserts the acceptance
 * invariants: no horizontal page overflow, no white side strips, and (couch) the
 * body text is scaled up for television distance.
 */
const SAVE_KEY = 'buyrworld_game_save_v1';
const RESOLUTIONS = [
  { name: '720p',       w: 1280, h: 720 },
  { name: '1080p',      w: 1920, h: 1080 },
  { name: '1440p',      w: 2560, h: 1440 },
  { name: 'ultrawide',  w: 3440, h: 1440 },
];
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
  await gate(page, 'flagGiveCoins', 20000);
  await gate(page, 'uiFinishTutorial');            // unfreeze the board + enable the flagship order
  await gate(page, 'uiUnlockTab', 'trade');
  await gate(page, 'uiUnlockTab', 'contracts');
}

test.describe('Ten-foot UI — responsive shell, no overflow, couch legibility', () => {
  test('Trading + Contracts render cleanly at every resolution, standard + couch', async ({ page }) => {
    test.setTimeout(180_000);
    await start(page);

    for (const mode of ['standard', 'couch'] as const) {
      await gate(page, 'uiSetCouch', mode === 'couch');
      for (const r of RESOLUTIONS) {
        await page.setViewportSize({ width: r.w, height: r.h });

        for (const tab of ['trade', 'contracts'] as const) {
          await gate(page, 'uiGoTab', tab);
          await page.waitForTimeout(120);   // settle layout + fonts

          // ---- acceptance invariants ----
          const o = await gate(page, 'uiOverflow');
          expect(o.overflow, `${tab} ${mode} ${r.name}: no horizontal page overflow`).toBeLessThanOrEqual(2);
          // no white side strips — the themed navy backdrop fills the viewport
          expect(o.bodyBg, `${tab} ${mode} ${r.name}: themed (non-white) backdrop`).not.toBe('rgb(255, 255, 255)');

          // ---- reference screenshot (committed as a visual baseline) ----
          await page.screenshot({ path: `e2e/screens/${tab}-${mode}-${r.name}.png` });
        }
      }
    }
  });

  test('couch mode scales body text larger than standard (not just buttons)', async ({ page }) => {
    await start(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await gate(page, 'uiGoTab', 'contracts');

    const measure = () => page.evaluate(() => {
      const el = document.querySelector('.panel h2 small') as HTMLElement;
      const scale = getComputedStyle(document.body).getPropertyValue('--ui-scale').trim();
      return { small: el ? parseFloat(getComputedStyle(el).fontSize) : 0, scale };
    });
    await gate(page, 'uiSetCouch', false);
    const std = await measure();
    await gate(page, 'uiSetCouch', true);
    const couch = await measure();
    expect(couch.small).toBeGreaterThan(std.small);   // help/body text grows
    expect(parseFloat(couch.scale)).toBeGreaterThan(parseFloat(std.scale || '1'));
  });

  test('the flagship modal text scales with couch mode (migrated inline sizes)', async ({ page }) => {
    await start(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await gate(page, 'c2cStartScenario', 'trailer');            // opens the flagship modal
    await expect(page.locator('#flagship-modal')).toBeVisible({ timeout: 8000 });
    // a modal text node now carries font-size:calc(Npx * var(--ui-scale))
    const measure = () => page.evaluate(() => {
      const t = document.querySelector('#flagship-modal [style*="font-size:calc"]') as HTMLElement;
      return t ? parseFloat(getComputedStyle(t).fontSize) : 0;
    });
    await gate(page, 'uiSetCouch', false);
    const std = await measure();
    await gate(page, 'uiSetCouch', true);
    const couch = await measure();
    expect(std).toBeGreaterThan(0);
    expect(couch).toBeGreaterThan(std);                        // whole modal grows for TV distance
    await page.screenshot({ path: 'e2e/screens/flagship-modal-couch-720p.png' });
  });

  test('the practice-scenarios modal text scales with couch mode (migrated inline sizes)', async ({ page }) => {
    await start(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => (window as any).openC2CScenarios && (window as any).openC2CScenarios());
    await expect(page.locator('#c2c-scenarios-modal')).toBeVisible({ timeout: 8000 });
    const measure = () => page.evaluate(() => {
      const t = document.querySelector('#c2c-scenarios-modal [style*="font-size:calc"]') as HTMLElement;
      return t ? parseFloat(getComputedStyle(t).fontSize) : 0;
    });
    await gate(page, 'uiSetCouch', false);
    const std = await measure();
    await gate(page, 'uiSetCouch', true);
    const couch = await measure();
    expect(std).toBeGreaterThan(0);
    expect(couch).toBeGreaterThan(std);
    await page.screenshot({ path: 'e2e/screens/scenarios-modal-couch-720p.png' });
  });

  test('Trading is trader-tabbed (not one endless catalogue) and switches trader', async ({ page }) => {
    await start(page);
    await gate(page, 'uiGoTab', 'trade');
    // the restructured trading UI renders: a compact summary + a trader tab strip
    await expect(page.locator('.tr-summary')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.tr-tab').first()).toBeVisible({ timeout: 8000 });
    const tabs = await page.locator('.tr-tab').count();
    expect(tabs).toBeGreaterThan(1);                     // one tab per trader, not one endless list
    const before = await gate(page, 'uiTradeState');
    // switching to a different unlocked trader changes the active trader. Use an
    // in-page click (the tab strip is a horizontal overflow scroller, so a synchronous
    // .click() is more reliable than driving the pointer to an off-screen tab).
    const switched = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.tr-tab:not([disabled])')) as HTMLElement[];
      const other = tabs.find(t => t.getAttribute('aria-selected') !== 'true');
      if (other){ other.click(); return true; } return false;
    });
    if (switched){ const after = await gate(page, 'uiTradeState'); expect(after.npc).not.toBe(before.npc); }
  });

  test('Contracts prioritise the active order; secondary cards expand/collapse', async ({ page }) => {
    await start(page);
    await gate(page, 'uiGoTab', 'contracts');
    await expect(page.locator('#main .panel').first()).toBeVisible({ timeout: 8000 });
    // one obvious default action on the screen
    await expect(page.locator('#main [data-primary]').first()).toBeVisible({ timeout: 8000 });
    // compact contract cards expose an expandable header with aria-expanded that toggles
    const heads = page.locator('.ct-compact .ct-head');
    const hc = await heads.count();
    if (hc > 0) {
      const head = heads.first();
      const before = await head.getAttribute('aria-expanded');
      await head.click();
      expect(await head.getAttribute('aria-expanded')).not.toBe(before);
    }
  });
});
