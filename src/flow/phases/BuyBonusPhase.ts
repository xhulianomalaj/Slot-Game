import { GAME } from '@/config/gameConfig';
import type { Disposable } from '@/utils/Disposable';
import type { Phase, PhaseContext } from '../Phase';

// BuyBonusPhase — handles the purchase + guaranteed free-spins trigger.
// The player confirms the cost in the UI before transitioning here.
// This phase: debits the buy cost, calls network.buyBonus(), populates
// DataStore, plays a cinematic scatter reveal, then hands off to freeSpinsIntro.

/**
 * Cost multiplier: bonus buy = BUY_BONUS_MULTIPLIER × the current bet.
 * Priced at the feature's fair value (~10× bet for ~10 free spins) so the bonus
 * buy carries the same RTP as the base game. MUST match the server's
 * BUY_BONUS_MULTIPLIER in slot-backend/api/routes.py.
 */
export const BUY_BONUS_MULTIPLIER = 10;

/** Regular symbols used to fill non-scatter cells in the reveal grid. */
const FILL_SYMBOLS = ['cherry', 'lemon', 'orange', 'plum', 'bell', 'bar', 'seven'] as const;

/**
 * Build a grid with exactly 3 scatter symbols distributed across 3 randomly
 * chosen reels (one scatter per reel, at a random row). All other cells are
 * random regular symbols. This is used for the cinematic reveal only — the
 * server is not consulted for this grid.
 */
function buildScatterRevealGrid(): string[][] {
  const { columns, rows } = GAME;

  // Partial Fisher-Yates: shuffle to pick 3 distinct reel indices.
  const reelOrder = Array.from({ length: columns }, (_, i) => i);
  for (let i = 0; i < 3; i++) {
    const j = i + Math.floor(Math.random() * (columns - i));
    const tmp = reelOrder[i]!;
    reelOrder[i] = reelOrder[j]!;
    reelOrder[j] = tmp;
  }

  // Map reel → scatter row for the 3 chosen reels.
  const scatterAt = new Map<number, number>(
    reelOrder.slice(0, 3).map((reel) => [reel, Math.floor(Math.random() * rows)]),
  );

  return Array.from({ length: columns }, (_, reel) =>
    Array.from({ length: rows }, (_, row) =>
      scatterAt.get(reel) === row
        ? 'scatter'
        : FILL_SYMBOLS[Math.floor(Math.random() * FILL_SYMBOLS.length)]!,
    ),
  );
}

export class BuyBonusPhase implements Phase {
  readonly name = 'buyBonus';
  private cancel: Disposable | null = null;

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
      // Apply the server's authoritative post-purchase balance immediately.
      // SpinPhase will call data.clear() before the first free spin, so if we
      // don't apply it here the scatter-trigger credit would be lost.
      if (data.serverBalance !== null) {
        balance.setBalance(data.serverBalance);
      }
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

    // ── Cinematic scatter reveal ──────────────────────────────────────────────
    // Spin the reels and land on 3 scatters spread across the grid, exactly
    // like a real scatter trigger — before free spins begin.
    const revealGrid = buildScatterRevealGrid();
    ctx.reels.setSpeedMode('normal');
    ctx.reels.startSpin();
    ctx.sound.play('spinning', { loop: true });

    ctx.reels.onPenultimateReelLanded = () => {
      ctx.sound.stop('spinning');
      // No stop/thud sound here — scatters are landing, not a losing spin.
    };
    await ctx.reels.stopWithResult(revealGrid);
    ctx.sound.stop('spinning'); // fallback if penultimate callback never fired

    // Play win sound and light up the scatter symbols.
    ctx.sound.play('win');
    const scatterPositions: { reel: number; row: number }[] = [];
    for (let reel = 0; reel < revealGrid.length; reel++) {
      for (let row = 0; row < (revealGrid[reel]?.length ?? 0); row++) {
        if (revealGrid[reel]?.[row] === 'scatter') scatterPositions.push({ reel, row });
      }
    }
    ctx.reels.showWin(
      [{ lineId: 0, symbolId: 'scatter', matchCount: scatterPositions.length, amount: 0, positions: scatterPositions }],
      ui.currency,
    );

    // Hold for the win animation to play, then clean up.
    await new Promise<void>((resolve) => {
      this.cancel = ctx.ticker.schedule(1600, resolve);
    });
    this.cancel = null;
    ctx.reels.clearWin();
    // ─────────────────────────────────────────────────────────────────────────

    ui.setSpinning(false);
    const awarded = data.freeSpinsAwarded > 0 ? data.freeSpinsAwarded : 10;
    ui.startFreeSpins(awarded);
    // Skip freeSpinsIntro/freeSpinsReady — the cinematic scatter reveal already
    // served as the trigger moment; go straight to spinning the first free spin.
    await ctx.fsm.transition('spin');
  }

  skip(ctx: PhaseContext): void {
    this.cancel?.dispose();
    this.cancel = null;
    ctx.reels.forceStop();
    ctx.sound.stop('spinning');
  }

  exit(_ctx: PhaseContext): void {
    this.cancel?.dispose();
    this.cancel = null;
  }
}
