import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * CONTRACT DELIVERY, PROFIT REVIEW & REPLAYABILITY
 * -----------------------------------------------------------------------------
 * The flagship slice closes cleanly across many runs and many strategies; every
 * settlement reconciles to the penny; the nine no-PII analytics events fire; and
 * the post-order review shows the journey, the settlement and an alternative.
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
const now = (page: Page) => gate(page, 'c2cGameNow');
const bal = (page: Page) => page.evaluate(() => (window as any).__gate.wallet(1).balance);
async function start(page: Page) {
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 20000 });
  const hint = page.locator('#play-hint-overlay');
  if (await hint.count()) { const b = hint.locator('button'); if (await b.count()) await b.first().click().catch(()=>{}); }
  await gate(page, 'flagGiveCoins', 20000);
  await gate(page, 'c2cFreezeClock', true);
}
async function warp(page: Page, mins: number) { await gate(page, 'c2cAdvanceClock', mins); for (let i = 0; i < 10; i++) await gate(page, 'c2cTick'); }
async function waitStage(page: Page, stage: string) { await expect.poll(async () => (await gate(page, 'c2cState'))?.stage, { timeout: 9000 }).toBe(stage); }

// One clean run of the trailer scenario with a chosen supplier + batch. Returns
// the closed snapshot, the settlement, and the real cash delta.
type Strat = { supplier: string; batch: string; gather?: number; inbound?: 'standard'|'expedited'; rework?: boolean };
async function runOrder(page: Page, s: Strat) {
  await gate(page, 'c2cStartScenario', 'trailer');
  if (s.gather) await gate(page, 'c2cGiveMaterial', 'iron_bar', s.gather);   // stock to gather from
  const c0 = await bal(page);
  const buyQty = Math.max(0, 14 - (s.gather || 0));
  await gate(page, 'c2cAction', { type: 'accept_request' });
  await gate(page, 'c2cAction', { type: 'accept_quote' });
  await gate(page, 'c2cAction', { type: 'select_supplier', offerId: s.supplier, qty: buyQty, deliveryId: 'van' });
  await gate(page, 'c2cAction', { type: 'set_sourcing', gatherQty: s.gather || 0, mode: s.inbound || 'standard' });
  await gate(page, 'c2cAction', { type: 'raise_po', now: await now(page) });
  await warp(page, 24);
  await waitStage(page, 'materials_accepted_or_quarantined');
  await gate(page, 'c2cAction', { type: 'resolve_materials', quarantine: 'hold' });
  await gate(page, 'c2cAction', { type: 'run_production', mode: s.batch, now: await now(page) });
  await warp(page, 24);
  await waitStage(page, 'dispatch_decision');
  await gate(page, 'c2cAction', { type: 'dispatch', rework: !!s.rework, now: await now(page) });
  await warp(page, 10);
  await waitStage(page, 'invoiced');
  await gate(page, 'c2cAction', { type: 'send_invoice', now: await now(page) });
  await warp(page, 20);
  const st = await gate(page, 'c2cState');
  const settle = await gate(page, 'c2cSettlement');
  const delta = (await bal(page)) - c0;
  return { st, settle, delta };
}

test.describe('Delivery, settlement & replayability', () => {
  test('ten consecutive clean-save runs all close and reconcile to the penny', async ({ page }) => {
    test.setTimeout(180_000);
    await start(page);
    for (let i = 0; i < 10; i++) {
      const { st, settle, delta } = await runOrder(page, { supplier: 'standard', batch: 'standard' });
      expect(st.stage, `run ${i} closed`).toBe('closed');
      expect(st.fin.deliveredToCustomer, `run ${i} delivered`).toBeGreaterThan(0);
      // revenue − costs == profit == the real cash movement, every single time
      expect(settle.grossProfit).toBe(settle.revenue.net - settle.costs.total);
      expect(delta, `run ${i} cash reconciles`).toBe(settle.grossProfit);
      // the closed order is cleared via the review's Done button (repeatable)
      await gate(page, 'c2cRender');
      await gate(page, 'c2cClick', 'done');
      expect((await gate(page, 'c2cState'))).toBeNull();
    }
  });

  test('completable via four meaningfully different strategies, all reconciling', async ({ page }) => {
    test.setTimeout(120_000);
    await start(page);
    const strategies: Strat[] = [
      { supplier: 'budget', batch: 'fast' },                          // cheap + fast
      { supplier: 'premium', batch: 'careful' },                      // premium + careful
      { supplier: 'standard', batch: 'standard', inbound: 'expedited' }, // expedited freight
      { supplier: 'standard', batch: 'careful', gather: 6 },          // gather-your-own
    ];
    const margins: number[] = [];
    for (const s of strategies) {
      const { st, settle, delta } = await runOrder(page, s);
      expect(st.stage).toBe('closed');
      expect(delta).toBe(settle.grossProfit);
      margins.push(settle.marginPct);
      await gate(page, 'c2cRender');
      await gate(page, 'c2cClick', 'done');
    }
    // the four strategies produced genuinely different economics
    expect(new Set(margins.map(m => Math.round(m * 100))).size).toBeGreaterThan(1);
  });

  test('the nine no-PII analytics events all fire across one full run', async ({ page }) => {
    await start(page);
    await gate(page, 'c2cResetAnalytics');
    // use a disrupted order so a disruption_response naturally occurs
    await gate(page, 'c2cStartDisruption', 'supplier_delay');
    await gate(page, 'c2cAction', { type: 'accept_request' });
    await gate(page, 'c2cAction', { type: 'accept_quote' });
    await gate(page, 'c2cAction', { type: 'select_supplier', offerId: 'standard', qty: 14, deliveryId: 'van' });
    await gate(page, 'c2cAction', { type: 'raise_po', now: await now(page) });
    await gate(page, 'c2cAction', { type: 'intervene', kind: 'chase', now: await now(page) });   // disruption_response
    await warp(page, 30);
    await waitStage(page, 'materials_accepted_or_quarantined');
    await gate(page, 'c2cAction', { type: 'resolve_materials', quarantine: 'hold' });
    await gate(page, 'c2cAction', { type: 'run_production', mode: 'careful', now: await now(page) });
    await warp(page, 30);
    await waitStage(page, 'dispatch_decision');
    await gate(page, 'c2cAction', { type: 'dispatch', rework: false, now: await now(page) });
    await warp(page, 10);
    await waitStage(page, 'invoiced');
    await gate(page, 'c2cAction', { type: 'send_invoice', now: await now(page) });
    await warp(page, 20);
    const a = await gate(page, 'c2cAnalytics');
    for (const ev of ['flagship_opened','quotation_reviewed','supplier_selected','production_strategy_selected','disruption_response','quality_decision','delivered','final_margin'])
      expect(a.counts[ev], `event ${ev} fired`).toBeGreaterThanOrEqual(1);
  });

  test('abandoning an order emits the abandoned event', async ({ page }) => {
    await start(page);
    await gate(page, 'c2cResetAnalytics');
    await gate(page, 'c2cStartScenario', 'trailer');
    await gate(page, 'c2cAction', { type: 'accept_request' });
    await gate(page, 'c2cAbandon');
    const a = await gate(page, 'c2cAnalytics');
    expect(a.counts['abandoned']).toBeGreaterThanOrEqual(1);
  });

  test('the post-order review shows the journey rail, settlement and an alternative', async ({ page }) => {
    await start(page);
    await runOrder(page, { supplier: 'standard', batch: 'standard' });
    // draw the closed-order review (gate actions bypass the UI, so force a render)
    await gate(page, 'c2cRender');
    await expect.poll(async () => gate(page, 'c2cModalText'), { timeout: 6000 }).toContain('Order Review');
    const txt: string = await gate(page, 'c2cModalText');
    for (const field of ['Customer', 'Supplier', 'Production', 'Quality', 'Delivery', 'Your key decisions', 'Why:', 'Revenue', 'Total cost', 'Gross profit', 'Another way to play it'])
      expect(txt, `review shows ${field}`).toContain(field);
  });
});
