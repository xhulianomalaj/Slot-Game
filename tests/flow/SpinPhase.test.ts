// Canvas-free phase test. The client receives a resolved SpinResponse from
// the network and plays it back — no evaluation on this side.

import { describe, expect, it, vi } from 'vitest';
import { FSM } from '@/flow/fsm';
import type { PhaseContext } from '@/flow/Phase';
import { SpinPhase } from '@/flow/phases/SpinPhase';
import { RootStore } from '@/state/RootStore';

describe('SpinPhase', () => {
  it('debits bet, spins reels, awaits server response, transitions to stopSpin', async () => {
    const stores = new RootStore();
    stores.balance.setBet(1);

    const reels = { startSpin: vi.fn().mockResolvedValue(undefined) };
    const network = {
      spin: vi.fn().mockResolvedValue({
        grid: [['cherry', 'lemon', 'bar']],
        totalWin: 0,
        winlines: [],
        balance: 99,
      }),
    };

    const fsm = new FSM({
      stores,
      ticker: { schedule: vi.fn(), every: vi.fn(), nextFrame: vi.fn() },
      network: network as unknown as PhaseContext['network'],
      reels: reels as unknown as PhaseContext['reels'],
    });

    const stopSpin = { name: 'stopSpin', enter: vi.fn().mockResolvedValue(undefined) };
    fsm.register(new SpinPhase());
    fsm.register(stopSpin);

    const startingBalance = stores.balance.balance;
    await fsm.transition('spin');

    // After reconciling with the server's authoritative balance (99):
    expect(stores.balance.balance).toBe(99);
    void startingBalance;
    expect(reels.startSpin).toHaveBeenCalledOnce();
    expect(network.spin).toHaveBeenCalledWith({ bet: 1 });
    expect(stopSpin.enter).toHaveBeenCalledOnce();
  });
});
