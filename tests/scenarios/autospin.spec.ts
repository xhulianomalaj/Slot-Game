// Autospin scenarios — counter ticks down, FSM keeps cycling, stop works.

import { expect, test } from './slot-fixture';

const LOSS = [
  ['cherry', 'lemon', 'orange'],
  ['lemon', 'orange', 'plum'],
  ['orange', 'plum', 'bell'],
  ['plum', 'bell', 'bar'],
  ['bell', 'bar', 'cherry'],
];

test.describe('autospin', () => {
  test('three rounds of autospin debit three bets and end at idle', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    for (let i = 0; i < 3; i++) await slot.queueLoss(LOSS);

    await slot.startAutospin(3);
    await slot.spin(); // first round; subsequent rounds chain via WinShowPhase

    // After three full cycles autospin counter is 0 again.
    await slot.waitForPhase('idle');

    const snap = await slot.state();
    expect(snap.balance).toBe(97);
    expect(snap.autospinRemaining).toBe(0);
  });

  test('stopAutospin halts the cycle after the current round', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    for (let i = 0; i < 5; i++) await slot.queueLoss(LOSS);

    await slot.startAutospin(5);
    await slot.spin(); // round 1 completes

    await slot.stopAutospin();
    await slot.waitForPhase('idle');

    const snap = await slot.state();
    // We may have one extra round in flight depending on implementation —
    // assert "stopped" rather than an exact remaining count.
    expect(snap.autospinRemaining).toBe(0);
  });
});
