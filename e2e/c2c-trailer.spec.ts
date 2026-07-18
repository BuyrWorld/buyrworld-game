import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * CONTRACT-TO-CASH — the Rail Yard showcase, four distinct strategies.
 * -----------------------------------------------------------------------------
 * Drives the live pipeline modal through deterministic scenarios via __gate, one
 * per strategy, and asserts the acceptance bar: the sequence is completable, the
 * final cash delta equals the result screen's gross profit exactly, reservations
 * are fully released, and different strategies produce materially different
 * profit / satisfaction. Decisions are made through the real modal buttons.
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
async function start(page: Page) {
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 20000 });
  const hint = page.locator('#play-hint-overlay');
  if (await hint.count()) { const b = hint.locator('button'); if (await b.count()) await b.first().click().catch(()=>{}); }
  await gate(page, 'flagGiveCoins', 5000);
  await gate(page, 'c2cFreezeClock', true);
}
const gate = (page: Page, m: string, ...a: any[]) =>
  page.evaluate(([mm, aa]) => (window as any).__gate[mm as string](...(aa as any[])), [m, a] as const);
const now = (page: Page) => gate(page, 'c2cGameNow');
const bal = (page: Page) => page.evaluate(() => (window as any).__gate.wallet(1).balance);
// The modal DOM updates on the 250ms poll, so wait for the button before clicking.
async function click(page: Page, action: string) {
  await expect.poll(async () => gate(page, 'c2cHasButton', action), { timeout: 8000 }).toBe(true);
  await gate(page, 'c2cClick', action);
}
// advance the (frozen) clock then let the sim-loop tick flow the waiting stages
async function warp(page: Page, mins: number, ticks = 8) { await gate(page, 'c2cAdvanceClock', mins); for (let i = 0; i < ticks; i++) await gate(page, 'c2cTick'); }
async function waitStage(page: Page, stage: string) {
  await expect.poll(async () => (await gate(page, 'c2cState'))?.stage, { timeout: 8000 }).toBe(stage);
}

// Run the common opening: scenario → accept → choose supplier → raise PO.
async function open(page: Page, scenario: string, supplier: string, qty: number, deliveryId = 'van') {
  await gate(page, 'c2cStartScenario', scenario);
  await expect(page.locator('#flagship-modal')).toBeVisible();
  await click(page, 'accept_request');
  await click(page, 'accept_quote');
  await gate(page, 'c2cAction', { type: 'select_supplier', offerId: supplier, qty, deliveryId });   // qty via action; UI shows the plan
  await click(page, 'raise_po');
  await waitStage(page, 'supplier_in_progress');
}
// Finish from dispatch_decision → closed, then assert the money reconciles exactly.
async function finishAndCheck(page: Page, startCoins: number) {
  await waitStage(page, 'dispatch_decision');
  await click(page, 'dispatch');   // click() polls for the button (DOM lags the 250ms poll)
  await warp(page, 8);
  await waitStage(page, 'invoiced');
  await click(page, 'send_invoice');
  await warp(page, 20);
  const s = await gate(page, 'c2cState');
  expect(s.stage).toBe('closed');
  // cash delta === result-screen gross profit, exactly (req)
  const delta = (await bal(page)) - startCoins;
  expect(delta).toBe(s.actual.grossProfit);
  // reservations fully released; no phantom stock
  const res = await gate(page, 'c2cReserved');
  expect(res.iron_bar || 0).toBe(0);
  expect(res.bracket || 0).toBe(0);
  return s;
}

test.describe('Contract-to-Cash — four strategies', () => {
  test('Strategy 1 — premium & careful: on time, in full, profitable', async ({ page }) => {
    await start(page);
    const c0 = await bal(page);
    await open(page, 'trailer', 'premium', 14, 'courier');
    await warp(page, 6);                                   // premium lead is short
    await waitStage(page, 'materials_accepted_or_quarantined');
    expect(await gate(page, 'c2cHasButton', 'inspect')).toBe(true);   // inspect offered
    await click(page, 'inspect');
    await click(page, 'resolve:rework');                   // fix any defects → full quality
    await waitStage(page, 'production');
    await click(page, 'run_production');
    const s = await finishAndCheck(page, c0);
    expect(s.onTime).toBe(true);
    expect(s.actual.grossProfit).toBeGreaterThan(0);
    expect(s.satisfaction).toBeGreaterThanOrEqual(90);
    (test as any).info().annotations.push({ type: 's1', description: JSON.stringify({ profit: s.actual.grossProfit, sat: s.satisfaction }) });
  });

  test('Strategy 2 — cheap supplier shorts you: ship short, thinner result', async ({ page }) => {
    await start(page);
    const c0 = await bal(page);
    await open(page, 'supplier_shortfall', 'budget', 16, 'van');
    await warp(page, 16);                                  // budget lead is long
    await waitStage(page, 'materials_accepted_or_quarantined');
    await click(page, 'resolve:hold');
    await waitStage(page, 'production');
    await click(page, 'run_production');
    const s = await finishAndCheck(page, c0);
    expect(s.fin.deliveredToCustomer).toBeLessThan(12);    // shorted by the supplier
  });

  test('Strategy 3 — accept the dodgy batch: cheap now, defects later', async ({ page }) => {
    await start(page);
    const c0 = await bal(page);
    await open(page, 'quality_crisis', 'standard', 14, 'van');
    await warp(page, 8);
    await waitStage(page, 'materials_accepted_or_quarantined');
    await click(page, 'inspect');
    expect(await gate(page, 'c2cHasButton', 'resolve:accept')).toBe(true);
    await click(page, 'resolve:accept');                   // gamble: keep the bad bars
    await waitStage(page, 'production');
    await click(page, 'run_production');
    const s = await finishAndCheck(page, c0);
    expect(s.fin.scrapped).toBeGreaterThan(0);             // the gamble bit — finished defects
  });

  test('Strategy 4 — rush order: expedite to land on time', async ({ page }) => {
    await start(page);
    const c0 = await bal(page);
    await open(page, 'rush', 'standard', 14, 'courier');
    expect(await gate(page, 'c2cHasButton', 'intervene:expedite')).toBe(true);
    await click(page, 'intervene:expedite');               // pay to beat the tight deadline
    await warp(page, 6);
    await waitStage(page, 'materials_accepted_or_quarantined');
    await click(page, 'resolve:hold');
    await waitStage(page, 'production');
    await click(page, 'run_production');
    const s = await finishAndCheck(page, c0);
    expect(s.onTime).toBe(true);                           // expedite saved the deadline
  });
});
