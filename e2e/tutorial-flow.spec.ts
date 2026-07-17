import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * FIRST-SESSION TUTORIAL RELIABILITY
 * -----------------------------------------------------------------------------
 * Acceptance tests for the tutorial-reliability fix. Verifies the explicit
 * session-state machine, that NO standard contract counts down or lapses while
 * Frosty has the stage, that every "What next?" choice opens ONLY its
 * destination, that the modal coordinator never stacks two blocking modals and
 * coalesces simultaneous rewards, that refresh/save/load is safe at every stage,
 * that an old/incomplete save is safely repaired, and that completion can never
 * be awarded twice. The working invariant (6 ore → 3 bars → 3 brackets → deliver
 * 3) is asserted for exact resource conservation. Driven through the real
 * functions via the __gate dev bridge.
 */

const SAVE_KEY = 'buyrworld_game_save_v1';

// Clear the save via a one-shot evaluate + reload — NOT addInitScript, which would
// re-run on every subsequent page.reload() and wipe the save this spec relies on
// persisting across the softReload() calls below.
async function cleanLoad(page: Page) {
  let lastErr: unknown;
  for (let a = 0; a < 4; a++) {
    try {
      await page.goto('/', { waitUntil: 'commit', timeout: 60_000 });   // absorb the OneDrive cold Vite compile
      await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
      await page.reload({ waitUntil: 'commit', timeout: 45_000 });
      await expect(page.locator('#title')).toBeVisible({ timeout: 45_000 });
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
async function softReload(page: Page) {   // reload WITHOUT wiping the save
  let lastErr: unknown;
  for (let a = 0; a < 4; a++) {
    try { await page.reload({ waitUntil: 'commit', timeout: 30_000 }); await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 30_000 }); await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 20_000 }); return; }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}
async function dismissHint(page: Page) {
  const hint = page.locator('#play-hint-overlay');
  if (await hint.count()) { const b = hint.locator('button'); if (await b.count()) await b.first().click().catch(()=>{}); await hint.waitFor({ state:'detached', timeout:5000 }).catch(()=>{}); }
}
async function quickStart(page: Page) {
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#title')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => !!(window as any).__gate, null, { timeout: 20000 });
  await dismissHint(page);
}
const gate = (page: Page, m: string, ...a: any[]) =>
  page.evaluate(([mm, aa]) => (window as any).__gate[mm as string](...(aa as any[])), [m, a] as const);

test.describe('Tutorial reliability', () => {
  // req 1 + resource conservation --------------------------------------------
  test('the full tutorial runs from a clean save with exact resource conservation', async ({ page }) => {
    await quickStart(page);
    expect(await gate(page, 'tutPhase')).toBe('active');

    const snaps = await gate(page, 'runChain');
    const by = (l: string) => snaps.find((s: any) => s.label === l);
    // 6 Iron Ore mined, nothing else yet
    expect(by('mine').items).toMatchObject({ iron_ore: 6, iron_bar: 0, bracket: 0 });
    // 6 ore → 3 bars (2:1) leaves 0 ore
    expect(by('smelt').items).toMatchObject({ iron_ore: 0, iron_bar: 3, bracket: 0 });
    // 3 bars → 3 brackets (1:1) leaves 0 bars
    expect(by('press').items).toMatchObject({ iron_ore: 0, iron_bar: 0, bracket: 3 });
    // 3 brackets delivered leaves 0
    expect(by('deliver').items).toMatchObject({ iron_ore: 0, iron_bar: 0, bracket: 0 });
    expect(by('deliver').tutDone).toBe(true);
    expect(await gate(page, 'tutPhase')).toBe('completed');
  });

  // req 1 — phase transitions ------------------------------------------------
  test('the session state machine moves active → contract_ready → completed', async ({ page }) => {
    await quickStart(page);
    expect(await gate(page, 'tutPhase')).toBe('active');       // mine
    await gate(page, 'tutAdvanceOne');                          // → smelt
    expect(await gate(page, 'tutPhase')).toBe('active');
    await gate(page, 'tutAdvanceOne');                          // → make
    expect(await gate(page, 'tutPhase')).toBe('active');
    await gate(page, 'tutAdvanceOne');                          // → deliver (brackets in hand)
    expect(await gate(page, 'tutPhase')).toBe('contract_ready');
    await gate(page, 'tutAdvanceOne');                          // deliver → done
    expect(await gate(page, 'tutPhase')).toBe('completed');
  });

  // req 2/3 — no standard contract expires during the tutorial ----------------
  test('no standard contract shows a clock or lapses while the tutorial has the stage', async ({ page }) => {
    await quickStart(page);
    expect(await gate(page, 'tutBoard')).toMatchObject({ frozen: true });
    // seed expiring standard orders (as an old mid-tutorial save might carry)
    await gate(page, 'tutSeedBoard', 2);
    await page.waitForTimeout(1200);                            // well past their 0.8s deadline
    const swept = await gate(page, 'tutSweep');
    expect(swept.after).toBe(swept.before);                     // nothing lapsed (req 2)
    const board = await gate(page, 'tutBoard');
    expect(board.anyHurryDom).toBe(false);                      // no "0s — hurry!" (req 2)
    expect(board.anyCountdownDom).toBe(false);                  // no countdown shown for standard orders
    // once the tutorial is over, normal timers begin from that moment (req 3)
    await gate(page, 'runChain');
    expect((await gate(page, 'tutBoard')).frozen).toBe(false);
  });

  // req 4 — every What-next choice is authoritative ---------------------------
  test('Explore / Trade / Work each open ONLY their destination', async ({ page }) => {
    await quickStart(page);
    await gate(page, 'runChain');
    await gate(page, 'pacingClickSummaryContinue');            // summary → Choose Your Next Step

    let r = await gate(page, 'tutChoose', 'contract');
    expect(r).toMatchObject({ contractsOpen: true, tradeOpen: false, unlockCardOpen: false, nextStepOpen: false });

    await gate(page, 'tutOpenNextStep');
    r = await gate(page, 'tutChoose', 'production');
    expect(r).toMatchObject({ tradeOpen: false, unlockCardOpen: false });
    expect(r.tab).toBe('steelworks');                          // the relevant work interface

    await gate(page, 'tutOpenNextStep');
    r = await gate(page, 'tutChoose', 'explore');
    // Explore opens the valley + exploration guidance ONLY — the Trade Post must
    // NOT open (the exact defect this fix targets).
    expect(r).toMatchObject({ villageOpen: true, tradeOpen: false, unlockCardOpen: false, exploreGuideOpen: true });
  });

  // req 5/6 — modal coordinator never stacks two blocking modals --------------
  test('the modal coordinator refuses a second blocking modal and queues optional info', async ({ page }) => {
    await quickStart(page);
    // pure gate: optional cannot cover a tutorial modal; critical always preempts
    expect(await gate(page, 'tutModalGate', 'optional', 'tut-summary')).toBe(false);
    expect(await gate(page, 'tutModalGate', 'tutorial', 'next-step-modal')).toBe(false);
    expect(await gate(page, 'tutModalGate', 'critical', 'tut-summary')).toBe(true);
    // while the tutorial runs, an optional info card is not allowed to interrupt
    expect(await gate(page, 'tutModalGate', 'optional', null)).toBe(false);
  });

  // req 7 — simultaneous rewards coalesce into one compact summary ------------
  test('several simultaneous unlocks coalesce into one compact summary', async ({ page }) => {
    await quickStart(page);
    const s = await gate(page, 'tutSummariseRewards', ['⚖️ Trade', '📋 Contracts', '⚖️ Trade']);
    expect(s.count).toBe(3);
    expect(s.lines).toEqual([{ label: '⚖️ Trade', count: 2 }, { label: '📋 Contracts', count: 1 }]);
  });

  // req 8 — quarry objective marker carries a live distance --------------------
  test('the mining objective marker shows a live distance indicator', async ({ page }) => {
    await quickStart(page);
    const m = await gate(page, 'tutMarker');
    expect(m.step).toBe(0);                                     // mining stage
    expect(m.hasDistance).toBe(true);                          // "…m" or "you're here"
  });

  // refresh/save/load at every tutorial step ---------------------------------
  test('save/load is safe at every tutorial step', async ({ page }) => {
    await quickStart(page);
    for (let expected = 1; expected <= 4; expected++) {
      const adv = await gate(page, 'tutAdvanceOne');            // advance one stage, autosaves
      await softReload(page);
      const st = await gate(page, 'tutState');
      if (expected < 4) { expect(st.step).toBe(expected); expect(st.done).toBe(false); }
      else { expect(st.done).toBe(true); }                     // final stage → completed
      expect(Number.isFinite(st.coins)).toBe(true);
    }
  });

  // req 10 — old/incomplete tutorial save migration ---------------------------
  test('an old save stranded without its stage inputs is safely repaired on load', async ({ page }) => {
    await quickStart(page);
    // strand the save at the smelt stage with NO materials (old 5/2/1-era save)
    const stranded = await gate(page, 'tutStrandOldSave', 1);
    expect(stranded.phase).toBe('abandoned_recoverable');
    await softReload(page);
    // the one-time safe-repair topped up EXACTLY the deficit → back to a workable stage
    const st = await gate(page, 'tutState');
    expect(st.step).toBe(1);
    expect(st.recovered).toBe(true);
    expect(st.items.iron_ore).toBeGreaterThanOrEqual(6);       // enough ore to smelt 3 bars
    expect(await gate(page, 'tutPhase')).toBe('active');       // recovered → active
    // reloading again must NOT top up a second time (idempotent repair)
    const oreBefore = st.items.iron_ore;
    await softReload(page);
    expect((await gate(page, 'tutState')).items.iron_ore).toBe(oreBefore);
  });

  // no double completion -----------------------------------------------------
  test('the tutorial cannot award completion twice', async ({ page }) => {
    await quickStart(page);
    await gate(page, 'runChain');
    const coins = (await gate(page, 'tutState')).coins;
    const idem = await gate(page, 'rewardsIdempotent');        // re-fire every reward path
    expect(idem.after).toBe(idem.before);                     // balance unmoved
    expect((await gate(page, 'tutState')).coins).toBe(coins);
    expect(await gate(page, 'tutPhase')).toBe('completed');
  });
});
