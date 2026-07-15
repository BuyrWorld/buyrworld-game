import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * MODAL / OVERLAY / FOCUS CONTROLLER
 * -----------------------------------------------------------------------------
 * Verifies the authoritative modal controller: guaranteed stacking above the
 * title, working backdrop/pointer events, initial focus + focus trap + focus
 * restoration, full inertness when closed, single-owner input, Escape/Back
 * behaviour, no duplicate overlays, and movement blocked while a modal is open.
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
async function dismissPlayHint(page: Page) {
  const hint = page.locator('#play-hint-overlay');
  if (await hint.count()) {
    const btn = hint.locator('button');
    if (await btn.count()) await btn.first().click().catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await hint.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
}
async function quickStart(page: Page) {
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#title')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#hud-coins')).toBeVisible();
  await dismissPlayHint(page);
}
const gate = (page: Page, method: string, ...args: any[]) =>
  page.evaluate(([m, a]) => (window as any).__gate[m as string](...(a as any[])), [method, args] as const);

/** Is the element under the viewport centre inside a modal? */
const centreIsModal = (page: Page) =>
  page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2) as HTMLElement | null;
    return !!(el && el.closest('.bw-modal, [id$="-modal"], [role="dialog"]'));
  });

test.describe('Modal / overlay / focus controller', () => {
  // Defect 1 + reqs 2,3,4 --------------------------------------------------
  test('Settings renders visibly on the TITLE screen, on top, interactive, then closes fully inert', async ({ page }) => {
    await cleanLoad(page);
    await page.locator('#btn-settings').click();
    const modal = page.locator('#settings-modal');
    await expect(modal).toBeVisible();

    // guaranteed stacking: the modal owns the viewport centre (above the title)
    expect(await centreIsModal(page)).toBe(true);
    // it lives in the dedicated top layer
    expect(await page.evaluate(() => document.getElementById('settings-modal')?.parentElement?.id)).toBe('modal-layer');
    // interactive: a control responds
    await modal.locator('[data-set="music:off"]').click();
    await expect(modal.locator('[data-set="music:off"]')).toBeVisible();

    // close via ✕
    await modal.locator('#set-close').click();
    await expect(modal).toHaveCount(0);

    // fully inert: layer empty, no scroll lock, centre is not a modal, title usable again
    const inert = await page.evaluate(() => ({
      layerEmpty: (document.getElementById('modal-layer')?.children.length ?? 0) === 0,
      layerPe: (() => { const l = document.getElementById('modal-layer'); return l ? getComputedStyle(l).pointerEvents : 'none'; })(),
      bodyLocked: document.body.classList.contains('modal-open'),
    }));
    expect(inert.layerEmpty).toBe(true);
    expect(inert.layerPe).toBe('none');
    expect(inert.bodyLocked).toBe(false);
    expect(await centreIsModal(page)).toBe(false);
    await page.locator('#btn-quick').click({ trial: true });   // no invisible layer intercepts input
  });

  // req 4 + focus restoration ---------------------------------------------
  test('Settings works IN-GAME and restores focus to the opener on close', async ({ page }) => {
    await quickStart(page);
    await page.locator('#btn-settings-hud').click();
    await expect(page.locator('#settings-modal')).toBeVisible();
    expect(await page.evaluate(() => !!document.activeElement?.closest('#settings-modal'))).toBe(true);  // initial focus inside
    await page.locator('#settings-modal #set-close').click();
    await expect(page.locator('#settings-modal')).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('btn-settings-hud');               // focus restored
  });

  // req 2: backdrop + pointer events; req 3: inert layer ------------------
  test('Open modal has a backdrop + pointer events; the closed layer never intercepts', async ({ page }) => {
    await quickStart(page);
    await page.evaluate(() => (window as any).openSettings());
    const props = await page.evaluate(() => {
      const m = document.getElementById('settings-modal')!; const cs = getComputedStyle(m);
      return { pe: cs.pointerEvents, bg: cs.backgroundColor, inLayer: m.parentElement?.id === 'modal-layer' };
    });
    expect(props.pe).toBe('auto');
    expect(props.bg).not.toBe('rgba(0, 0, 0, 0)');   // a real (translucent) backdrop
    expect(props.inLayer).toBe(true);
    await page.locator('#settings-modal #set-close').click();
    expect(await page.evaluate(() => { const l = document.getElementById('modal-layer'); return l ? getComputedStyle(l).pointerEvents : 'none'; })).toBe('none');
  });

  // req 5 + defect 3 -------------------------------------------------------
  test('Pause closes via Resume, Close (✕) and Escape / controller Back', async ({ page }) => {
    await quickStart(page);
    const open = () => page.evaluate(() => (window as any).openPauseMenu());
    const pause = page.locator('#pause-modal');

    await open(); await expect(pause).toBeVisible();
    await pause.locator('[data-pause="resume"]').click();            // Resume
    await expect(pause).toHaveCount(0);

    await open(); await pause.locator('.modal-close').click();       // Close ✕
    await expect(pause).toHaveCount(0);

    // Escape == the controller B/Back path (both route through uiBack()/closeTopModal())
    await open(); await page.keyboard.press('Escape');
    await expect(pause).toHaveCount(0);
    expect(await page.evaluate(() => document.body.classList.contains('modal-open'))).toBe(false);
  });

  // req 6 ------------------------------------------------------------------
  test('Escape closes the topmost modal BEFORE opening Pause', async ({ page }) => {
    await quickStart(page);
    await page.evaluate(() => (window as any).openSettings());
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.keyboard.press('Escape');                            // closes Settings, must NOT open Pause
    await expect(page.locator('#settings-modal')).toHaveCount(0);
    await expect(page.locator('#pause-modal')).toHaveCount(0);
    await page.keyboard.press('Escape');                            // now opens Pause
    await expect(page.locator('#pause-modal')).toBeVisible();
  });

  // req 7 ------------------------------------------------------------------
  test('Rapid repeated open does not create duplicate overlays', async ({ page }) => {
    await quickStart(page);
    await page.evaluate(() => { for (let i = 0; i < 6; i++) (window as any).openSettings(); });
    await expect(page.locator('#settings-modal')).toHaveCount(1);
    await page.locator('#settings-modal #set-close').click();
    await page.evaluate(() => { for (let i = 0; i < 6; i++) (window as any).openPauseMenu(); });
    await expect(page.locator('#pause-modal')).toHaveCount(1);
    // only one modal in the layer owns the stack
    expect(await page.evaluate(() => document.getElementById('modal-layer')?.children.length)).toBe(1);
  });

  // req 2: focus trap ------------------------------------------------------
  test('Focus is trapped inside the open modal (Tab cycles within)', async ({ page }) => {
    await quickStart(page);
    await page.evaluate(() => (window as any).openSettings());
    await expect(page.locator('#settings-modal')).toBeVisible();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('#settings-modal'))).toBe(true);
    }
    await page.keyboard.press('Escape');
  });

  // req 8 ------------------------------------------------------------------
  test('Gameplay movement is blocked while a modal is open', async ({ page }) => {
    await quickStart(page);
    await gate(page, 'enterCottage');
    expect(await gate(page, 'state').then((s: any) => s.tab)).toBe('myhome');
    await page.evaluate(() => (window as any).openSettings());
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.keyboard.down('s'); await page.waitForTimeout(1300); await page.keyboard.up('s');   // try to walk out
    expect(await gate(page, 'state').then((s: any) => s.tab)).toBe('myhome');                       // did not move/exit
    await page.locator('#settings-modal #set-close').click();
  });
});
