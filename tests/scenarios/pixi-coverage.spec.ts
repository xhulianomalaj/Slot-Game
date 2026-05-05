// Pixi label coverage — verifies every interactive Pixi container is
// labeled and locatable from tests. This catches regressions where someone
// adds a new HUD button but forgets to set `.label`, which would silently
// break test scripts.

import { expect, test } from './slot-fixture';

const REQUIRED_LABELS = [
  'background',
  'reels-frame',
  'hud',
  'spin',
  'autoplay',
  'bet',
  'bet:plus',
  'bet:minus',
  'balance',
  'win',
] as const;

test.describe('pixi coverage', () => {
  test('every required label exists on the stage tree', async ({ slot }) => {
    await slot.boot();
    const labels = await slot.pixiLabels();
    for (const want of REQUIRED_LABELS) {
      expect(labels, `missing label "${want}" — set .label on the corresponding Container`).toContain(want);
    }
  });

  test('pixi bounds return non-zero box for visible HUD controls', async ({ slot }) => {
    await slot.boot();
    for (const label of ['spin', 'balance', 'bet', 'autoplay', 'win'] as const) {
      const bounds = await slot.pixiBounds(label);
      expect(bounds, `bounds for "${label}"`).not.toBeNull();
      expect(bounds?.visible).toBe(true);
      expect(bounds?.width).toBeGreaterThan(0);
      expect(bounds?.height).toBeGreaterThan(0);
    }
  });

  test('clickPixi("spin") triggers a spin', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.queueLoss([
      ['cherry', 'lemon', 'orange'],
      ['lemon', 'orange', 'plum'],
      ['orange', 'plum', 'bell'],
      ['plum', 'bell', 'bar'],
      ['bell', 'bar', 'cherry'],
    ]);
    await slot.clickPixi('spin');
    await slot.waitForPhase('idle');
    expect((await slot.state()).balance).toBe(99);
  });

  test('test id from URL is exposed on the bridge', async ({ slot }) => {
    await slot.boot({ testId: 'hello-id-from-test' });
    expect(await slot.testId()).toBe('hello-id-from-test');
  });

  test('pauseTicker freezes animation; resumeTicker unfreezes', async ({ slot, page }) => {
    await slot.boot();

    await slot.pauseTicker();
    // After pause the renderer should be stopped; tickFrames steps it once.
    const before = await page.evaluate(() => {
      // biome-ignore lint/suspicious/noExplicitAny: bridge-internal access for the test
      const app = (window as any).__SLOTPLATE?.app;
      return app ? { started: app.ticker.started } : null;
    });
    expect(before?.started).toBe(false);

    await slot.resumeTicker();
    const after = await page.evaluate(() => {
      // biome-ignore lint/suspicious/noExplicitAny: bridge-internal access for the test
      const app = (window as any).__SLOTPLATE?.app;
      return app ? { started: app.ticker.started } : null;
    });
    expect(after?.started).toBe(true);
  });
});
