// Spin flow scenarios — happy path, big win, no-win.
//
// The Pixi reels are not asserted here (they're animated and non-deterministic
// at the pixel level). We assert the *contract*: balances, phases, grid
// contents, win counters. Visual regressions belong in tests/screenshots/.

import { test } from './slot-fixture';

const FIVE_SEVENS_GRID = [
  ['seven', 'seven', 'seven'],
  ['seven', 'seven', 'seven'],
  ['seven', 'seven', 'seven'],
  ['seven', 'seven', 'seven'],
  ['seven', 'seven', 'seven'],
];

const LOSING_GRID = [
  ['cherry', 'lemon', 'orange'],
  ['lemon', 'orange', 'plum'],
  ['orange', 'plum', 'bell'],
  ['plum', 'bell', 'bar'],
  ['bell', 'bar', 'cherry'],
];

test.describe('spin flow', () => {
  test('happy path — losing spin debits the bet and ends in idle', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.queueLoss(LOSING_GRID);
    await slot.spin();

    await slot.expectPhase('idle');
    await slot.expectBalance(99);
    await slot.expectLastWin(0);
    await slot.expectGrid(LOSING_GRID);
  });

  test('big win — server-resolved win credits the wallet', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.queueWin(FIVE_SEVENS_GRID, 250, [
      {
        lineId: 1,
        symbolId: 'seven',
        matchCount: 5,
        amount: 250,
        positions: [
          { reel: 0, row: 0 },
          { reel: 1, row: 0 },
          { reel: 2, row: 0 },
          { reel: 3, row: 0 },
          { reel: 4, row: 0 },
        ],
      },
    ]);
    await slot.spin();

    await slot.expectBalance(349);
    await slot.expectLastWin(250);
  });

  test('three spins compose: 100 → 99 → 99 + 5 → 103 + 0 = 103 with $1 bet', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });
    await slot.queueLoss(LOSING_GRID); // 100 - 1 = 99
    await slot.queueWin(FIVE_SEVENS_GRID, 5); // 99 - 1 + 5 = 103
    await slot.queueLoss(LOSING_GRID); // 103 - 1 = 102

    await slot.spin();
    await slot.expectBalance(99);
    await slot.spin();
    await slot.expectBalance(103);
    await slot.spin();
    await slot.expectBalance(102);
  });
});
