import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * PLAYABLE PROCUREMENT & SUPPLIER SELECTION
 * -----------------------------------------------------------------------------
 * Three viable strategies with measurably different margin/risk, driven through
 * the live pipeline modal; reload safe before + after PO confirmation; the
 * supplier scorecard updates; cash reconciles exactly (no double-deduct).
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
async function softReload(page: Page) {
  let lastErr: unknown;
  for (let a = 0; a < 4; a++) {
    try { await page.reload({ waitUntil: 'commit', timeout: 45_000 }); await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 45_000 }); await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 20_000 }); return; }
    catch (e) { lastErr = e; }
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
async function warp(page: Page, mins: number) { await gate(page, 'c2cAdvanceClock', mins); for (let i = 0; i < 8; i++) await gate(page, 'c2cTick'); }
async function waitStage(page: Page, stage: string) { await expect.poll(async () => (await gate(page, 'c2cState'))?.stage, { timeout: 8000 }).toBe(stage); }

// Drive one procurement strategy to close, return the closed snapshot + cash delta.
async function runStrategy(page: Page, opts: { supplier: string; qty: number; gather?: number; mode?: 'standard'|'expedited' }) {
  await gate(page, 'c2cStartScenario', 'trailer');
  const c0 = await bal(page);
  await gate(page, 'c2cAction', { type: 'accept_request' });
  await gate(page, 'c2cAction', { type: 'accept_quote' });
  await gate(page, 'c2cAction', { type: 'select_supplier', offerId: opts.supplier, qty: opts.qty, deliveryId: 'van' });
  await gate(page, 'c2cAction', { type: 'set_sourcing', gatherQty: opts.gather || 0, mode: opts.mode || 'standard' });
  await gate(page, 'c2cAction', { type: 'raise_po', now: await now(page) });
  await warp(page, 16);
  await waitStage(page, 'materials_accepted_or_quarantined');
  await gate(page, 'c2cAction', { type: 'resolve_materials', quarantine: 'hold' });
  await gate(page, 'c2cAction', { type: 'run_production' });
  await warp(page, 2);
  await waitStage(page, 'dispatch_decision');
  await gate(page, 'c2cAction', { type: 'dispatch', rework: false, now: await now(page) });
  await warp(page, 6);
  await waitStage(page, 'invoiced');
  await gate(page, 'c2cAction', { type: 'send_invoice', now: await now(page) });
  await warp(page, 4);
  const s = await gate(page, 'c2cState');
  expect(s.stage).toBe('closed');
  const delta = (await bal(page)) - c0;
  expect(delta).toBe(s.actual.grossProfit);   // cash reconciles exactly — no double-deduct
  return { s, delta };
}

test.describe('Playable procurement', () => {
  test('three strategies produce measurably different margins and reconcile', async ({ page }) => {
    await start(page);
    const cheap = await runStrategy(page, { supplier: 'budget', qty: 14 });        // cheap, risky
    const premium = await runStrategy(page, { supplier: 'premium', qty: 12 });      // dear, safe
    await gate(page, 'c2cGiveMaterial', 'iron_bar', 6);                             // own 6 bars…
    const mix = await runStrategy(page, { supplier: 'standard', qty: 6, gather: 6 }); // …gather + buy 6
    const margins = [cheap.s.actual.grossProfit, premium.s.actual.grossProfit, mix.s.actual.grossProfit];
    expect(new Set(margins).size).toBe(3);                                          // all three differ
    // the gather-mix banked the least material cash (owned half the bars)
    expect(mix.s.actual.materialCost).toBeLessThan(cheap.s.actual.materialCost);
    expect(mix.s.actual.materialCost).toBeLessThan(premium.s.actual.materialCost);
  });

  test('the order survives a reload before AND after PO confirmation', async ({ page }) => {
    await start(page);
    await gate(page, 'c2cStartScenario', 'trailer');
    await gate(page, 'c2cAction', { type: 'accept_request' });
    await gate(page, 'c2cAction', { type: 'accept_quote' });
    await gate(page, 'c2cAction', { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    // BEFORE confirmation (PO drafted, not raised)
    await softReload(page);
    let s = await gate(page, 'c2cState');
    expect(s.stage).toBe('purchase_order_raised');
    expect(s.po.qty).toBe(12);
    // confirm, then reload AFTER
    await gate(page, 'c2cFreezeClock', true);
    await gate(page, 'c2cAction', { type: 'set_sourcing', gatherQty: 0, mode: 'expedited' });
    await gate(page, 'c2cAction', { type: 'raise_po', now: await now(page) });
    await softReload(page);
    s = await gate(page, 'c2cState');
    expect(['supplier_in_progress','inbound_transport','goods_received','goods_in_qc','materials_accepted_or_quarantined']).toContain(s.stage);
    expect(s.po.qty).toBe(12);   // the committed PO persisted intact
  });

  test('the supplier scorecard updates after an order', async ({ page }) => {
    await start(page);
    expect(await gate(page, 'c2cSupplierScore')).toEqual({});
    await runStrategy(page, { supplier: 'premium', qty: 12 });
    const score = await gate(page, 'c2cSupplierScore');
    expect(score.premium).toBeTruthy();
    expect(score.premium.orders).toBe(1);
  });

  test('the compare screen reads clearly: best-for tags, scorecard, one-time Frosty', async ({ page }) => {
    await start(page);
    await gate(page, 'c2cStartScenario', 'trailer');
    await gate(page, 'c2cAction', { type: 'accept_request' });
    await gate(page, 'c2cAction', { type: 'accept_quote' });
    // the supplier-compare card renders; wait for it then read its text
    await expect.poll(async () => gate(page, 'c2cModalText'), { timeout: 6000 }).toContain('Compare Suppliers');
    const txt = await gate(page, 'c2cModalText');
    expect(txt).toMatch(/Cheapest|Most reliable|Greenest/);   // best-for tags
    expect(txt).toContain('capacity');                         // capacity shown
    expect(txt).toMatch(/no history yet|on-time/);             // scorecard line
    expect(txt).toContain('Frosty');                           // one-time guidance
    expect(await gate(page, 'c2cSeenProcTip')).toBe(true);
  });
});
