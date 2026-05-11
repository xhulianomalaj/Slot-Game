// Adapter from pixi-reels `ReelSet` to the app's `ReelsEngine` contract.
//
// The app talks to reels through a narrow interface (`ReelsEngine` in
// ReelsPresenter). pixi-reels' `ReelSet` surface is richer than our needs;
// this adapter maps the three things our FSM cares about:
//
//   - spin() / setResult(grid) — drives a round
//   - setAnticipation(reels)   — per-reel teaser hook
//   - setSpeedMode(mode)       — Normal / Turbo / Super Turbo
//   - spotlight(cells)         — win display
//   - showWinAmounts(...)      — floating $ labels on winning symbols
//
// When pixi-reels ships v0.2+ with additional APIs you want to expose,
// widen ReelsEngine here — not in FSM phases.

import gsap from 'gsap';
import { Container, Text } from 'pixi.js';
import type { ReelSet, SymbolPosition } from 'pixi-reels';
import type { Grid, Winline } from '@/domain/types';
import type { ReelsEngine } from '@/presenters/ReelsPresenter';
import type { SpeedMode } from '@/state/UIStore';
import type { Disposable } from '@/utils/Disposable';

/** Maps UIStore SpeedMode to the pixi-reels SpeedPresets profile names. */
const SPEED_NAME: Record<SpeedMode, string> = {
  normal: 'normal',
  turbo: 'turbo',
  superTurbo: 'superTurbo',
};

// Cell geometry — must match MainScene constants.
const CELL = 140;
const GAP = 8;
/** Centre of a symbol cell in reelSet-local coordinates. */
function cellCenter(reel: number, row: number): { x: number; y: number } {
  return {
    x: reel * (CELL + GAP) + CELL / 2,
    y: row * (CELL + GAP) + CELL / 2,
  };
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function adaptReelSet(reelSet: ReelSet): ReelsEngine & Disposable {
  let spinPromise: Promise<unknown> | null = null;

  // Layer for floating win amount labels — sits on top of the reelSet.
  const labelsLayer = new Container();
  reelSet.addChild(labelsLayer);

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
    setSpeedMode(mode: SpeedMode) {
      reelSet.setSpeed(SPEED_NAME[mode]);
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
    showWinAmounts(winlines: Winline[], currency: string) {
      // Build a map: cell key → highest amount hitting that cell.
      const cellAmounts = new Map<string, number>();
      for (const line of winlines) {
        const share = line.amount / line.positions.length;
        for (const pos of line.positions) {
          const key = `${pos.reel}:${pos.row}`;
          cellAmounts.set(key, (cellAmounts.get(key) ?? 0) + share);
        }
      }

      for (const [key, amount] of cellAmounts) {
        const [reelStr, rowStr] = key.split(':');
        const { x, y } = cellCenter(Number(reelStr), Number(rowStr));

        const label = new Text({
          text: formatAmount(amount, currency),
          style: {
            fill: '#ffe066',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 28,
            fontWeight: '800',
            stroke: { color: '#000', width: 5 },
            dropShadow: {
              color: '#000',
              blur: 6,
              distance: 2,
              alpha: 0.7,
            },
          },
        });
        label.anchor.set(0.5);
        label.position.set(x, y);
        label.alpha = 0;
        label.scale.set(0.5);
        labelsLayer.addChild(label);

        gsap.timeline()
          .to(label, { alpha: 1, duration: 0.15, ease: 'power2.out' }, 0)
          .to(label.scale, { x: 1.15, y: 1.15, duration: 0.18, ease: 'back.out(2)' }, 0)
          .to(label.scale, { x: 1, y: 1, duration: 0.12, ease: 'power2.inOut' }, 0.18)
          .to(label.position, { y: y - 48, duration: 0.9, ease: 'power1.out' }, 0.2)
          .to(label, { alpha: 0, duration: 0.35, ease: 'power2.in' }, 0.75)
          .call(() => label.destroy(), undefined, 1.1);
      }
    },
    clearWinAmounts() {
      gsap.killTweensOf(labelsLayer.children);
      labelsLayer.removeChildren().forEach((c) => c.destroy());
    },
    dispose() {
      reelSet.destroy();
    },
  };
}
