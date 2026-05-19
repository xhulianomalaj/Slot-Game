import type { Phase, PhaseContext } from '../Phase';

export class StopSpinPhase implements Phase {
  readonly name = 'stopSpin';

  async enter(ctx: PhaseContext): Promise<void> {
    const { grid } = ctx.stores.data;

    // Enable stop button NOW — StopSpinPhase.skip() calls forceStop() which
    // actually fast-forwards the reel animation. This is the earliest moment
    // the stop action does something visible.
    ctx.stores.ui.setStopEnabled(true);

    const { winlines, totalWin } = ctx.stores.data;
    const isNoWin = !(winlines.length > 0 && totalWin > 0);

    // For normal speed without anticipation, the last reel has a visible
    // slow-deceleration settle. Playing the stop sound when the second-to-last
    // reel lands means the audio arrives as that final reel is easing in —
    // which feels synchronised rather than slightly late.
    const useEarlyStop = isNoWin && ctx.stores.ui.speed === 'normal';

    ctx.reels.onPenultimateReelLanded = () => {
      ctx.sound.stop('spinning');
      if (useEarlyStop) ctx.sound.play('stop');
    };

    await ctx.reels.stopWithResult(grid);

    // All reels have landed — disable stop before entering WinShowPhase so
    // the button stays dark through the entire win animation sequence.
    ctx.stores.ui.setStopEnabled(false);

    // Fallback: silence spinning in case penultimate never fired (e.g. single reel).
    ctx.sound.stop('spinning');

    // For non-early-stop no-win cases play the stop sound now — all reels landed.
    if (isNoWin && !useEarlyStop) {
      ctx.sound.play('stop');
    }

    await ctx.fsm.transition('winShow');
  }

  skip(ctx: PhaseContext): void {
    ctx.reels.forceStop();
    ctx.sound.stop('spinning');
  }
}
