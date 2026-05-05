// Input scenarios — clicking, double-click guards.
//
// The HUD is rendered inside Pixi (canvas), not the DOM, so clicks go
// through `slot.clickPixi(label)` which emits `pointertap` on the labeled
// container — exactly what production handlers listen for.

import { expect, test } from './slot-fixture';

const NEUTRAL_GRID = [
  ['cherry', 'lemon', 'orange'],
  ['lemon', 'orange', 'plum'],
  ['orange', 'plum', 'bell'],
  ['plum', 'bell', 'bar'],
  ['bell', 'bar', 'cherry'],
];

test.describe('input', () => {
  test('spin button click debits the bet and ends in idle', async ({ slot }) => {
    await slot.boot({ startingBalance: 50, bet: 1 });
    await slot.queueLoss(NEUTRAL_GRID);

    await slot.clickSpin();
    await slot.waitForPhase('idle');
    await slot.expectBalance(49);
  });

  // Known bug — `test.fail` makes Playwright EXPECT this to fail. When the
  // SpinButton/FSM stop accepting a re-entrant transition, this test starts
  // passing and fails the suite (a "remove me, the bug is fixed" reminder).
  //
  // Root cause: SpinButton.onClick gates on `ui.spinning`, but `spinning`
  // is only set inside SpinPhase.enter — which runs AFTER the await chain
  // starts. Two clicks in the same microtask both see spinning=false and
  // fire two transitions, debiting twice.
  test.fail('rapid double-click does not double-spend (known bug)', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.queueLoss(NEUTRAL_GRID);
    await slot.queueLoss(NEUTRAL_GRID);

    await slot.clickSpin();
    await slot.clickSpin();
    await slot.waitForPhase('idle');

    const snap = await slot.state();
    expect(snap.balance).toBe(99); // currently 98 — double debit
    expect(snap.queuedSpins).toBe(1); // currently 0 — both consumed
  });

  test('bet stepper plus/minus updates the bet store', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });

    await slot.clickPixi('bet:plus');
    expect((await slot.state()).bet).toBeGreaterThan(1);

    await slot.clickPixi('bet:minus');
    await slot.clickPixi('bet:minus');
    expect((await slot.state()).bet).toBeLessThanOrEqual(1);
  });

  test('autoplay button toggles autospin', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    expect((await slot.state()).autospinRemaining).toBe(0);

    await slot.clickPixi('autoplay');
    expect((await slot.state()).autospinRemaining).toBeGreaterThan(0);

    await slot.clickPixi('autoplay');
    expect((await slot.state()).autospinRemaining).toBe(0);
  });
});
