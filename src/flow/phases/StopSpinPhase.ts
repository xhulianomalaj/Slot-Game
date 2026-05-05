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

    await ctx.reels.stopWithResult(grid);
    await ctx.fsm.transition('winShow');
  }

  skip(ctx: PhaseContext): void {
    ctx.reels.forceStop();
  }
}
