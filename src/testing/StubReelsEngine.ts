// StubReelsEngine — a no-op implementation of `ReelsEngine` for test mode.
//
// Real pixi-reels runs a multi-second animation per spin and the public
// `skip()` only works while the spin controller is "active" — once the
// landing sequence starts, calling skip is a no-op. For behavioral tests
// we just want the contract: spin starts, setResult lands, spotlight runs.
// Visuals belong to screenshot tests, not scenario tests.
//
// Composition wires this in when `testMode` is on, so the FSM phases
// transition through their awaits in microseconds and the bridge can drive
// hundreds of rounds in a single test.

import type { Grid } from '@/domain/types';
import type { ReelsEngine } from '@/presenters/ReelsPresenter';

export class StubReelsEngine implements ReelsEngine {
  /** Last grid the FSM asked us to land on — useful for assertions. */
  lastResultGrid: Grid = [];
  /** Last anticipation set — useful for asserting server-directed teasers. */
  lastAnticipation: number[] = [];
  /** Last spotlight call — useful for asserting win-show positions. */
  lastSpotlight: Array<{ reel: number; row: number }> = [];
  /** Counter for how many spins were started — catches double-spend bugs. */
  spinCount = 0;

  async spin(): Promise<void> {
    this.spinCount += 1;
  }
  async setResult(grid: Grid): Promise<void> {
    this.lastResultGrid = grid;
  }
  setAnticipation(reels: number[]): void {
    this.lastAnticipation = reels.slice();
  }
  forceStop(): void {
    /* no-op */
  }
  spotlight(cells: Array<{ reel: number; row: number }>): void {
    this.lastSpotlight = cells.slice();
  }
  clearSpotlight(): void {
    this.lastSpotlight = [];
  }
  dispose(): void {
    /* no-op */
  }
}
