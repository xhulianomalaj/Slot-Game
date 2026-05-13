import type { Phase, PhaseContext } from '../Phase';

export class StopSpinPhase implements Phase {
  readonly name = 'stopSpin';
  private spinSoundStopTimer: { dispose(): void } | null = null;

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

    if (useEarlyStop) {
      ctx.reels.onPenultimateReelLanded = () => ctx.sound.play('stop');
    }

    const stopPromise = ctx.reels.stopWithResult(grid);
    if (ctx.stores.ui.speed === 'normal') {
      this.spinSoundStopTimer = ctx.ticker.schedule(1600, () => {
        this.spinSoundStopTimer = null;
        ctx.sound.stop('spinning');
      });
    } else if (ctx.stores.ui.speed === 'turbo') {
      this.spinSoundStopTimer = ctx.ticker.schedule(400, () => {
        this.spinSoundStopTimer = null;
        ctx.sound.stop('spinning');
      });
    } else {
      ctx.sound.stop('spinning');
    }
    await stopPromise;

    // Phase is done — cancel any pending stop timer and ensure the sound is off
    // so it cannot bleed into the next spin.
    this.cancelSpinSound(ctx);

    // For non-early-stop cases (turbo, superTurbo, anticipation, win) play the
    // stop sound now — all reels have fully landed at this point.
    if (isNoWin && !useEarlyStop) {
      ctx.sound.play('stop');
    }

    await ctx.fsm.transition('winShow');
  }

  skip(ctx: PhaseContext): void {
    ctx.reels.forceStop();
    this.cancelSpinSound(ctx);
  }

  /** Cancel the spinning-stop timer and immediately silence the spinning sound. */
  private cancelSpinSound(ctx: PhaseContext): void {
    this.spinSoundStopTimer?.dispose();
    this.spinSoundStopTimer = null;
    ctx.sound.stop('spinning');
  }
}
