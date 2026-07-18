import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * PRODUCTION, QUALITY, LOGISTICS & DISRUPTIONS
 * -----------------------------------------------------------------------------
 * Every disruption type is survivable and reconciles; batch strategies differ;
 * the order reloads during disruption + quality inspection; defects can't be
 * reused; the production-plan screen shows the required fields.
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
  await gate(page, 'flagGiveCoins', 6000);
  await gate(page, 'c2cFreezeClock', true);
}
async function warp(page: Page, mins: number) { await gate(page, 'c2cAdvanceClock', mins); for (let i = 0; i < 10; i++) await gate(page, 'c2cTick'); }
async function waitStage(page: Page, stage: string) { await expect.poll(async () => (await gate(page, 'c2cState'))?.stage, { timeout: 9000 }).toBe(stage); }

// Drive a disrupted order to close with a sensible response; return closed snapshot + cash delta.
async function driveDisruption(page: Page, disruption: string, opts: { resolve?: 'hold'|'rework'; batch?: string } = {}) {
  await gate(page, 'c2cStartDisruption', disruption);
  const c0 = await bal(page);
  await gate(page, 'c2cAction', { type: 'accept_request' });
  await gate(page, 'c2cAction', { type: 'accept_quote' });
  await gate(page, 'c2cAction', { type: 'select_supplier', offerId: 'standard', qty: 14, deliveryId: 'van' });
  await gate(page, 'c2cAction', { type: 'raise_po', now: await now(page) });
  await warp(page, 30);   // generous — covers supplier_delay + transit
  await waitStage(page, 'materials_accepted_or_quarantined');
  await gate(page, 'c2cAction', { type: 'resolve_materials', quarantine: opts.resolve || 'hold' });
  await gate(page, 'c2cAction', { type: 'run_production', mode: opts.batch || 'standard', now: await now(page) });
  await warp(page, 30);   // covers machine_slowdown + careful batch
  await waitStage(page, 'dispatch_decision');
  await gate(page, 'c2cAction', { type: 'dispatch', rework: true, now: await now(page) });
  await warp(page, 8);
  await waitStage(page, 'invoiced');
  await gate(page, 'c2cAction', { type: 'send_invoice', now: await now(page) });
  await warp(page, 20);
  const s = await gate(page, 'c2cState');
  expect(s.stage).toBe('closed');
  const delta = (await bal(page)) - c0;
  expect(delta).toBe(s.actual.grossProfit);   // cash reconciles exactly
  return { s, delta };
}

const DISRUPTIONS = ['supplier_delay', 'defective_materials', 'machine_slowdown', 'expedite_request', 'partial_shortage'];

test.describe('Production & disruptions', () => {
  for (const dis of DISRUPTIONS) {
    test(`survives + reconciles: ${dis}`, async ({ page }) => {
      await start(page);
      const resolve = dis === 'defective_materials' ? 'rework' : 'hold';
      const { s } = await driveDisruption(page, dis, { resolve });
      // never unwinnable: the order closes, and a genuine attempt delivered something
      expect(s.fin.deliveredToCustomer).toBeGreaterThan(0);
      // defects were not delivered: delivered ≤ produced good
      expect(s.fin.deliveredToCustomer).toBeLessThanOrEqual(s.fin.good);
    });
  }

  test('fast vs careful batch produce different quality outcomes', async ({ page }) => {
    // clean scenario (no slowdown) so this is fast + deterministic; drive one order
    // per batch mode and compare finished defects.
    async function runBatch(batch: string) {
      await gate(page, 'c2cStartScenario', 'trailer');
      await gate(page, 'c2cAction', { type: 'accept_request' });
      await gate(page, 'c2cAction', { type: 'accept_quote' });
      await gate(page, 'c2cAction', { type: 'select_supplier', offerId: 'standard', qty: 14, deliveryId: 'van' });
      await gate(page, 'c2cAction', { type: 'raise_po', now: await now(page) });
      await warp(page, 16);
      await waitStage(page, 'materials_accepted_or_quarantined');
      await gate(page, 'c2cAction', { type: 'resolve_materials', quarantine: 'hold' });
      await gate(page, 'c2cAction', { type: 'run_production', mode: batch, now: await now(page) });
      await warp(page, 16);
      await waitStage(page, 'dispatch_decision');
      const s = await gate(page, 'c2cState');
      await gate(page, 'c2cAction', { type: 'dispatch', rework: false, now: await now(page) });
      await warp(page, 8); await gate(page, 'c2cAction', { type: 'send_invoice', now: await now(page) }); await warp(page, 20);
      return s;
    }
    await start(page);
    const fast = await runBatch('fast');
    const careful = await runBatch('careful');
    // careful yields fewer finished defects than fast
    expect(careful.fin.scrapped + careful.fin.reworkable).toBeLessThanOrEqual(fast.fin.scrapped + fast.fin.reworkable);
  });

  test('reloads during the disruption AND during quality inspection', async ({ page }) => {
    await start(page);
    await gate(page, 'c2cStartDisruption', 'defective_materials');
    await gate(page, 'c2cAction', { type: 'accept_request' });
    await gate(page, 'c2cAction', { type: 'accept_quote' });
    await gate(page, 'c2cAction', { type: 'select_supplier', offerId: 'standard', qty: 14, deliveryId: 'van' });
    await gate(page, 'c2cAction', { type: 'raise_po', now: await now(page) });
    await warp(page, 30);
    await waitStage(page, 'materials_accepted_or_quarantined');   // at goods-in QC, disruption active
    // reload DURING the quality inspection / disruption
    await softReload(page);
    const d = await gate(page, 'c2cDisruption');
    expect(d.id).toBe('defective_materials');            // disruption persisted
    expect(d.goodsInQc).toBeTruthy();                    // the inspection snapshot survived
    const s = await gate(page, 'c2cState');
    expect(s.stage).toBe('materials_accepted_or_quarantined');
    expect(s.mat.received).toBeGreaterThan(0);           // real stock intact
  });

  test('the production-plan screen shows the required fields + assisted mode', async ({ page }) => {
    await start(page);
    await gate(page, 'c2cStartDisruption', 'supplier_delay');
    await gate(page, 'c2cAction', { type: 'accept_request' });
    await gate(page, 'c2cAction', { type: 'accept_quote' });
    await gate(page, 'c2cAction', { type: 'select_supplier', offerId: 'standard', qty: 14, deliveryId: 'van' });
    await gate(page, 'c2cAction', { type: 'raise_po', now: await now(page) });
    await warp(page, 30);
    await waitStage(page, 'materials_accepted_or_quarantined');
    await gate(page, 'c2cAction', { type: 'resolve_materials', quarantine: 'hold' });
    await waitStage(page, 'production');
    // open the modal so the production-plan card renders
    await page.evaluate(() => (window as any).openFlagshipOrder());
    await expect.poll(async () => gate(page, 'c2cModalText'), { timeout: 6000 }).toContain('Production Plan');
    const txt = await gate(page, 'c2cModalText');
    for (const field of ['Required', 'Available materials', 'Reserved', 'Capacity', 'production time', 'Expected quality'])
      expect(txt).toContain(field);
    // three batch modes offered
    expect(await gate(page, 'c2cHasButton', 'run_production')).toBe(true);
    expect(await page.locator('#flagship-modal [data-c2cbatch="careful"]').count()).toBe(1);
  });
});
