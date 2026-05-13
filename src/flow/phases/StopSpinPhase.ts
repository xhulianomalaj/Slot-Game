import type { Phase, PhaseContext } from '../Phase';

export class StopSpinPhase implements Phase {
  readonly name = 'stopSpin';

  async enter(ctx: PhaseContext): Promise<void> {
    const { grid, teasingReels } = ctx.stores.data;

    // If the server told us which reels to tease, pass that to the engine.
    // The client does not decide teasers — it plays back what came over the wire.
    if (teasingReels?.length) {
      ctx.reels.setAnticipation(teasingReels);
    }

    const { winlines, totalWin } = ctx.stores.data;
    const isNoWin = !(winlines.length > 0 && totalWin > 0);

    // For normal speed without anticipation, the last reel has a visible
    // slow-deceleration settle. Playing the stop sound when the second-to-last
    // reel lands means the audio arrives as that final reel is easing in —
    // which feels synchronised rather than slightly late.
    const useEarlyStop =
      isNoWin &&
      ctx.stores.ui.speed === 'normal' &&
      !teasingReels?.length;

    // Stop spinning sound at the penultimate reel landing (event-driven, tab-safe).
    // Using the reel-landed event instead of a gsap timer means the cut happens at
    // the right visual moment even after a tab switch (performance.now() keeps
    // advancing while hidden, so timers catch up on resume; reel events do not).
    // For normal-speed no-win, also cue the stop sound here so it plays while the
    // last reel is still settling.
    ctx.reels.onPenultimateReelLanded = () => {
      ctx.sound.stop('spinning');
      if (useEarlyStop) ctx.sound.play('stop');
    };

    await ctx.reels.stopWithResult(grid);

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
