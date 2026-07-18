import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * PREMIUM BOOT PRESENTATION — boot → intro → press any button → title menu → …
 * Verifies the flow, skip, variants, no-HUD-behind, and menu behaviour.
 */
const SAVE_KEY = 'buyrworld_game_save_v1';
const gate = (page: Page, m: string, ...a: any[]) =>
  page.evaluate(([mm, aa]) => (window as any).__gate[mm as string](...(aa as any[])), [m, a] as const);
async function fresh(page: Page, query = '') {
  await page.goto('/' + query, { waitUntil: 'commit', timeout: 60_000 });
  await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
  await page.reload({ waitUntil: 'commit', timeout: 45_000 });
  await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 45_000 });
}

test.describe('Boot presentation', () => {
  test('fresh launch plays the FULL intro with the HUD hidden, and never opens into the creator', async ({ page }) => {
    const errs: string[] = []; page.on('pageerror', e => errs.push(e.message));
    await fresh(page);
    const v = await gate(page, 'presVisible');
    expect(v.state).toBe('intro');
    expect(v.variant).toBe('full');
    expect(v.presentation).toBe(true);
    expect(v.creator).toBe(false);            // NOT the character creator
    expect(v.hudHidden).toBe(true);           // gameplay HUD hidden (body.pre-game)
    expect(await page.locator('#hud-coins').isVisible()).toBe(false);
    expect(errs).toHaveLength(0);
  });

  test('reduced-motion uses the static variant; ?pres=short forces the short intro', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fresh(page);
    expect((await gate(page, 'presVisible')).variant).toBe('reduced');
    await page.emulateMedia({ reducedMotion: null });
    await fresh(page, '?pres=short');
    expect((await gate(page, 'presVisible')).variant).toBe('short');
  });

  test('the intro always resolves to Press Any Button, then the title menu', async ({ page }) => {
    await fresh(page);
    await gate(page, 'presSkip');                                  // skip → press any button
    await expect.poll(async () => (await gate(page, 'presVisible')).state, { timeout: 4000 }).toBe('pressAny');
    await page.locator('#press-any').click();                     // any input → title menu
    await expect.poll(async () => (await gate(page, 'presVisible')).state, { timeout: 4000 }).toBe('titleMenu');
    expect((await gate(page, 'presVisible')).titleMenu).toBe(true);
  });

  test('title menu: Continue is disabled without a save; no Quit in the browser; New Game opens the creator with the HUD still hidden', async ({ page }) => {
    await fresh(page);
    await gate(page, 'presToMenu');
    const items = await gate(page, 'presMenuItems');
    const ids = items.map((i: any) => i.id);
    expect(ids).toContain('continue');
    expect(items.find((i: any) => i.id === 'continue').disabled).toBe(true);   // no save
    expect(ids).toContain('newgame');
    expect(ids).toContain('quick');
    expect(ids).toContain('settings');
    expect(ids).toContain('about');
    expect(ids).not.toContain('quit');            // browser mode → no fake Quit
    expect(ids).not.toContain('install');         // no beforeinstallprompt in the test → no non-functional Install
    // controller/keyboard focus starts on the primary (New Game, since no save) — a
    // visible, enabled item; never the disabled Continue.
    const focused = items.find((i: any) => i.focus);
    expect(focused.id).toBe('newgame');
    expect(focused.disabled).toBe(false);
    // New Game → creator, HUD still hidden
    await gate(page, 'presMenuAction', 'newgame');
    const v = await gate(page, 'presVisible');
    expect(v.creator).toBe(true);
    expect(v.hudHidden).toBe(true);
    expect(await page.locator('#hud-coins').isVisible()).toBe(false);
  });

  test('Quick Start from the menu still starts a game (creator → playing)', async ({ page }) => {
    await fresh(page);
    await gate(page, 'presToMenu');
    await gate(page, 'presMenuAction', 'quick');
    await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });   // landed in the game
    expect(await gate(page, 'presState')).toBe('playing');
  });

  test('a returning player with a save gets Continue + a summary, and the short intro next launch', async ({ page }) => {
    // create a save via the fast path, then check the menu + returning intro
    await page.goto('/?pres=off', { waitUntil: 'commit', timeout: 60_000 });
    await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
    await page.reload({ waitUntil: 'commit', timeout: 45_000 });
    await expect(page.locator('#title')).toBeVisible({ timeout: 45_000 });
    await page.locator('#btn-quick').click();
    await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
    // now relaunch the real flow — the intro is now SHORT (seen once) and Continue is live
    await page.goto('/', { waitUntil: 'commit', timeout: 60_000 });
    await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 45_000 });
    expect((await gate(page, 'presVisible')).variant).toBe('short');
    await gate(page, 'presToMenu');
    const cont = (await gate(page, 'presMenuItems')).find((i: any) => i.id === 'continue');
    expect(cont.disabled).toBe(false);          // a save exists → Continue enabled
    await gate(page, 'presMenuAction', 'continue');
    await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });   // loaded the founder
  });

  test('the skip input is consumed and does not also activate a title-menu item', async ({ page }) => {
    await fresh(page);
    // press Enter to skip the intro; it must NOT bleed through and select a menu item
    await page.waitForTimeout(600);                         // past the input guard
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await gate(page, 'presVisible')).state, { timeout: 4000 }).toBe('pressAny');
    expect((await gate(page, 'presVisible')).titleMenu).toBe(false);   // did not jump into the menu / select anything
    expect(await gate(page, 'presState')).not.toBe('playing');         // and certainly did not start a game
  });

  test('Replay Intro restarts the full intro without creating a new game', async ({ page }) => {
    await fresh(page, '?pres=off');
    await page.locator('#btn-quick').click();
    await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
    const nameBefore = await page.evaluate(() => (window as any).__gate.presReplayIntro().name);
    expect((await gate(page, 'presVisible')).variant).toBe('full');            // replay = full intro
    expect((await gate(page, 'presVisible')).presentation).toBe(true);
    // the save/founder is untouched by replaying
    expect(await page.evaluate(() => (window as any).__gate.presState())).toBe('intro');
    expect(nameBefore).toBeTruthy();
  });
});
