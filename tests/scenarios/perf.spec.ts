// Performance scenarios — pin the FSM round duration in instant mode.
//
// The bridge swaps in `InstantTicker` and `StubReelsEngine` so a full round
// (idle → spin → stopSpin → winShow → idle) should complete in single-digit
// milliseconds. If a refactor accidentally keeps the GSAP ticker, an
// animation that returns to real-time, or a stray setTimeout — these tests
// catch it before the suite runtime balloons.

import { Grids } from './_fixtures';
import { expect, test } from './slot-fixture';

test.describe('performance', () => {
  test('one round completes in well under 100ms', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.queueLoss(Grids.neutralLoss);
    await slot.spin();
    await slot.expectLastRoundFasterThan(100);
  });

  test('50 sequential rounds complete in under 10 seconds (cross-process)', async ({ slot }) => {
    // Threshold = 10s for 50 rounds = 200ms/round budget. The actual FSM
    // cost is single-digit ms; the rest is two `page.evaluate` round-trips
    // per spin (queue + run). If this regresses below 200ms/round it
    // probably means a real-time animation slipped in — investigate.
    await slot.boot({ startingBalance: 10_000, bet: 1 });
    for (let i = 0; i < 50; i++) await slot.queueLoss(Grids.neutralLoss);

    const t0 = Date.now();
    for (let i = 0; i < 50; i++) await slot.spin();
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(10_000);
    const snap = await slot.state();
    expect(snap.balance).toBe(9950);
  });
});
