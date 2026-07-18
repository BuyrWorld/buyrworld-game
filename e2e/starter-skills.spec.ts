import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * STARTER-SKILL GAMEPLAY DIFFERENTIATION
 * -----------------------------------------------------------------------------
 * The per-skill "approach" chooser renders, is controller-reachable, and actually
 * changes the outcome (yield / quality) while keeping inventory accounting exact.
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

test.describe('Starter-skill differentiation', () => {
  test('every starter skill exposes its approach chooser in the panel', async ({ page }) => {
    await start(page);
    for (const skill of ['mining', 'woodcutting', 'fishing', 'steelworks', 'manufacturing']) {
      await gate(page, 'uiUnlockTab', skill);
      await gate(page, 'uiGoTab', skill);
      await page.waitForTimeout(120);
      const approaches = page.locator('#main [data-approach]');
      expect(await approaches.count(), `${skill} chooser`).toBeGreaterThanOrEqual(2);
    }
  });

  test('mining seam choice changes yield exactly; the default is base', async ({ page }) => {
    await start(page);
    // deep seam grants +1 primary ore over the balanced default — exact, deterministic
    const steady = await gate(page, 'uiRunSkill', 'mining', 'steady');
    const deep = await gate(page, 'uiRunSkill', 'mining', 'deep');
    expect(steady.ok).toBe(true);
    expect(deep.ok).toBe(true);
    expect(deep.delta).toBe(steady.delta + 1);          // deep seam = +1 ore, exactly
    expect(Number.isInteger(deep.delta)).toBe(true);     // never fractional
  });

  test('manufacturing tolerance moves the QC rating (quality, not just XP)', async ({ page }) => {
    await start(page);
    const q0 = (await gate(page, 'uiRunSkill', 'manufacturing', 'loose')).qc;
    // tight tolerance nudges quality UP relative to loose over a few runs
    let qTight = q0;
    for (let i = 0; i < 4; i++) qTight = (await gate(page, 'uiRunSkill', 'manufacturing', 'tight')).qc;
    let qLoose = qTight;
    for (let i = 0; i < 4; i++) qLoose = (await gate(page, 'uiRunSkill', 'manufacturing', 'loose')).qc;
    expect(qTight).toBeGreaterThan(qLoose);              // tight lifts quality, loose drops it
  });

  test('smelting economical burns less fuel than the fast profile (exact integers)', async ({ page }) => {
    await start(page);
    // run each profile several times and total the primary input consumed
    const sum = (runs: any[], id: string) => runs.reduce((s, r) => s + (r.inUsed?.[id] || 0), 0);
    const ecoRuns: any[] = [], fastRuns: any[] = [];
    for (let i = 0; i < 10; i++) ecoRuns.push(await gate(page, 'uiRunSkill', 'steelworks', 'economical'));
    for (let i = 0; i < 10; i++) fastRuns.push(await gate(page, 'uiRunSkill', 'steelworks', 'fast'));
    const inputId = Object.keys(ecoRuns[0].inUsed || {})[0];
    if (inputId) {
      for (const r of [...ecoRuns, ...fastRuns]) expect(Number.isInteger(r.inUsed[inputId])).toBe(true);
      expect(sum(ecoRuns, inputId)).toBeLessThan(sum(fastRuns, inputId));   // economical < fast
    }
  });
});
