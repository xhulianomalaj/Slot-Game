import type { Phase, PhaseContext } from '../Phase';

// SpinPhase kicks off the reels and the network request in parallel.
// When the network response arrives, DataStore is populated and we move on.

export class SpinPhase implements Phase {
  readonly name = 'spin';
  private spinSoundTimer: { dispose(): void } | null = null;

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
    // Stop button stays DISABLED here — SpinPhase.skip() only cancels the
    // sound timer; it cannot fast-forward the reels. The button is enabled
    // at the start of StopSpinPhase, where skip() → forceStop() actually works.
    if (ctx.stores.ui.speed === 'normal') {
      this.spinSoundTimer = ctx.ticker.schedule(300, () => {
        this.spinSoundTimer = null;
        ctx.sound.play('spinning', { loop: true });
      });
    } else if (ctx.stores.ui.speed === 'turbo') {
      this.spinSoundTimer = ctx.ticker.schedule(200, () => {
        this.spinSoundTimer = null;
        ctx.sound.play('spinning', { loop: true });
      });
    } else {
      ctx.sound.play('spinning', { loop: true });
    }

    const response = await ctx.network.spin({ bet: ctx.stores.balance.bet });
    ctx.stores.data.setResponse(response);
    // spinning sound is stopped in StopSpinPhase after reels fully land.

    // Balance is NOT applied here — it's deferred to WinShowPhase so the HUD
    // doesn't jump while the reels are still spinning. See WinShowPhase.enter().

    await ctx.fsm.transition('stopSpin');
  }

  /** Cancel the delayed spinning-sound start so it cannot fire after the phase exits. */
  skip(_ctx: PhaseContext): void {
    this.spinSoundTimer?.dispose();
    this.spinSoundTimer = null;
    // Do NOT stop the sound here — if it's already playing the reels are still
    // spinning and StopSpinPhase owns the stop. Only cancel the pending timer
    // so it cannot fire into the wrong phase.
  }
}
