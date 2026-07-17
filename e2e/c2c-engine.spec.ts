import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * CONTRACT-TO-CASH STATE ENGINE — integration (wiring) tests.
 * -----------------------------------------------------------------------------
 * The pure 17-stage engine is unit-tested in tests/c2cEngine.test.ts. Here we
 * drive the PERSISTED engine through the real main.ts adapter to prove the wiring:
 * goods receipt / production / dispatch make real inventory movements, materials
 * are reserved against the shared inventory, the state survives a refresh at a
 * mid-pipeline stage (persistence + migration), and payment settles exactly once.
 * Driven through __gate.c2c* — the same production adapter the game uses.
 */
const SAVE_KEY = 'buyrworld_game_save_v1';
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
}
const gate = (page: Page, m: string, ...a: any[]) =>
  page.evaluate(([mm, aa]) => (window as any).__gate[mm as string](...(aa as any[])), [m, a] as const);
const now = (page: Page) => gate(page, 'c2cGameNow');

test.describe('Contract-to-Cash engine wiring', () => {
  test('drives the pipeline through the real inventory + wallet, survives a refresh, pays once', async ({ page }) => {
    await start(page);
    await gate(page, 'flagGiveCoins', 3000);
    await gate(page, 'c2cFreezeClock', true);                        // deterministic game-time
    let s = await gate(page, 'c2cStart', 'on_delivery', { base: true });   // pin the canonical order for exact-number assertions
    expect(s.stage).toBe('customer_request');

    await gate(page, 'c2cAction', { type: 'accept_request' });
    await gate(page, 'c2cAction', { type: 'accept_quote' });
    await gate(page, 'c2cAction', { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    expect((await gate(page, 'c2cState')).stage).toBe('purchase_order_raised');

    const coinsBefore = (await gate(page, 'c2cInv')) && (await page.evaluate(() => (window as any).__gate.wallet(1).balance));
    await gate(page, 'c2cAction', { type: 'raise_po', now: await now(page) });
    await gate(page, 'c2cForceRolls', { supplierOnTime: true });     // deterministic clean receipt
    await gate(page, 'c2cAdvanceClock', 12);                          // jump past lead + inbound
    for (let i = 0; i < 6; i++) await gate(page, 'c2cTick');
    s = await gate(page, 'c2cState');
    expect(s.stage).toBe('materials_accepted_or_quarantined');
    // real inbound inventory movement + reservation
    expect((await gate(page, 'c2cInv')).iron_bar).toBe(12);
    expect((await gate(page, 'c2cAvailable', 'iron_bar'))).toMatchObject({ total: 12, reserved: 12, available: 0 });

    // --- refresh mid-pipeline: stage + reservations must persist (migration) ---
    await softReload(page);
    await gate(page, 'c2cFreezeClock', true);                        // window flag resets on reload
    s = await gate(page, 'c2cState');
    expect(s.stage).toBe('materials_accepted_or_quarantined');
    expect((await gate(page, 'c2cReserved')).iron_bar).toBe(12);
    expect((await gate(page, 'c2cInv')).iron_bar).toBe(12);

    await gate(page, 'c2cAction', { type: 'resolve_materials', quarantine: 'hold' });
    await gate(page, 'c2cAction', { type: 'run_production' });
    // material consumed, finished goods created (real movements)
    expect((await gate(page, 'c2cInv'))).toMatchObject({ iron_bar: 0, bracket: 12 });
    expect((await gate(page, 'c2cAvailable', 'bracket'))).toMatchObject({ reserved: 12, available: 0 });

    for (let i = 0; i < 3; i++) await gate(page, 'c2cTick');          // final QC → dispatch decision
    expect((await gate(page, 'c2cState')).stage).toBe('dispatch_decision');
    await gate(page, 'c2cAction', { type: 'dispatch', rework: false, now: await now(page) });
    expect((await gate(page, 'c2cInv')).bracket).toBe(0);             // shipped out of inventory

    await gate(page, 'c2cAdvanceClock', 6);
    for (let i = 0; i < 3; i++) await gate(page, 'c2cTick');          // outbound → delivered → invoiced
    expect((await gate(page, 'c2cState')).stage).toBe('invoiced');
    await gate(page, 'c2cAction', { type: 'send_invoice', now: await now(page) });
    for (let i = 0; i < 3; i++) await gate(page, 'c2cTick');          // paid → closed
    s = await gate(page, 'c2cState');
    expect(s.stage).toBe('closed');
    expect(s.actual.revenue).toBe(1200);
    expect(s.actual.grossProfit).toBe(1200 - 12 * 48 - 55 - 30);
    // reservations fully released; a performance record was written
    expect((await gate(page, 'c2cReserved')).iron_bar || 0).toBe(0);
    expect((await gate(page, 'c2cReserved')).bracket || 0).toBe(0);
    expect((await gate(page, 'c2cHistory')).length).toBe(1);

    // extra ticks after close never pay twice
    const bal1 = await page.evaluate(() => (window as any).__gate.wallet(1).balance);
    await gate(page, 'c2cAdvanceClock', 30);
    for (let i = 0; i < 5; i++) await gate(page, 'c2cTick');
    const bal2 = await page.evaluate(() => (window as any).__gate.wallet(1).balance);
    expect(bal2).toBe(bal1);
  });

  test('reserved contract stock cannot be sold out from under the order', async ({ page }) => {
    await start(page);
    await gate(page, 'flagGiveCoins', 3000);
    await gate(page, 'c2cFreezeClock', true);
    await gate(page, 'c2cStart', 'on_delivery', { base: true });
    await gate(page, 'c2cAction', { type: 'accept_request' });
    await gate(page, 'c2cAction', { type: 'accept_quote' });
    await gate(page, 'c2cAction', { type: 'select_supplier', offerId: 'standard', qty: 12, deliveryId: 'van' });
    await gate(page, 'c2cAction', { type: 'raise_po', now: await now(page) });
    await gate(page, 'c2cForceRolls', { supplierOnTime: true });
    await gate(page, 'c2cAdvanceClock', 12);
    for (let i = 0; i < 6; i++) await gate(page, 'c2cTick');
    // 12 bars are physically in inventory but fully reserved to the order
    const a = await gate(page, 'c2cAvailable', 'iron_bar');
    expect(a.total).toBe(12);
    expect(a.reserved).toBe(12);
    expect(a.available).toBe(0);   // nothing free to sell/double-use
  });
});
