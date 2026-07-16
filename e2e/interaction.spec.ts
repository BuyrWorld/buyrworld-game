import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * INTERACTION TARGETING CONTRACT
 * -----------------------------------------------------------------------------
 * Verifies the one interaction contract across pointer, touch and controller:
 *   • Tapping clear terrain MOVES; it never triggers a nearby object.
 *   • Tapping an interactive target SELECTS/highlights it first (a verb chip).
 *   • Interaction happens only in range + confirm, or via a deliberate direct
 *     control (controller A / keyboard E / the verb chip).
 *   • NPC selection/collision never auto-Chats or awards First Hello.
 *   • D-pad cycles the highlighted target and never moves the character.
 * Driven through the real production functions via the dev-only __gate bridge
 * (world-coordinate taps, so no fragile on-screen pixel maths).
 */

const SAVE_KEY = 'buyrworld_game_save_v1';

async function cleanLoad(page: Page) {
  await page.addInitScript((k) => { try { localStorage.removeItem(k); } catch (e) {} }, SAVE_KEY);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.goto('/', { waitUntil: 'commit', timeout: 30_000 });
      await expect(page.locator('#title')).toBeVisible({ timeout: 30_000 });
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
async function dismissPlayHint(page: Page) {
  const hint = page.locator('#play-hint-overlay');
  if (await hint.count()) {
    const btn = hint.locator('button');
    if (await btn.count()) await btn.first().click().catch(() => {});
    await hint.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
}
async function startInVillage(page: Page) {
  await cleanLoad(page);
  await page.locator('#btn-quick').click();
  await expect(page.locator('#hud-coins')).toBeVisible({ timeout: 10000 });
  await dismissPlayHint(page);
  await gate(page, 'ixSetTab', 'village');
}
const gate = (page: Page, method: string, ...args: any[]) =>
  page.evaluate(([m, a]) => (window as any).__gate[m as string](...(a as any[])), [method, args] as const);

const targets = (page: Page) => gate(page, 'ixTargets') as Promise<any[]>;
const furnace = async (page: Page) => (await targets(page)).find((t) => t.id === 'o:furnace');
const anyNpc = async (page: Page) => (await targets(page)).find((t) => t.kind === 'npc');
const boxCentre = (t: any) => [t.box.x + t.box.w / 2, t.box.y + t.box.h / 2] as const;

test.describe('Interaction targeting contract', () => {
  test('pointer: tapping terrain behind an object MOVES, never triggers it', async ({ page }) => {
    await startInVillage(page);
    const b = await furnace(page);
    await gate(page, 'ixTeleport', b.approach.x, b.approach.y);       // stand right by the furnace
    const r = await gate(page, 'ixTapWorld', b.approach.x + 200, b.approach.y + 40);  // clearly terrain
    expect(r.tab).toBe('village');                                    // did NOT enter
    expect(r.sel).toBeNull();                                         // nothing selected
    expect(r.vptx).not.toBeNull();                                   // a move target was set
  });

  test('pointer: a building takes select-then-confirm to enter (no accidental entry)', async ({ page }) => {
    await startInVillage(page);
    const b = await furnace(page);
    await gate(page, 'ixTeleport', b.approach.x, b.approach.y);
    const [cx, cy] = boxCentre(b);
    const r1 = await gate(page, 'ixTapWorld', cx, cy);                // first tap → select
    expect(r1.tab).toBe('village');
    expect(r1.sel).toBe('o:furnace');
    const r2 = await gate(page, 'ixTapWorld', cx, cy);                // second tap in range → confirm
    expect(r2.tab).toBe('steelworks');
  });

  test('pointer: selecting an NPC never auto-Chats or awards First Hello', async ({ page }) => {
    await startInVillage(page);
    const npc = await anyNpc(page);
    await gate(page, 'ixTeleport', npc.approach.x, npc.approach.y);
    const [cx, cy] = boxCentre(npc);
    const r1 = await gate(page, 'ixTapWorld', cx, cy);                // first tap → select only
    expect(r1.sel).toBe(npc.id);
    expect(r1.npcMet).toBe(false);                                   // NOT met yet
    const r2 = await gate(page, 'ixTapWorld', cx, cy);                // confirm → meet
    expect(r2.npcMet).toBe(true);
    await page.evaluate(() => { const m = document.getElementById('villager-profile-modal'); if (m) m.remove(); });
  });

  test('direct control: A/E interacts a nearby target, or walks to a far one first', async ({ page }) => {
    await startInVillage(page);
    // far from the furnace → A/E should walk toward it and defer interaction
    const b = await furnace(page);
    await gate(page, 'ixTeleport', b.approach.x - 300, b.approach.y);
    await gate(page, 'ixTapWorld', ...boxCentre(b));                  // select it (far)
    const far = await gate(page, 'ixInteractKey');
    expect(far.tab).toBe('village');                                 // not entered yet
    expect(far.pending).toBe(true);                                  // walking to interact on arrival
    // in range → A/E interacts immediately
    await gate(page, 'ixTeleport', b.approach.x, b.approach.y);
    const near = await gate(page, 'ixInteractKey');
    expect(near.tab).toBe('steelworks');
  });

  test('controller: D-pad cycles the highlighted target and does NOT move the character', async ({ page }) => {
    await startInVillage(page);
    const b = await furnace(page);
    await gate(page, 'ixTeleport', b.approach.x, b.approach.y);       // near several targets
    const before = await gate(page, 'ixState');
    const d1 = await gate(page, 'ixDpad', 1);
    expect(d1.handled).toBe(true);                                   // a nearby target was focused
    expect(d1.vptx).toBeNull();                                      // NO move target set
    expect(d1.sel).toBeTruthy();                                     // a target is highlighted
    const d2 = await gate(page, 'ixDpad', 1);
    expect(d2.vptx).toBeNull();                                      // still no movement
    expect(d2.sel).toBeTruthy();
    // the player's world position is unchanged by focus navigation
    const after = await gate(page, 'ixState');
    expect(after.vpx).toBe(before.vpx);
    expect(after.vpy).toBe(before.vpy);
  });

  test('every interactable exposes a hitbox, approach point and a contextual verb', async ({ page }) => {
    await startInVillage(page);
    const ts = await targets(page);
    expect(ts.length).toBeGreaterThan(10);
    for (const t of ts.slice(0, 40)) {
      expect(t.box && typeof t.box.w === 'number' && typeof t.box.h === 'number').toBe(true);
      expect(t.approach && typeof t.approach.x === 'number').toBe(true);
      expect(typeof t.verb === 'string' && t.verb.length > 0).toBe(true);
    }
    // the furnace reads "Enter", a rock reads "Mine"
    expect(ts.find((t) => t.id === 'o:furnace').verb).toBe('Enter');
    const rock = ts.find((t) => t.id.startsWith('o:rock_'));
    if (rock) expect(rock.verb).toBe('Mine');
  });
});
