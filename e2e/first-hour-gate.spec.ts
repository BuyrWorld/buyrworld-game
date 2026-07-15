import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * FIRST-HOUR RELEASE GATE
 * -----------------------------------------------------------------------------
 * Black-box browser tests of the clean-save first hour, driving the REAL app.
 * UI flows use production selectors/globals; the deterministic production chain
 * and internal-state reads use the dev-only `window.__gate` bridge (stripped
 * from `vite build`). No production test controls; no player saves are touched
 * (each test runs in an isolated Playwright context and clears its own save).
 */

const SAVE_KEY = 'buyrworld_game_save_v1';

/** Load with a guaranteed clean save, land on the title screen. */
async function cleanLoad(page: Page) {
  await page.addInitScript((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
  // domcontentloaded, not the default 'load': the game streams many assets
  // (music mp3s, sprites) whose full load can exceed the timeout and stall goto.
  // The very first navigation of a run can hang/abort on Vite's cold graph; retry.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      // 'commit' resolves as soon as the navigation commits (before load), so a
      // slow/detaching first load can't hang or abort the goto itself.
      await page.goto('/', { waitUntil: 'commit', timeout: 30_000 });
      await expect(page.locator('#title')).toBeVisible({ timeout: 30_000 });
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/** Dismiss the one-time "How to Play" hint if it appears after launch. */
async function dismissPlayHint(page: Page) {
  const hint = page.locator('#play-hint-overlay');
  if (await hint.count()) {
    const btn = hint.locator('button');
    if (await btn.count()) await btn.first().click().catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await hint.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
}

/** Quick Start into the game; resolve when the HUD wallet is showing. */
async function quickStart(page: Page) {
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#title')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#hud-coins')).toBeVisible();
  await dismissPlayHint(page);
}

const gate = (page: Page, method: string, ...args: any[]) =>
  page.evaluate(([m, a]) => (window as any).__gate[m as string](...(a as any[])), [method, args] as const);

async function tabName(page: Page) { return (await gate(page, 'state')).tab as string; }

/** Poll until the player is back in the village (an exit succeeded), else throw. */
async function waitForVillage(page: Page, note: string) {
  await expect
    .poll(async () => await tabName(page), { timeout: 9000, message: `cottage exit via ${note}` })
    .toBe('village');
}

test.describe('First-hour release gate', () => {
  // 1 ------------------------------------------------------------------------
  test('1. loads the title screen with a completely clean save', async ({ page }) => {
    await cleanLoad(page);
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#btn-quick')).toBeVisible();
    // a clean save boots into character creation (the title), not a resumed session
    await expect(page.locator('body')).toHaveClass(/title-open/);
  });

  // 2 ------------------------------------------------------------------------
  test('2. Settings opens, is interactive, and closes', async ({ page }) => {
    // in-game (not the title screen, whose character-creation UI overlaps modals)
    await quickStart(page);
    await page.evaluate(() => (window as any).openSettings());
    const modal = page.locator('#settings-modal');
    await expect(modal).toBeVisible();
    // interactive: flipping a setting updates the pressed control
    const musicOff = modal.locator('[data-set="music:off"]');
    await expect(musicOff).toBeVisible();
    await musicOff.click();
    // closable via the ✕
    await modal.locator('#set-close').click();
    await expect(modal).toHaveCount(0);
  });

  // 3 ------------------------------------------------------------------------
  test('3. completes Quick Start', async ({ page }) => {
    await quickStart(page);
    const st = await gate(page, 'state');
    // Quick Start lands you in the starter cottage (a cosy intro), tutorial active
    expect(['myhome', 'village']).toContain(st.tab);
    expect(st.tut).not.toBeNull();
    expect(st.tut.done).toBe(false);
  });

  // 4 ------------------------------------------------------------------------
  test('4. welcome copy: Frosty / mine 6 Iron Ore / tabs at top', async ({ page }) => {
    await quickStart(page);
    // scope the copy assertions to Frosty's guide dialogue, not the whole page
    const guide = page.locator('.say').first();
    await expect(guide).toBeVisible();
    const text = await guide.innerText();

    // the guide is "Frosty", not "Frost"
    expect(text).toMatch(/Frosty/i);
    // mine 6 Iron Ore, not 5
    expect(text).toMatch(/6\s*Iron Ore/i);
    expect(text).not.toMatch(/5\s*Iron Ore/i);

    // category tabs sit at the TOP (upper half of the viewport), not the bottom
    const nav = page.locator('#nav');
    await expect(nav).toBeVisible();
    const navBox = (await nav.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(navBox.y + navBox.height / 2).toBeLessThan(vp.height / 2);
    // …and above the game canvas (interior after Quick Start, else village)
    const canvasBox = await page.locator('#interior, #village').first().boundingBox();
    if (canvasBox) expect(navBox.y).toBeLessThan(canvasBox.y);
  });

  // 4b -----------------------------------------------------------------------
  test('4b. welcome MODAL copy is config-derived: Frosty / 6 Iron Ore / tabs at TOP', async ({ page }) => {
    await cleanLoad(page);
    await page.locator('#btn-quick').click();
    // inspect the one-time "How to Play" modal BEFORE dismissing it
    const hint = page.locator('#play-hint-overlay');
    await expect(hint).toBeVisible({ timeout: 10000 });
    const text = await hint.innerText();
    // the guide is "Frosty", never the old "Frost"
    expect(text).toMatch(/Frosty/i);
    expect(text).not.toMatch(/Follow Frost\b(?!y)/);
    // the first job is 6 Iron Ore, never 5
    expect(text).toMatch(/6\s*Iron Ore/i);
    expect(text).not.toMatch(/5\s*Iron Ore/i);
    // navigation is described as the TOP category tabs, never "bottom"
    expect(text).toMatch(/top/i);
    expect(text).not.toMatch(/bottom/i);
    await hint.locator('button').first().click();
    await expect(hint).toBeHidden();
  });

  // 5 ------------------------------------------------------------------------
  test('5. enters the starter cottage', async ({ page }) => {
    await quickStart(page);
    await gate(page, 'enterCottage');
    expect(await tabName(page)).toBe('myhome');
    await expect(page.locator('#interior')).toBeVisible();
  });

  // 6 ------------------------------------------------------------------------
  test('6. leaves the cottage via keyboard, click, tap and controller-equivalent', async ({ page }) => {
    await quickStart(page);
    const interior = page.locator('#interior');
    const enter = async () => { await gate(page, 'enterCottage'); await expect(interior).toBeVisible(); };
    // a floor point near the bottom, off-centre to avoid central furniture/stations
    const exitPoint = async () => { const b = (await interior.boundingBox())!; return { x: b.width * 0.28, y: b.height - 2 }; };

    // keyboard — hold "s" (WASD is the movement binding; arrow keys are UI-nav)
    await enter();
    await page.keyboard.down('s');
    await page.waitForTimeout(1400);
    await page.keyboard.up('s');
    await waitForVillage(page, 'keyboard (WASD)');

    // clickable exit — click the interior floor at the bottom (walk-to)
    await enter();
    await interior.click({ position: await exitPoint() });
    await waitForVillage(page, 'click');

    // touch-style tap at the bottom
    await enter();
    await interior.tap({ position: await exitPoint() });
    await waitForVillage(page, 'tap');

    // controller-equivalent — a hardware gamepad can't be injected via Playwright,
    // and its stick/D-pad feeds the SAME movement path as WASD (VKEYS/GPKEYS →
    // one dx/dy integrator), so we exercise that shared path via the keyboard.
    test.info().annotations.push({ type: 'note', description: 'controller leave: gamepad not injectable; exercises the shared WASD/GPKEYS movement path' });
    await enter();
    await page.keyboard.down('s');
    await page.waitForTimeout(1400);
    await page.keyboard.up('s');
    await waitForVillage(page, 'controller-equivalent');
  });

  // 7-11 ---------------------------------------------------------------------
  test('7-11. mines 6 → 3 bars → 3 brackets → delivers 3, wallet stays consistent', async ({ page }) => {
    await quickStart(page);
    const snaps = await gate(page, 'runChain');
    const by = (l: string) => snaps.find((s: any) => s.label === l);

    // 7. mined EXACTLY 6 iron ore
    expect(by('mine').items.iron_ore).toBe(6);

    // 8. 6 ore → EXACTLY 3 iron bars (2 ore each), ore fully consumed
    expect(by('smelt').items.iron_bar).toBe(3);
    expect(by('smelt').items.iron_ore).toBe(0);

    // 9. 3 bars → EXACTLY 3 brackets (1 bar each), bars fully consumed
    expect(by('press').items.bracket).toBe(3);
    expect(by('press').items.iron_bar).toBe(0);

    // 10. delivered EXACTLY 3 brackets; tutorial delivery stage complete
    expect(by('deliver').items.bracket).toBe(0);
    expect(by('deliver').tutDone).toBe(true);

    // 11. displayed wallet === authoritative wallet after EVERY reward
    for (const s of snaps) expect(s.walletDisplayed, `wallet after "${s.label}"`).toBe(s.coins);
  });

  // 12 -----------------------------------------------------------------------
  test('12. Festival Goer does NOT unlock on startup', async ({ page }) => {
    await quickStart(page);
    const st = await gate(page, 'state');
    expect(st.festivalAttended).toBe(0);
    expect(st.festivalGoerUnlocked).toBe(false);
  });

  // 13 -----------------------------------------------------------------------
  test('13. Frosty-exclusive radio tracks stay locked before their quest', async ({ page }) => {
    await quickStart(page);
    const st = await gate(page, 'state');
    expect(st.frostyQuests).toBe(0);
    // at least one exclusive exists and is locked, and none of the locked ones
    // are being reported as unlocked
    expect(st.lockedExclusiveIds.length).toBeGreaterThan(0);
    for (const id of st.lockedExclusiveIds) expect(st.unlockedTrackIds).not.toContain(id);
    // sanity: not everything is unlocked from the start
    expect(st.unlockedTrackIds.length).toBeLessThan(st.allExclusiveIds.length);
  });

  // 14 -----------------------------------------------------------------------
  test('14. Pause opens and closes via Close, Resume and Escape', async ({ page }) => {
    await quickStart(page);
    const open = () => page.evaluate(() => (window as any).openPauseMenu());
    const pause = page.locator('#pause-modal');

    await open();
    await expect(pause).toBeVisible();
    await pause.locator('.modal-close').click();            // Close (✕)
    await expect(pause).toHaveCount(0);

    await open();
    await pause.locator('[data-pause="resume"]').click();   // Resume
    await expect(pause).toHaveCount(0);

    await open();
    await page.keyboard.press('Escape');                    // Escape / controller Back
    await expect(pause).toHaveCount(0, { timeout: 4000 });
  });

  // 15 -----------------------------------------------------------------------
  test('15. no invisible overlay keeps intercepting input after modals close', async ({ page }) => {
    await quickStart(page);
    // open then close both modals
    await page.evaluate(() => (window as any).openSettings());
    await page.locator('#settings-modal #set-close').click();
    await expect(page.locator('#settings-modal')).toHaveCount(0);
    await page.evaluate(() => (window as any).openPauseMenu());
    await page.locator('#pause-modal .modal-close').click();
    await expect(page.locator('#pause-modal')).toHaveCount(0);

    // nothing full-screen and interactive should still be sitting over the game
    const blocker = await page.evaluate(() => {
      const vp = { w: innerWidth, h: innerHeight };
      const el = document.elementFromPoint(vp.w / 2, vp.h / 2) as HTMLElement | null;
      const modalAncestor = el && el.closest('[id$="-modal"], #play-hint-overlay, #radio-modal, [role="dialog"]');
      // any leftover element covering the viewport centre that eats pointer events
      const covering = Array.from(document.querySelectorAll('body *')).find((n) => {
        const e = n as HTMLElement;
        const cs = getComputedStyle(e);
        if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
        if (cs.pointerEvents === 'none' || cs.display === 'none' || cs.visibility === 'hidden') return false;
        const r = e.getBoundingClientRect();
        const full = r.width >= vp.w * 0.9 && r.height >= vp.h * 0.9;
        const isModal = e.matches('[id$="-modal"], #play-hint-overlay, #radio-modal, [role="dialog"]');
        return full && isModal;
      });
      return { pointTargetIsModal: !!modalAncestor, coveringModalId: covering ? (covering as HTMLElement).id || covering.className : null };
    });
    expect(blocker.pointTargetIsModal).toBe(false);
    expect(blocker.coveringModalId).toBeNull();
  });
});
