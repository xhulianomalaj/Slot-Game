import type { Phase, PhaseContext } from '../Phase';

// SpinPhase kicks off the reels and the network request in parallel.
// When the network response arrives, DataStore is populated and we move on.

export class SpinPhase implements Phase {
  readonly name = 'spin';

  async enter(ctx: PhaseContext): Promise<void> {
    const { ui } = ctx.stores;
    if (ui.isAutospinning) {
      ui.beginAutospinRound();
    }
    try {
      ctx.stores.balance.debitBet(); // optimistic; server balance in response is authoritative
    } catch (err) {
      console.warn('[SpinPhase] insufficient balance, aborting spin', err);
      await ctx.fsm.transition('idle');
      return;
    }
    ctx.stores.ui.recordStake(ctx.stores.balance.bet);
    ctx.stores.ui.setSpinning(true);
    ctx.stores.data.clear();

    ctx.reels.setSpeedMode(ctx.stores.ui.speed);
    ctx.reels.startSpin();

    const response = await ctx.network.spin({ bet: ctx.stores.balance.bet });
    ctx.stores.data.setResponse(response);
    // Balance is NOT applied here — it's deferred to WinShowPhase so the HUD
    // doesn't jump while the reels are still spinning. See WinShowPhase.enter().

    await ctx.fsm.transition('stopSpin');
  }
}
