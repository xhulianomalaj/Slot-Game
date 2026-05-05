// Pins the balance contract that the SpinResponse type docs declare:
//
//   `SpinResponse.balance` is POST-WIN — the wallet figure the player will
//   see at the end of the round, with the bet already debited and the win
//   already credited.
//
// SpinPhase setBalance(response.balance). WinShowPhase only updates the
// `lastWin` counter; it does NOT call `balance.credit(totalWin)` again.
//
// If this test fails, someone re-introduced the double-credit bug — fix
// the offending phase, don't change this test.

import { describe, expect, it, vi } from 'vitest';
import { FSM } from '@/flow/fsm';
import type { PhaseContext } from '@/flow/Phase';
import { IdlePhase } from '@/flow/phases/IdlePhase';
import { SpinPhase } from '@/flow/phases/SpinPhase';
import { StopSpinPhase } from '@/flow/phases/StopSpinPhase';
import { WinShowPhase } from '@/flow/phases/WinShowPhase';
import { RootStore } from '@/state/RootStore';

function setup(spinResponse: { grid: string[][]; totalWin: number; winlines: unknown[]; balance: number }) {
  const stores = new RootStore();
  stores.balance.setBalance(100);
  stores.balance.setBet(1);

  let scheduledFn: (() => void) | null = null;
  const reels = {
    startSpin: vi.fn().mockResolvedValue(undefined),
    stopWithResult: vi.fn().mockResolvedValue(undefined),
    setAnticipation: vi.fn(),
    forceStop: vi.fn(),
    showWin: vi.fn(),
    clearWin: vi.fn(),
  };
  const network = { spin: vi.fn().mockResolvedValue(spinResponse) };
  const ticker = {
    schedule: vi.fn((_ms: number, fn: () => void) => {
      scheduledFn = fn;
      return { dispose: () => {} };
    }),
    every: vi.fn(),
    nextFrame: vi.fn(),
  };
  const fsm = new FSM({
    stores,
    ticker,
    network: network as unknown as PhaseContext['network'],
    reels: reels as unknown as PhaseContext['reels'],
  });
  for (const p of [new IdlePhase(), new SpinPhase(), new StopSpinPhase(), new WinShowPhase()]) {
    fsm.register(p);
  }
  return { stores, fsm, runScheduled: () => scheduledFn?.() };
}

describe('balance contract — server returns POST-WIN balance', () => {
  it('losing spin: balance ends at server value, lastWin stays 0', async () => {
    const { stores, fsm } = setup({
      grid: [['cherry']],
      totalWin: 0,
      winlines: [],
      balance: 99, // 100 - 1 bet, no win
    });
    await fsm.transition('spin');
    expect(stores.balance.balance).toBe(99);
    expect(stores.balance.lastWin).toBe(0);
  });

  it('winning spin: balance ends at server post-win value, NOT post-win + win', async () => {
    const { stores, fsm } = setup({
      grid: [['seven']],
      totalWin: 5,
      winlines: [{ lineId: 0, symbolId: 'seven', matchCount: 1, amount: 5, positions: [{ reel: 0, row: 0 }] }],
      balance: 104, // 100 - 1 bet + 5 win = post-win
    });
    await fsm.transition('spin');
    // Critical: 104, not 109. If this is 109 the WinShowPhase added the win
    // again on top of the server's already-post-win balance.
    expect(stores.balance.balance).toBe(104);
    expect(stores.balance.lastWin).toBe(5);
  });
});
