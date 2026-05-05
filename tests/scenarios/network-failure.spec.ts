// Network failure scenarios — server errors, dropped connection, recovery.
//
// Why this matters: in production, the round of a player's life will get
// hit by a 502, a websocket close, or a network blip. The client needs to
// surface that loud, not silently fail or double-debit the wallet. These
// tests pin down the contract.

import { expect, test } from './slot-fixture';

const SOME_GRID = [
  ['cherry', 'lemon', 'orange'],
  ['lemon', 'orange', 'plum'],
  ['orange', 'plum', 'bell'],
  ['plum', 'bell', 'bar'],
  ['bell', 'bar', 'cherry'],
];

test.describe('network failure', () => {
  test('server error rejects the spin and the FSM does not advance', async ({ slot, page }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.queueError('RGS_TIMEOUT', 0);

    // The bridge's spin() awaits 'idle', which won't happen — assert that
    // the underlying spin promise rejects loudly so the app can react.
    const failed = page.evaluate(async () => {
      try {
        await window.__SLOTPLATE_TEST?.spin();
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(await failed).toContain('RGS_TIMEOUT');
  });

  test('connection drop mid-spin leaves the spin pending, recovery resolves it', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });

    // The next spin will succeed — but we'll go offline before the response
    // arrives, freezing the round. The mock holds the response until online.
    await slot.queueWin(SOME_GRID, 7);
    await slot.simulateOffline();
    await slot.startSpin();
    await slot.waitForSpinning(true);

    // Confirm we're stuck: phase advanced to 'spin' but no completion.
    let snap = await slot.state();
    expect(snap.phase).toBe('spin');
    expect(snap.spinning).toBe(true);
    expect(snap.pendingNetworkRequests).toBe(1);

    // Restore connectivity — the queued response now flows through.
    await slot.simulateOnline();
    await slot.waitForPhase('idle');

    snap = await slot.state();
    expect(snap.balance).toBe(106); // 100 - 1 + 7
    expect(snap.lastWin).toBe(7);
    expect(snap.pendingNetworkRequests).toBe(0);
  });

  test('history records both outcomes when a request fails then succeeds', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.queueError('SERVER_BUSY');

    await slot.spin().catch(() => {
      /* expected */
    });
    // SpinPhase doesn't have its own recovery path — once the network rejects,
    // the FSM stays in `spin`. Tests that want to script another round after
    // an error must explicitly recover.
    await slot.recoverFromError();
    await slot.queueLoss(SOME_GRID);
    await slot.spin();

    const history = await slot.history();
    const spins = history.filter((h) => h.kind === 'spin');
    expect(spins).toHaveLength(2);
    expect(spins[0]?.outcome).toBe('rejected');
    expect(spins[1]?.outcome).toBe('resolved');
  });
});
