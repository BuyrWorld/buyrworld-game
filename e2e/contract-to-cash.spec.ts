import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * CONTRACT-TO-CASH VERTICAL SLICE
 * -----------------------------------------------------------------------------
 * Verifies the authored flagship order end-to-end through the real functions:
 * it's offered after the tutorial, the guided flow reaches the P&L review, and
 * every outcome (best / late / defective / loss-making) settles correctly through
 * the wallet — with a safe-recovery floor so a poor decision never wipes the save.
 */

const SAVE_KEY = 'buyrworld_game_save_v1';
async function cleanLoad(page: Page) {
  await page.addInitScript((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { await page.goto('/', { waitUntil: 'commit', timeout: 30_000 }); await expect(page.locator('#title')).toBeVisible({ timeout: 30_000 }); return; }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}
async function startAndFinishTutorial(page: Page) {
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#title')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
  const hint = page.locator('#play-hint-overlay');
  if (await hint.count()) { const b = hint.locator('button'); if (await b.count()) await b.first().click().catch(()=>{}); }
  await gate(page, 'runChain');                              // complete the tutorial
  await page.evaluate(() => document.querySelectorAll('#tut-summary,#next-step-modal,#unlock-card').forEach(e => e.remove()));
}
const gate = (page: Page, method: string, ...args: any[]) =>
  page.evaluate(([m, a]) => (window as any).__gate[m as string](...(a as any[])), [method, args] as const);

test.describe('Contract-to-Cash vertical slice', () => {
  test('offered after the tutorial; the guided flow reaches the P&L review', async ({ page }) => {
    await startAndFinishTutorial(page);
    expect(await gate(page, 'flagAvailable')).toBe(true);   // authored order available post-tutorial
    await gate(page, 'flagGiveCoins', 1500);                // enough to source

    await page.evaluate(() => (window as any).openFlagshipOrder());
    await expect(page.locator('#flagship-modal')).toBeVisible();
    // customer request → suppliers → pick → planned margin → accept → review
    await page.locator('[data-flag="suppliers"]').click();
    await page.locator('[data-offer="standard"]').click();
    expect((await gate(page, 'flagStep')).step).toBe('plan');
    // planned margin is shown before committing (req 3)
    await expect(page.locator('#flagship-modal')).toContainText(/Planned margin/i);
    await page.locator('[data-flag="accept"]').click();
    expect((await gate(page, 'flagStep')).step).toBe('review');
    // the review itemises the full P&L (req 7)
    const modal = page.locator('#flagship-modal');
    await expect(modal).toContainText(/Quoted revenue/i);
    await expect(modal).toContainText(/Actual revenue/i);
    await expect(modal).toContainText(/Material cost/i);
    await expect(modal).toContainText(/Logistics cost/i);
    await expect(modal).toContainText(/Quality cost/i);
    await expect(modal).toContainText(/Profit/i);
    await expect(modal).toContainText(/satisfaction/i);
    // it's a one-time authored order
    const st = await gate(page, 'flagState');
    expect(st.done).toBe(true);
  });

  test('best / late / defective / loss outcomes settle through the wallet, safely', async ({ page }) => {
    await startAndFinishTutorial(page);
    await gate(page, 'flagGiveCoins', 5000);                // headroom so every outcome is affordable

    const best   = await gate(page, 'flagSim', 'standard', 'van', 'best');
    const late   = await gate(page, 'flagSim', 'budget',   'van', 'late');
    const defect = await gate(page, 'flagSim', 'standard', 'van', 'defect');
    const loss   = await gate(page, 'flagSim', 'premium',  'courier', 'loss');

    // BEST — full revenue, real profit, top satisfaction; coins moved by the profit
    expect(best.grade).toBe('excellent');
    expect(best.actualRevenue).toBe(best.quotedRevenue);
    expect(best.profit).toBeGreaterThan(0);
    expect(best.coinDelta).toBe(best.profit);

    // LATE — a penalty cut the revenue below quote, but still profitable here
    expect(late.onTime).toBe(false);
    expect(late.actualRevenue).toBeLessThan(late.quotedRevenue);

    // DEFECTIVE — quality reduced value; a loss framed as a lesson
    expect(defect.actualRevenue).toBeLessThan(defect.quotedRevenue);
    expect(defect.satisfaction).toBeLessThan(100);

    // LOSS — genuine loss, but goodwill floor keeps revenue > 0 (safe recovery, req 8)
    expect(loss.profit).toBeLessThan(0);
    expect(loss.learning).toBe(true);
    expect(loss.actualRevenue).toBeGreaterThan(0);
    expect(loss.coinDelta).toBe(loss.profit);              // wallet moved exactly by the (negative) profit

    // and the wallet never went negative through any of it
    const finalCoins = (await gate(page, 'flagState')).coins;
    expect(finalCoins).toBeGreaterThanOrEqual(0);
  });
});
