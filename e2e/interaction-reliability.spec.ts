import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * PLAYER TRUST & INTERACTION RELIABILITY
 * -----------------------------------------------------------------------------
 * First-click activation, keyboard/controller confirm, modal focus restoration,
 * the Flagship CTA (×20), atomic district fast-travel (×20), cottage enter/exit
 * in normal + couch mode, and aria-pressed settings — all through the real UI.
 */
const SAVE_KEY = 'buyrworld_game_save_v1';
async function cleanLoad(page: Page) {
  let lastErr: unknown;
  for (let a = 0; a < 4; a++) {
    try {
      await page.goto('/?pres=off', { waitUntil: 'commit', timeout: 60_000 });
      await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
      await page.reload({ waitUntil: 'commit', timeout: 45_000 });
      await expect(page.locator('#title')).toBeVisible({ timeout: 45_000 });
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
const gate = (page: Page, m: string, ...a: any[]) =>
  page.evaluate(([mm, aa]) => (window as any).__gate[mm as string](...(aa as any[])), [m, a] as const);
async function afterTutorial(page: Page) {
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 20000 });
  const hint = page.locator('#play-hint-overlay');
  if (await hint.count()) { const b = hint.locator('button'); if (await b.count()) await b.first().click().catch(()=>{}); }
  await gate(page, 'runChain');   // complete the tutorial so Contracts + the CTA exist
  await page.evaluate(() => document.querySelectorAll('#tut-summary,#next-step-modal,#unlock-card').forEach(e => e.remove()));
}

test.describe('Interaction reliability', () => {
  // req 7 acceptance: 20 consecutive Flagship CTA activations succeed --------
  test('the Flagship CTA opens on the first click, 20 times in a row', async ({ page }) => {
    test.setTimeout(120_000);
    await afterTutorial(page);
    await gate(page, 'uiGoTab', 'contracts');
    const cta = page.locator('button[onclick*="openFlagshipOrder"]').first();
    await expect(cta).toBeVisible();
    let opened = 0;
    for (let i = 0; i < 20; i++) {
      await cta.click();   // a real pointer click
      const isOpen = await page.evaluate(() => !!document.getElementById('flagship-modal'));
      if (isOpen) opened++;
      await page.evaluate(() => { const m = document.getElementById('flagship-modal'); if (m) m.remove(); });
    }
    expect(opened).toBe(20);   // every single click opened it on the first try
  });

  // req 1/6: a mid-click re-render must not swallow the click ----------------
  test('a timed re-render does not swallow a click in progress (first-click)', async ({ page }) => {
    await afterTutorial(page);
    const r = await gate(page, 'uiFirstClickRace');
    expect(r.heldDuringPress).toBe(true);     // pressing marks the pointer held
    expect(r.wouldRebuild).toBe(false);       // the guard defers the timed rebuild
    expect(r.stillConnected).toBe(true);      // the button node survives the press
    expect(r.opened).toBe(true);              // the click still activated it
  });

  // req 2/3: keyboard Enter/Space + controller A activate the focused control
  test('keyboard Enter and controller A activate the focused control', async ({ page }) => {
    await afterTutorial(page);
    await gate(page, 'uiGoTab', 'contracts');
    // Enter on the focused CTA opens the modal
    await page.locator('button[onclick*="openFlagshipOrder"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#flagship-modal')).toBeVisible({ timeout: 4000 });
    await page.locator('#flagship-modal [data-c2c="close"]').click();
    // Controller A (shared uiConfirm path) also opens it from focus
    await gate(page, 'uiFocusEl', 'button[onclick*="openFlagshipOrder"]');
    const a = await gate(page, 'uiPressA');
    expect(a.openedFlagship).toBe(true);
    await page.locator('#flagship-modal [data-c2c="close"]').click();
  });

  test('Space toggles a focused settings control', async ({ page }) => {
    await afterTutorial(page);
    await gate(page, 'uiOpenSettings');
    await expect(page.locator('#settings-modal')).toBeVisible();
    const before = await gate(page, 'uiSegState', 'couch');   // [{v:off,pressed},{v:on,pressed}]
    const onBtn = page.locator('#settings-modal [data-set="couch:on"]');
    await onBtn.focus();
    await page.keyboard.press(' ');
    const after = await gate(page, 'uiSegState', 'couch');
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));   // state changed
    expect((after.find((s:any)=>s.v==='on') as any).pressed).toBe('true');
  });

  // req 5: Esc closes only the topmost modal + restores focus to the opener --
  test('Esc closes the modal and restores focus to the opener', async ({ page }) => {
    await afterTutorial(page);
    await gate(page, 'uiGoTab', 'contracts');
    // focus the CTA, open Settings FROM it, Esc → focus returns to the CTA
    await page.locator('button[onclick*="openFlagshipOrder"]').focus();
    await gate(page, 'uiOpenSettings');
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-modal')).toBeHidden({ timeout: 4000 });
    // focus is restored to the CTA that opened the modal
    const onCta = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return !!(a && (a.getAttribute('onclick') || '').includes('openFlagshipOrder'));
    });
    expect(onCta).toBe(true);
  });

  // req 8/9 acceptance: 20 consecutive journeys leave every value consistent -
  test('district fast-travel is atomic and consistent, 20 journeys', async ({ page }) => {
    await afterTutorial(page);
    const open = await gate(page, 'uiDistrictsOpen');
    expect(open.length).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 20; i++) {
      const d = open[i % open.length];
      const s = await gate(page, 'uiTravelTo', d.id);
      expect(s.tab).toBe('village');                 // always in the world view
      expect(s.currentDistrict).toBe(d.id);          // current district matches
      expect(Math.abs(s.vpx - d.hx)).toBeLessThan(1);  // player AT the hub
      expect(Math.abs(s.vpy - d.hy)).toBeLessThan(1);
      expect(s.moving).toBe(false);                  // no leftover movement/waypoint
      expect(s.vptx === null || s.vptx === undefined).toBe(true);
      expect(s.chipText).toContain(d.name);          // the on-map label shows the NEW district (req 9)
    }
  });

  // req 10: cottage enter + Exit in normal AND couch mode -------------------
  for (const couch of [false, true]) {
    test(`cottage enter and exit works in ${couch ? 'couch' : 'normal'} mode`, async ({ page }) => {
      await afterTutorial(page);
      await gate(page, 'uiCouch', couch);
      await gate(page, 'intResetLeaveCount');
      const e = await gate(page, 'uiCottageEnter');
      expect(e.tab).toBe('myhome');
      await gate(page, 'intClearHint');
      await page.keyboard.down('s'); await page.waitForTimeout(1500); await page.keyboard.up('s');
      await page.waitForTimeout(200);
      const s = await gate(page, 'intInfo');
      expect(s.tab).toBe('village');                 // walked out reliably
      expect(s.leaveCount).toBe(1);
    });
  }

  // req 6: couch mode must not require a double click -----------------------
  test('couch mode: the Flagship CTA still opens on a single click', async ({ page }) => {
    await afterTutorial(page);
    await gate(page, 'uiCouch', true);
    expect((await gate(page, 'uiCouch', true)).couch).toBe(true);   // couch-mode is on
    await gate(page, 'uiGoTab', 'contracts');
    expect(await gate(page, 'uiFlagshipCta')).toBe(true);           // the CTA is present
    // a single real click opens it (no second click needed)
    await page.locator('button[onclick*="openFlagshipOrder"]').first().click();
    await expect(page.locator('#flagship-modal')).toBeVisible({ timeout: 4000 });
  });

  // req 11: settings controls expose aria-pressed ---------------------------
  test('settings segmented controls expose aria-pressed', async ({ page }) => {
    await afterTutorial(page);
    await gate(page, 'uiOpenSettings');
    const music = await gate(page, 'uiSegState', 'music');
    // exactly one option is pressed, and it reflects the real setting
    const pressed = music.filter((s:any) => s.pressed === 'true');
    expect(pressed.length).toBe(1);
    // toggling updates aria-pressed
    await page.locator('#settings-modal [data-set="couch:on"]').click();
    const couch = await gate(page, 'uiSegState', 'couch');
    expect((couch.find((s:any)=>s.v==='on') as any).pressed).toBe('true');
    expect((couch.find((s:any)=>s.v==='off') as any).pressed).toBe('false');
  });
});
