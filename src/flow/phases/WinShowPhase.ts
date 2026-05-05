import type { Phase, PhaseContext } from '../Phase';

const WIN_HOLD_MS = 1500;
const AUTOSPIN_DELAY_MS = 450;

// WinShowPhase plays back the winlines the SERVER returned. It does not
// compute wins, does not evaluate paylines, does not know the paytable.
// The client is a presentation layer — winlines and totalWin arrived
// pre-resolved in the SpinResponse.

export class WinShowPhase implements Phase {
  readonly name = 'winShow';
  private cancel: { dispose(): void } | null = null;
  private ctx: PhaseContext | null = null;

  async enter(ctx: PhaseContext): Promise<void> {
    this.ctx = ctx;
    const { winlines, totalWin } = ctx.stores.data;
    const hold = winlines.length > 0 && totalWin > 0 ? WIN_HOLD_MS : AUTOSPIN_DELAY_MS;

    if (winlines.length > 0 && totalWin > 0) {
      ctx.reels.showWin(winlines);
      // The server returns post-win balance in `SpinResponse.balance`, which
      // SpinPhase already reconciled. We only update the win-counter — calling
      // `credit()` here would double-count the wallet.
      ctx.stores.balance.setLastWin(totalWin);
      ctx.stores.ui.recordWin(totalWin);
    }

    this.cancel = ctx.ticker.schedule(hold, () => {
      this.advance(ctx);
    });
  }

  private advance(ctx: PhaseContext): void {
    const { ui } = ctx.stores;
    if (ui.isAutospinning) {
      ui.tickAutospin();
      if (ui.isAutospinning) {
        void ctx.fsm.transition('spin');
        return;
      }
    }
    void ctx.fsm.transition('idle');
  }

  skip(ctx: PhaseContext): void {
    this.cancel?.dispose();
    this.cancel = null;
    void ctx.fsm.transition('idle');
  }

  exit(): void {
    this.cancel?.dispose();
    this.cancel = null;
    this.ctx?.reels.clearWin();
    this.ctx = null;
  }
}
