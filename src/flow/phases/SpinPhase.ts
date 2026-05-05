import type { Phase, PhaseContext } from '../Phase';

// SpinPhase kicks off the reels and the network request in parallel.
// When the network response arrives, DataStore is populated and we move on.

export class SpinPhase implements Phase {
  readonly name = 'spin';

  async enter(ctx: PhaseContext): Promise<void> {
    ctx.stores.balance.debitBet(); // optimistic; server balance in response is authoritative
    ctx.stores.ui.recordStake(ctx.stores.balance.bet);
    ctx.stores.ui.setSpinning(true);
    ctx.stores.data.clear();

    ctx.reels.startSpin();

    const response = await ctx.network.spin({ bet: ctx.stores.balance.bet });
    ctx.stores.data.setResponse(response);
    // Reconcile to the server's authoritative POST-WIN balance. WinShowPhase
    // does NOT credit `totalWin` again — it only updates `lastWin` for the
    // counter. See `domain/types.ts` SpinResponse.balance for the contract.
    ctx.stores.balance.setBalance(response.balance);

    await ctx.fsm.transition('stopSpin');
  }
}
