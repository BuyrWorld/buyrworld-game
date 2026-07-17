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
  test('the live pipeline modal drives the engine through every stage to the P&L review', async ({ page }) => {
    await startAndFinishTutorial(page);
    expect(await gate(page, 'flagAvailable')).toBe(true);   // authored order available post-tutorial
    await gate(page, 'flagGiveCoins', 2000);                // enough to source
    await gate(page, 'c2cFreezeClock', true);               // deterministic game-time for the test

    await page.evaluate(() => (window as any).openFlagshipOrder());
    const modal = page.locator('#flagship-modal');
    await expect(modal).toBeVisible();

    // customer_request → quotation_review → supplier_selection
    await modal.locator('[data-c2c="accept_request"]').click();
    await modal.locator('[data-c2c="accept_quote"]').click();
    await modal.locator('[data-c2coffer="standard"]').click();
    await expect(modal).toContainText(/Planned margin/i);   // shown before committing
    await modal.locator('[data-c2c="commit_po"]').click();  // select_supplier + raise_po

    // supplier_in_progress → … → materials (advance the clock; the sim loop ticks it through)
    await gate(page, 'c2cForceRolls', { supplierOnTime: true });
    await gate(page, 'c2cAdvanceClock', 8);
    await modal.locator('[data-c2c="resolve:hold"]').click({ timeout: 10000 });   // goods-in QC
    await modal.locator('[data-c2c="run_production"]').click({ timeout: 10000 }); // production
    await modal.locator('[data-c2c="dispatch"]').click({ timeout: 10000 });       // final QC → dispatch

    await gate(page, 'c2cAdvanceClock', 6);                 // outbound transit
    await modal.locator('[data-c2c="send_invoice"]').click({ timeout: 10000 });   // delivered → invoice
    await gate(page, 'c2cAdvanceClock', 2);                 // payment settles

    // the review itemises the full planned-vs-actual P&L
    await expect(modal).toContainText(/Order Review/i, { timeout: 10000 });
    await expect(modal).toContainText(/Revenue/i);
    await expect(modal).toContainText(/Material/i);
    await expect(modal).toContainText(/Inbound logistics/i);
    await expect(modal).toContainText(/Outbound logistics/i);
    await expect(modal).toContainText(/Gross profit/i);
    await expect(modal).toContainText(/satisfaction/i);
    expect((await gate(page, 'flagStep')).step).toBe('closed');
    // a performance record was written for the history view
    expect((await gate(page, 'c2cHistory')).length).toBe(1);

    await modal.locator('[data-c2c="done"]').click();
    expect((await gate(page, 'flagState')).done).toBe(true);

    // the performance-history view surfaces the closed order + supplier record
    await page.evaluate(() => (window as any).openC2CHistory());
    const hist = page.locator('#c2c-history-modal');
    await expect(hist).toBeVisible();
    await expect(hist).toContainText('Featherstone Rail Yard');
    await expect(hist).toContainText(/Supplier performance/i);
    await expect(hist).toContainText(/Margin/i);
    await hist.locator('#c2c-hist-ok').click();

    // REPEATABLE: the order is available again and opening it starts a fresh one,
    // while the completed order stays in the history.
    expect(await gate(page, 'flagAvailable')).toBe(true);
    await page.evaluate(() => (window as any).openFlagshipOrder());
    expect((await gate(page, 'flagStep')).step).toBe('customer_request');
    expect((await gate(page, 'c2cHistory')).length).toBe(1);
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
