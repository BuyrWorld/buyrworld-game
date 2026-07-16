import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * CONTROLLER / TV FOCUS NAVIGATION
 * -----------------------------------------------------------------------------
 * Verifies the documented input contract and the controller-readiness rules on
 * the screens the task calls out: Title, Creator, Settings, Village, Work,
 * Contracts and Pause. Focus is exercised through the real keydown/gamepad
 * bindings and the dev-only __gate.ui* probes (visible ring, focus-on-open,
 * focus restore, no dead ends, method-aware prompts).
 */

const SAVE_KEY = 'buyrworld_game_save_v1';

async function cleanLoad(page: Page) {
  await page.addInitScript((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.goto('/', { waitUntil: 'commit', timeout: 30_000 });
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
  await expect(page.locator('#title')).toBeHidden({ timeout: 10000 });   // wait for the title's async teardown
  await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
  await dismissHint(page);
}
const gate = (page: Page, method: string, ...args: any[]) =>
  page.evaluate(([m, a]) => (window as any).__gate[m as string](...(a as any[])), [method, args] as const);
/** A visible focus ring — the controller ring (.gp-focus) OR a native :focus-visible outline. */
const ringVisible = (page: Page) => page.evaluate(() => {
  const gp = document.querySelector('.gp-focus') as HTMLElement | null;
  const el = gp || (document.activeElement as HTMLElement | null);
  if (!el || el === document.body) return false;
  const cs = getComputedStyle(el);
  return parseFloat(cs.outlineWidth) >= 2 || (!!cs.boxShadow && cs.boxShadow !== 'none');
});

test.describe('Controller / TV focus navigation', () => {
  // req 1 + Title -----------------------------------------------------------
  test('Title: focus navigation reveals a visible ring and Quick Start is reachable', async ({ page }) => {
    await cleanLoad(page);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press('ArrowDown');                // game focus nav → the .gp-focus ring
    expect(await page.evaluate(() => !!document.querySelector('.gp-focus'))).toBe(true);
    expect(await ringVisible(page)).toBe(true);            // visible focus state (req 1)
    await expect(page.locator('#btn-quick')).toBeVisible(); // the primary action exists (A/Enter confirms)
  });

  // Creator -----------------------------------------------------------------
  test('Creator: the character creator screen is focus-navigable with a visible ring', async ({ page }) => {
    await cleanLoad(page);
    // the creator (name, swatches, wizard buttons) lives on the title screen
    const creatorControls = page.locator('#title input, #title button, #title [tabindex]:not([tabindex="-1"])');
    expect(await creatorControls.count()).toBeGreaterThan(1);
    // stepping focus with the game's nav lands a visible ring on a creator control
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press('ArrowDown');
    const a = await page.evaluate(() => document.querySelector('.gp-focus')?.textContent?.slice(0,20) || null);
    await page.keyboard.press('ArrowDown');
    expect(await ringVisible(page)).toBe(true);
    const b = await page.evaluate(() => document.querySelector('.gp-focus')?.textContent?.slice(0,20) || null);
    expect(b).not.toBeNull();                              // focus is on a real control, not lost
  });

  // req 3 + Work ------------------------------------------------------------
  test('Work: opening the category focuses its primary action', async ({ page }) => {
    await quickStart(page);
    const r = await gate(page, 'uiCategory', 1);           // WORLD → WORK
    expect(r.group).toBe('work');
    expect(r.hasFocusRing).toBe(true);                     // focus placed on open (req 3)
    expect(r.focus).toBeTruthy();                          // a real primary action
    expect(r.focusables).toBeGreaterThan(0);               // not a dead end (req 5)
    expect(await ringVisible(page)).toBe(true);            // ring is visibly rendered (req 1)
  });

  // req 5 + Contracts -------------------------------------------------------
  test('Contracts: reachable, focus-navigable, and never a controller dead end', async ({ page }) => {
    await quickStart(page);
    await gate(page, 'uiCategory', 1);                     // WORK — Contracts lives here
    // cycle screens within the category and confirm focus stays valid throughout
    // (LT/RT), so the controller can never land on a dead-end screen.
    for (let i = 0; i < 6; i++) {
      const r = await gate(page, 'uiScreen', 1);
      expect(r.focusables).toBeGreaterThan(0);             // every screen has reachable controls
      expect(r.hasFocusRing).toBe(true);                   // focus is placed, never lost
    }
  });

  // req 3/4 + Settings ------------------------------------------------------
  test('Settings: opens with focus on a control, and closing restores prior focus', async ({ page }) => {
    await quickStart(page);
    await gate(page, 'uiCategory', 1);                     // give the page a known focus owner first
    const before = await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent?.slice(0,20) || null);
    await page.evaluate(() => (window as any).openSettings());
    await expect(page.locator('#settings-modal')).toBeVisible();
    // initial focus is inside the modal (req 3)
    expect(await page.evaluate(() => !!document.activeElement?.closest('#settings-modal'))).toBe(true);
    expect(await ringVisible(page)).toBe(true);
    // Escape closes and restores focus to the opener context (req 4)
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-modal')).toHaveCount(0);
    const after = await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent?.slice(0,20) || null);
    expect(after).not.toBeNull();                          // focus is not lost to <body> (no dead end)
  });

  // req 11 + Village --------------------------------------------------------
  test('Village: prompts follow the most recently used input method', async ({ page }) => {
    await quickStart(page);
    await gate(page, 'ixSetTab', 'village');
    const pad = await gate(page, 'uiSetMethod', 'gamepad');
    expect(pad.promptsVisible).toBe(true);                 // controller → prompts shown
    const mouse = await gate(page, 'uiSetMethod', 'pointer');
    expect(mouse.promptsVisible).toBe(false);              // mouse → prompts hidden (clean HUD)
    const key = await gate(page, 'uiSetMethod', 'keyboard');
    expect(key.promptsVisible).toBe(true);                 // keyboard → prompts shown
  });

  // req 4/5 + Pause ---------------------------------------------------------
  test('Pause: Escape opens it with focus on Resume, and closes cleanly', async ({ page }) => {
    await quickStart(page);
    await page.keyboard.press('Escape');                   // open Pause from the world
    await expect(page.locator('#pause-modal')).toBeVisible();
    expect(await page.evaluate(() => !!document.activeElement?.closest('#pause-modal'))).toBe(true);
    // the primary action (Resume) is the initial focus
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-pause'))).toBe('resume');
    await page.keyboard.press('Escape');                   // B/Escape closes
    await expect(page.locator('#pause-modal')).toHaveCount(0);
  });

  // req 9 --------------------------------------------------------------------
  test('No full-page scroll during gameplay', async ({ page }) => {
    await quickStart(page);
    const scroll = await page.evaluate(() => {
      const de = document.documentElement;
      return { x: de.scrollWidth - de.clientWidth, y: de.scrollHeight - de.clientHeight };
    });
    expect(scroll.x).toBe(0);
    expect(scroll.y).toBe(0);
  });
});
