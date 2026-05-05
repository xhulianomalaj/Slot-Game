// Performance scenarios — pin the FSM round duration in instant mode.
//
// The bridge swaps in `InstantTicker` and `StubReelsEngine` so a full round
// (idle → spin → stopSpin → winShow → idle) should complete in single-digit
// milliseconds. If a refactor accidentally keeps the GSAP ticker, an
// animation that returns to real-time, or a stray setTimeout — these tests
// catch it before the suite runtime balloons.

import { expect, test } from './slot-fixture';

const NEUTRAL_LOSS_GRID = [
  ['cherry', 'lemon', 'orange'],
  ['lemon', 'orange', 'plum'],
  ['orange', 'plum', 'bell'],
  ['plum', 'bell', 'bar'],
  ['bell', 'bar', 'cherry'],
];

test.describe('performance', () => {
  test('one round completes in well under 100ms', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.queueLoss(NEUTRAL_LOSS_GRID);
    await slot.spin();
    await slot.expectLastRoundFasterThan(100);
  });

  test('50 sequential rounds complete in under 60 seconds (cross-process)', async ({ slot }) => {
    // Budget: 60s / 50 rounds = 1200ms/round. The actual FSM cost is
    // single-digit ms, but rAF-based waitForPhase polling adds ~300ms/round
    // on headless CI runners. The tight regression guard is the "one round
    // < 100ms" test above — this test only catches catastrophic slowdowns
    // (e.g. a real-time animation or stray setTimeout that burns seconds).
    await slot.boot({ startingBalance: 10_000, bet: 1 });

    const elapsed = await slot.page.evaluate(async (grid) => {
      const bridge = window.__SLOTPLATE_TEST!;
      for (let i = 0; i < 50; i++) bridge.queueLoss(grid);
      const t0 = performance.now();
      for (let i = 0; i < 50; i++) {
        bridge.startSpin();
        await bridge.waitForPhase('idle');
      }
      return performance.now() - t0;
    }, NEUTRAL_LOSS_GRID);

    expect(elapsed).toBeLessThan(60_000);
    const snap = await slot.state();
    expect(snap.balance).toBe(9950);
  });
});
