// Adapter from pixi-reels `ReelSet` to the app's `ReelsEngine` contract.
//
// The app talks to reels through a narrow interface (`ReelsEngine` in
// ReelsPresenter). pixi-reels' `ReelSet` surface is richer than our needs;
// this adapter maps the three things our FSM cares about:
//
//   - spin() / setResult(grid) — drives a round
//   - setAnticipation(reels)   — per-reel teaser hook
//   - spotlight(cells)         — win display
//
// When pixi-reels ships v0.2+ with additional APIs you want to expose,
// widen ReelsEngine here — not in FSM phases.

import type { ReelSet, SymbolPosition } from 'pixi-reels';
import type { Grid } from '@/domain/types';
import type { ReelsEngine } from '@/presenters/ReelsPresenter';
import type { Disposable } from '@/utils/Disposable';

export function adaptReelSet(reelSet: ReelSet): ReelsEngine & Disposable {
  let spinPromise: Promise<unknown> | null = null;

  return {
    async spin() {
      spinPromise = reelSet.spin();
      // Don't await — SpinPhase runs this concurrently with the network call.
    },
    async setResult(grid: Grid) {
      reelSet.setResult(grid);
      // Wait for pixi-reels to finish the stop sequence.
      if (spinPromise) {
        await spinPromise;
        spinPromise = null;
      }
    },
    setAnticipation(reels: number[]) {
      if (reels.length > 0) reelSet.setAnticipation(reels);
    },
    forceStop() {
      reelSet.skip();
    },
    spotlight(cells: Array<{ reel: number; row: number }>) {
      if (cells.length === 0) return;
      const positions: SymbolPosition[] = cells.map((c) => ({ reelIndex: c.reel, rowIndex: c.row }));
      void reelSet.spotlight.show(positions);
    },
    clearSpotlight() {
      reelSet.spotlight.hide();
    },
    dispose() {
      reelSet.destroy();
    },
  };
}
