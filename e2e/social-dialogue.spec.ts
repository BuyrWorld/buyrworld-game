import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * NPC DIALOGUE / RELATIONSHIP / MEMORY — integration proofs (the 8 scenarios).
 */
const SAVE_KEY = 'buyrworld_game_save_v1';
const gate = (page: Page, m: string, ...a: any[]) =>
  page.evaluate(([mm, aa]) => (window as any).__gate[mm as string](...(aa as any[])), [m, a] as const);
async function cleanLoad(page: Page) {
  let lastErr: unknown;
  for (let a = 0; a < 4; a++) { try {
    await page.goto('/', { waitUntil: 'commit', timeout: 60_000 });
    await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
    await page.reload({ waitUntil: 'commit', timeout: 45_000 });
    await expect(page.locator('#title')).toBeVisible({ timeout: 45_000 }); return;
  } catch (e) { lastErr = e; } }
  throw lastErr;
}
async function start(page: Page) {
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(e.message));
  (page as any)._errs = errs;
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 20000 });
  const hint = page.locator('#play-hint-overlay');
  if (await hint.count()) { const b = hint.locator('button'); if (await b.count()) await b.first().click().catch(()=>{}); }
  await gate(page, 'uiFinishTutorial');
}
// Play a graph from a chosen id to a terminal choice (helper).
async function complete(page: Page, choiceId: string) { await gate(page, 'socComplete'); await gate(page, 'socChoose', choiceId); }

test.describe('NPC dialogue system', () => {
  test('1) Frosty remembers a player promise after save/reload', async ({ page }) => {
    await start(page);
    await gate(page, 'socOpen', 'frosty', 'frosty_promise');
    await gate(page, 'socComplete');
    await gate(page, 'socChoose', 'promise');            // writes the promise memory + flag + followup
    await gate(page, 'socClose');
    expect((await gate(page, 'socMem', 'frosty')).some((m: any) => m.tag?.includes('promise'))).toBe(true);

    // reload — the memory + open promise must survive
    await page.reload({ waitUntil: 'commit', timeout: 45_000 });
    await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 45_000 });
    await page.evaluate(() => { const c = document.getElementById('btn-continue') as HTMLElement; const t = document.getElementById('title'); if (t && getComputedStyle(t).display !== 'none' && c) c.click(); });
    await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 20000 });
    expect((await gate(page, 'socMem', 'frosty')).some((m: any) => m.tag?.includes('promise'))).toBe(true);
    // opening Frosty now selects the follow-up that references the remembered promise
    const opened = await gate(page, 'socOpen', 'frosty');
    expect(opened.graph).toBe('frosty_promise_followup');
    expect((await gate(page, 'socState')).text.toLowerCase()).toContain('word');
    await gate(page, 'socClose');
    expect((page as any)._errs).toHaveLength(0);
  });

  test('2) a supplier-shortage choice unlocks a later opportunity', async ({ page }) => {
    await start(page);
    // before covering the shortfall, the priority-freight offer is not selectable
    expect(await gate(page, 'socFlag', 'perry_helped')).toBe(false);
    await gate(page, 'socOpen', 'perry', 'perry_shortage');
    await gate(page, 'socComplete');
    await gate(page, 'socChoose', 'cover');               // sets perry_helped
    await gate(page, 'socAdvance'); await gate(page, 'socClose');
    expect(await gate(page, 'socFlag', 'perry_helped')).toBe(true);
    // now Perry's priority-freight conversation becomes available (a later choice changed)
    expect((await gate(page, 'socOpen', 'perry')).graph).toBe('perry_priority_freight');
    await gate(page, 'socClose');
  });

  test('3) a witness gains suspicion; unrelated NPCs do not become omniscient', async ({ page }) => {
    await start(page);
    const before = await gate(page, 'socRel', 'edna');
    const w = await gate(page, 'socWitnessCrime', 'perry');
    expect(w.hasCrime).toBe(true);
    expect(w.susp).toBeGreaterThan(0);
    // Edna, who did not witness it, has neither the memory nor raised suspicion
    expect((await gate(page, 'socMem', 'edna')).some((m: any) => m.category === 'crime')).toBe(false);
    expect((await gate(page, 'socRel', 'edna')).suspicion).toBe(before.suspicion);
  });

  test('4) a completed request creates the correct follow-up + reward', async ({ page }) => {
    await start(page);
    await gate(page, 'socOpen', 'edna', 'edna_request');
    await gate(page, 'socComplete');
    await gate(page, 'socChoose', 'promise');             // schedules edna_request_followup
    await gate(page, 'socClose');
    await gate(page, 'socGiveItem', 'vase', 1);
    expect((await gate(page, 'socOpen', 'edna')).graph).toBe('edna_request_followup');
    const coins0 = await page.evaluate(() => (window as any).__gate.wallet(1).balance);
    await gate(page, 'socComplete');
    await gate(page, 'socChoose', 'give');                // grants +60 coins, takes the vase
    await gate(page, 'socAdvance'); await gate(page, 'socClose');
    const coins1 = await page.evaluate(() => (window as any).__gate.wallet(1).balance);
    expect(coins1 - coins0).toBe(60);
    expect(await gate(page, 'socFlag', 'edna_request_done')).toBe(true);
  });

  test('5) reopening a completed conversation cannot duplicate rewards', async ({ page }) => {
    await start(page);
    await gate(page, 'socOpen', 'edna', 'edna_request'); await gate(page, 'socComplete'); await gate(page, 'socChoose', 'promise'); await gate(page, 'socClose');
    await gate(page, 'socGiveItem', 'vase', 2);
    await gate(page, 'socOpen', 'edna', 'edna_request_followup'); await gate(page, 'socComplete'); await gate(page, 'socChoose', 'give'); await gate(page, 'socAdvance'); await gate(page, 'socClose');
    const coinsAfter1 = await page.evaluate(() => (window as any).__gate.wallet(1).balance);
    // force the same effect again — idempotency must block a second payout
    await gate(page, 'socGiveItem', 'vase', 1);
    await gate(page, 'socOpen', 'edna', 'edna_request_followup'); await gate(page, 'socComplete'); await gate(page, 'socChoose', 'give'); await gate(page, 'socClose');
    const coinsAfter2 = await page.evaluate(() => (window as any).__gate.wallet(1).balance);
    expect(coinsAfter2).toBe(coinsAfter1);                // no duplicate reward
  });

  test('6) urgent dialogue outranks flavour', async ({ page }) => {
    await start(page);
    // meet Frosty (so he's "returning" → flavour eligible), then lapse a contract
    await gate(page, 'socOpen', 'frosty', 'frosty_first'); await gate(page, 'socComplete'); await gate(page, 'socChoose', 'keen'); await gate(page, 'socAdvance'); await gate(page, 'socClose');
    await gate(page, 'socSetExpired');
    expect((await gate(page, 'socOpen', 'frosty')).graph).toBe('frosty_contract_fail');   // priority 2, not flavour (8)
    await gate(page, 'socClose');
  });

  test('7) talking with an active order is optional and never disturbs the order', async ({ page }) => {
    await start(page);
    await gate(page, 'c2cStartScenario', 'trailer');       // an active flagship order
    const stage0 = (await gate(page, 'c2cState'))?.stage;
    // an optional Frosty chat opens and closes without touching the order
    expect((await gate(page, 'socOpen', 'frosty')).ok).toBe(true);
    await gate(page, 'socClose');
    expect((await gate(page, 'c2cState'))?.stage).toBe(stage0);   // order unchanged, still primary
  });

  test('9) tapping Edna or Frosty in the world opens the cinematic conversation', async ({ page }) => {
    await start(page);
    // Edna (a resident villager) and Frosty (a wanderer) both route to the dialogue screen
    const edna = await gate(page, 'socTap', 'edna');
    expect(edna.conv).toBe(true);
    expect(edna.npc).toBe('edna');
    await expect(page.locator('#conv-modal')).toBeVisible({ timeout: 8000 });
    await gate(page, 'socClose');
    const frost = await gate(page, 'socTap', 'frost');   // wanders as "frost", profile "frosty"
    expect(frost.conv).toBe(true);
    expect(frost.npc).toBe('frosty');
    await gate(page, 'socClose');
  });

  test('8) controller-only: enter, select and exit a conversation', async ({ page }) => {
    await start(page);
    await gate(page, 'uiSetMethod', 'gamepad');
    await gate(page, 'socOpen', 'frosty', 'frosty_first');
    await gate(page, 'socComplete');
    await expect(page.locator('#conv-modal')).toBeVisible({ timeout: 8000 });
    await expect.poll(async () => (await gate(page, 'uiFocusRing')).has, { timeout: 4000 }).toBe(true);  // focus on a choice
    await gate(page, 'socChoose', 'keen');
    await gate(page, 'socAdvance');
    await gate(page, 'socClose');
    await expect(page.locator('#conv-modal')).toHaveCount(0);
  });
});
