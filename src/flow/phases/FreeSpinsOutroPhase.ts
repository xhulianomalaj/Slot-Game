import type { Phase, PhaseContext } from '../Phase';

// FreeSpinsOutroPhase — shown once all free spins are exhausted.
// Displays the cumulative winnings then resets the free-spins state and
// returns the FSM to idle.

export class FreeSpinsOutroPhase implements Phase {
  readonly name = 'freeSpinsOutro';

  async enter(ctx: PhaseContext): Promise<void> {
    const { ui } = ctx.stores;
    const total = ui.freeSpinsWinTotal;
    const currency = ui.currency;
    const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(total);

    await ctx.stores.modals.alert({
      icon: 'bonus',
      title: 'Free Spins Complete!',
      description: total > 0
        ? `You won ${formatted} in free spins!`
        : 'Better luck next time!',
      ok: 'Collect',
    });

    ui.endFreeSpins();
    await ctx.fsm.transition('idle');
  }
}
