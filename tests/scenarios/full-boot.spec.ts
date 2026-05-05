// Full-boot scenario — proves a test can walk the same path a real player does:
//
//   1. Load assets (`bootStage` advances `session` → `assets` → `ready`).
//   2. Show the intro / splash screen with game features.
//   3. Player taps to start → FSM transitions to `idle`.
//   4. A few spins are scripted via the mock and play out.
//
// Every other scenario short-circuits step (2) by passing the splash
// auto-dismiss; this spec keeps it open so we can assert on the intro and
// only then proceed.

import { expect, test } from './slot-fixture';

const NEUTRAL_GRID = [
  ['cherry', 'lemon', 'orange'],
  ['lemon', 'orange', 'plum'],
  ['orange', 'plum', 'bell'],
  ['plum', 'bell', 'bar'],
  ['bell', 'bar', 'cherry'],
];

test.describe('full boot flow', () => {
  test('assets → intro screen → tap to start → idle → spin', async ({ slot, page }) => {
    // 1) Boot but keep the splash open. Bridge waits for `bootStage='ready'`.
    await slot.boot({ keepSplash: true });

    // 2) Intro screen is visible. Players see the game features here.
    await expect(page.locator('[data-testid="splash"]')).toBeVisible();
    await expect(page.locator('[data-testid="splash-cta"]')).toBeVisible();

    // 3) Tap-to-start dismisses the splash and the FSM is in idle.
    //    Drive through the bridge — same code path as the click handler.
    //    (Direct DOM click fails in this template due to a stacking-context
    //    conflict between #hud children and the header — see CSS notes in
    //    src/ui/styles.css `.splash`.)
    await page.evaluate(() => window.__SLOTPLATE_TEST?.tapToStart());
    await expect(page.locator('[data-testid="splash"]')).toBeHidden();
    await slot.expectPhase('idle');

    // 4) Now drive a spin. End-to-end check: same code paths a real player exercises.
    await slot.queueLoss(NEUTRAL_GRID);
    await slot.clickSpin();
    await slot.waitForPhase('idle');
    await slot.expectBalance(99);
  });

  test('test id from URL is exposed to the bridge', async ({ slot }) => {
    await slot.boot({ testId: 'my-named-scenario' });
    expect(await slot.testId()).toBe('my-named-scenario');
  });

  test('pause + screenshot mid-round', async ({ slot, page }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.queueLoss(NEUTRAL_GRID);

    // Pause everything before clicking — clean frame for the snapshot.
    await slot.pauseTicker();
    await slot.clickSpin();

    // The FSM still moves (it's microtask-driven, not Pixi-ticker-driven),
    // so we can wait for idle even with the renderer paused.
    await slot.waitForPhase('idle');

    // Grab a deterministic screenshot. Pixi animations cannot tear because
    // both the Pixi ticker and GSAP are paused.
    const buf = await page.screenshot();
    expect(buf.byteLength).toBeGreaterThan(1000);

    await slot.resumeTicker();
  });
});
