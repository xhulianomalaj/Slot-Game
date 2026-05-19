import type { Phase, PhaseContext } from '../Phase';

// FreeSpinsIntroPhase — called once after scatter triggers (or bonus buy).
// Does NOT show a popup. Sets the 'awaiting start' flag so the spin button
// shows 'Start', then hands off to FreeSpinsReadyPhase which waits for the
// player to click. ui.startFreeSpins(n) must be called before transitioning
// here so the count is already set in UIStore.

export class FreeSpinsIntroPhase implements Phase {
  readonly name = 'freeSpinsIntro';

  async enter(ctx: PhaseContext): Promise<void> {
    ctx.stores.ui.setFreeSpinsAwaitingStart(true);
    await ctx.fsm.transition('freeSpinsReady');
  }
}
