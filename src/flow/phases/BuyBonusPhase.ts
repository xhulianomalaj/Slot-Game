import type { Phase, PhaseContext } from '../Phase';

// BuyBonusPhase — handles the purchase + guaranteed free-spins trigger.
// The player confirms the cost in the UI before transitioning here.
// This phase: debits the buy cost, calls network.buyBonus(), populates
// DataStore, starts the free-spins counter, then hands off to freeSpinsIntro.

/** Cost multiplier: bonus buy = BUY_BONUS_MULTIPLIER × the current bet. */
export const BUY_BONUS_MULTIPLIER = 80;

export class BuyBonusPhase implements Phase {
  readonly name = 'buyBonus';

  async enter(ctx: PhaseContext): Promise<void> {
    const { balance, data, ui } = ctx.stores;
    const bet  = balance.bet;
    const cost = Math.round(bet * BUY_BONUS_MULTIPLIER * 100) / 100;

    // Optimistic debit — server balance in response is authoritative.
    balance.setBalance(balance.balance - cost);
    ui.setSpinning(true);

    try {
      const response = await ctx.network.buyBonus({ bet });
      data.setResponse(response);
    } catch (err) {
      // Refund on failure
      balance.setBalance(balance.balance + cost);
      ui.setSpinning(false);
      await ctx.stores.modals.alert({
        icon: 'warn',
        title: 'Purchase Failed',
        description: err instanceof Error ? err.message : 'Could not complete the bonus purchase.',
        ok: 'OK',
      });
      await ctx.fsm.transition('idle');
      return;
    }

    ui.setSpinning(false);
    const awarded = data.freeSpinsAwarded > 0 ? data.freeSpinsAwarded : 10;
    ui.startFreeSpins(awarded);
    await ctx.fsm.transition('freeSpinsIntro');
  }
}
