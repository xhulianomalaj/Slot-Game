// ReelsPresenter — the one place that talks to pixi-reels.
// Everything else in the app goes through this surface.
//
// Keep this class free of game rules. It translates app state into
// pixi-reels calls. Rules live in flow/phases/ or domain/.

import type { Grid, Winline } from '@/domain/types';
import type { Disposable } from '@/utils/Disposable';

// NOTE: this is a minimal interface. When you wire real pixi-reels,
// replace the internals with a ReelSetBuilder call. The public surface
// below is what the rest of the app depends on — keep it stable.
export interface ReelsEngine {
  spin(): Promise<void>;
  setResult(grid: Grid): Promise<void>;
  setAnticipation(reels: number[]): void;
  forceStop(): void;
  spotlight(cells: Array<{ reel: number; row: number }>): void;
  clearSpotlight(): void;
  dispose(): void;
}

export class ReelsPresenter implements Disposable {
  constructor(private readonly engine: ReelsEngine) {}

  async startSpin(): Promise<void> {
    await this.engine.spin();
  }

  async stopWithResult(grid: Grid): Promise<void> {
    await this.engine.setResult(grid);
  }

  setAnticipation(reels: number[]): void {
    this.engine.setAnticipation(reels);
  }

  forceStop(): void {
    this.engine.forceStop();
  }

  showWin(winlines: Winline[]): void {
    const cells = winlines.flatMap((w) => w.positions);
    this.engine.spotlight(cells);
  }

  clearWin(): void {
    this.engine.clearSpotlight();
  }

  dispose(): void {
    this.engine.dispose();
  }
}
