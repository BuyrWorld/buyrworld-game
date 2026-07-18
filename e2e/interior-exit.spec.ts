import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * INTERIOR TRANSITION / RECOVERY
 * -----------------------------------------------------------------------------
 * Verifies the ONE authoritative interior exit: walking south leaves reliably via
 * S, ArrowDown and the shared controller/D-pad movement abstraction; a focusable
 * Exit button and an Escape recovery menu both leave; corrupt/missing return state
 * drops the player safely outside; exactly one transition fires per input; and no
 * page reload is ever needed. Driven through the real functions via __gate.
 */

const SAVE_KEY = 'buyrworld_game_save_v1';
async function cleanLoad(page: Page) {
  await page.addInitScript((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
  let lastErr: unknown;
  for (let a = 0; a < 4; a++) {
    try { await page.goto('/?pres=off', { waitUntil: 'commit', timeout: 30_000 }); await expect(page.locator('#title')).toBeVisible({ timeout: 30_000 }); return; }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}
const gate = (page: Page, m: string, ...a: any[]) =>
  page.evaluate(([mm, aa]) => (window as any).__gate[mm as string](...(aa as any[])), [m, a] as const);
async function startClean(page: Page) {
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#title')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 20000 });
  await page.waitForTimeout(900);            // let the async play-hint appear…
  await gate(page, 'intClearHint');          // …then guarantee a clean, modal-free state
}
// Walk with a held key through the real keydown → VKEYS → moveActor path.
async function walkKey(page: Page, key: string, ms = 1500) {
  await gate(page, 'intClearHint');
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
  await page.waitForTimeout(200);
}
const PLAYER = 'player_home', FRANK = 'home_06';

test.describe('Interior transition & recovery', () => {
  for (const [label, id] of [['player cottage', PLAYER], ["Frank's cottage", FRANK]] as const) {
    test(`enter and leave the ${label} with S`, async ({ page }) => {
      await startClean(page);
      await gate(page, 'intResetLeaveCount');
      const e = await gate(page, 'intEnter', id);
      expect(e.tab === 'myhome' || e.tab === 'home').toBe(true);
      await walkKey(page, 's');
      const s = await gate(page, 'intInfo');
      expect(s.tab).toBe('village');                 // left reliably
      expect(s.leaveCount).toBe(1);                  // exactly one transition
    });
    test(`enter and leave the ${label} with ArrowDown`, async ({ page }) => {
      await startClean(page);
      await gate(page, 'intResetLeaveCount');
      await gate(page, 'intEnter', id);
      await walkKey(page, 'ArrowDown');
      const s = await gate(page, 'intInfo');
      expect(s.tab).toBe('village');
      expect(s.leaveCount).toBe(1);
    });
  }

  test('controller/D-pad walks out through the shared movement abstraction', async ({ page }) => {
    await startClean(page);
    await gate(page, 'intResetLeaveCount');
    await gate(page, 'intEnter', PLAYER);
    // the D-pad and left stick both feed GPKEYS → moveActor → the exit region
    const r = await gate(page, 'intAbstractWalkDown', 60);
    expect(r.tab).toBe('village');
    expect(r.leaveCount).toBe(1);
  });

  test('holding down fires EXACTLY ONE transition (no double-exit / re-entry)', async ({ page }) => {
    await startClean(page);
    await gate(page, 'intResetLeaveCount');
    await gate(page, 'intEnter', FRANK);
    await walkKey(page, 's', 2400);                  // hold well past the exit
    const s = await gate(page, 'intInfo');
    expect(s.tab).toBe('village');
    expect(s.leaveCount).toBe(1);
  });

  test('the focusable Exit button leaves the building', async ({ page }) => {
    await startClean(page);
    await gate(page, 'intResetLeaveCount');
    await gate(page, 'intEnter', PLAYER);
    await expect(page.locator('.ilbl-exit')).toBeVisible();
    await page.locator('.ilbl-exit').click();
    await page.waitForTimeout(200);
    const s = await gate(page, 'intInfo');
    expect(s.tab).toBe('village');
    expect(s.leaveCount).toBe(1);
  });

  test('Escape opens a recovery menu; "Leave building" exits', async ({ page }) => {
    await startClean(page);
    await gate(page, 'intResetLeaveCount');
    await gate(page, 'intEnter', PLAYER);
    await page.keyboard.press('Escape');
    await expect(page.locator('#recovery-modal')).toBeVisible();
    // Resume / Leave building / Settings are all present (no dead end)
    for (const a of ['resume', 'leave', 'settings']) await expect(page.locator(`[data-rec="${a}"]`)).toBeVisible();
    await page.locator('[data-rec="leave"]').click();
    await page.waitForTimeout(200);
    const s = await gate(page, 'intInfo');
    expect(s.tab).toBe('village');
    expect(s.leaveCount).toBe(1);
  });

  test('corrupt/missing return coordinates still leave safely (no reload)', async ({ page }) => {
    await startClean(page);
    await gate(page, 'intEnter', PLAYER);
    await gate(page, 'intCorruptReturn');            // garbage return + bad room id
    const lr = await gate(page, 'intLeave');
    expect(lr.ok).toBe(true);
    expect(lr.tab).toBe('village');
    expect(Number.isFinite(lr.vpx) && Number.isFinite(lr.vpy)).toBe(true);
  });

  test('loading a save with corrupt interior state places the player OUTSIDE', async ({ page }) => {
    await startClean(page);
    await gate(page, 'intEnter', FRANK);
    await gate(page, 'intCorruptReturn');            // corrupt + saved
    await page.reload({ waitUntil: 'commit' });
    await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 30_000 });
    const s = await gate(page, 'intInfo');
    expect(s.isInterior).toBe(false);                // dropped outside, not trapped
    expect(s.tab).toBe('village');
  });

  test('save/load while inside a cottage lands the player safely in the village', async ({ page }) => {
    await startClean(page);
    await gate(page, 'intEnter', PLAYER);
    await gate(page, 'intSaveNow');                 // persist the interior state
    // a fresh page in the same context = reload; a cottage (not a nav tab) resolves
    // to the village at the recorded exterior return — safe, never trapped.
    const p2 = await page.context().newPage();
    let ok = false, lastErr: unknown;
    for (let i = 0; i < 4 && !ok; i++) {
      try { await p2.goto('/?pres=off', { waitUntil: 'commit', timeout: 30_000 }); await expect(p2.locator('#hud-coins')).toBeVisible({ timeout: 30_000 }); ok = true; }
      catch (e) { lastErr = e; }
    }
    if (!ok) throw lastErr;
    await p2.waitForFunction(() => !!(window as any).__gate, null, { timeout: 30_000 });
    const g2 = (m: string, ...a: any[]) => p2.evaluate(([mm, aa]) => (window as any).__gate[mm as string](...(aa as any[])), [m, a] as const);
    const st = await g2('intInfo');
    expect(st.tab).toBe('village');                  // safely outside
    expect(st.isInterior).toBe(false);
    expect(Number.isFinite(st.vpx) && Number.isFinite(st.vpy)).toBe(true);   // a valid exterior position
    await p2.close();
  });
});
