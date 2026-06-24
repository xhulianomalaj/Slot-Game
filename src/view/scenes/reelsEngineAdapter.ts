// Adapter from pixi-reels `ReelSet` to the app's `ReelsEngine` contract.
//
// The app talks to reels through a narrow interface (`ReelsEngine` in
// ReelsPresenter). pixi-reels' `ReelSet` surface is richer than our needs;
// this adapter maps the three things our FSM cares about:
//
//   - spin() / setResult(grid) — drives a round
//   - setAnticipation(reels)   — per-reel teaser hook
//   - setSpeedMode(mode)       — Normal / Turbo / Super Turbo
//   - showWin(winlines)        — WinPresenter animates cells + floating $ labels
//
// Uses pixi-reels 0.2+ APIs:
//   - WinPresenter  — built-in win animation (playWin, dim-losers, events)
//   - getCellBounds — accurate cell coordinates without hardcoded constants

import gsap from 'gsap';
import { Container, Text } from 'pixi.js';
import { WinPresenter } from 'pixi-reels';
import type { ReelSet, Win } from 'pixi-reels';
import type { Grid, Winline } from '@/domain/types';
import type { ReelsEngine } from '@/presenters/ReelsPresenter';
import type { SpeedMode } from '@/state/UIStore';
import type { Disposable } from '@/utils/Disposable';
import { FixedSpriteSymbol } from '@/view/symbols/FixedSpriteSymbol';

/** Maps UIStore SpeedMode to the pixi-reels SpeedPresets profile names. */
const SPEED_NAME: Record<SpeedMode, string> = {
  normal: 'normal',
  turbo: 'turbo',
  superTurbo: 'superTurbo',
};

/**
 * Win-animation duration multiplier per speed mode.
 * Applied to symbol tweens, floating label durations, WinPresenter stagger
 * and cycleGap, and the WinShowPhase hold timer.
 */
const WIN_SCALE: Record<SpeedMode, number> = {
  normal: 1,
  turbo: 0.6,
  superTurbo: 0.35,
};

function formatAmount(amount: number, currency: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).formatToParts(amount);
    return parts
      .filter((p) => p.type !== 'literal')
      .map((p) => p.value)
      .join('');
  } catch {
    // Fallback for browsers without narrowSymbol support.
    return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
  }
}

export function adaptReelSet(reelSet: ReelSet): ReelsEngine & Disposable {
  let spinPromise: Promise<unknown> | null = null;

  // WinPresenter handles playWin() calls on each winning cell and dims losers.
  // Rebuilt on every speed change so stagger, cycleGap, and symbol-anim duration
  // all scale together. setSpeedMode() runs at the start of SpinPhase, well
  // before any win animation begins, so there is never an in-flight presenter.
  let _winPresenterSpeed: SpeedMode = 'normal';
  function makeWinPresenter(speed: SpeedMode): WinPresenter {
    const scale = WIN_SCALE[speed];
    return new WinPresenter(reelSet, {
      dimLosers: { alpha: 0.35 },
      stagger: Math.round(60 * scale),   // left-to-right sweep across payline cells
      cycleGap: Math.round(400 * scale),
      symbolAnim: (symbol) => {
        if (symbol instanceof FixedSpriteSymbol) return symbol.playWin(scale);
        return Promise.resolve();
      },
    });
  }
  let winPresenter = makeWinPresenter('normal');

  // Layer for floating win amount labels — sits on top of the reelSet.
  const labelsLayer = new Container();
  reelSet.addChild(labelsLayer);

  /** Start idle shine on visible symbols of a single reel. */
  function startReelIdleAnims(reelIndex: number): void {
    const reel = reelSet.reels[reelIndex];
    if (!reel) return;
    for (let row = 0; row < reel.visibleRows; row++) {
      const sym = reel.getSymbolAt(row);
      if (sym instanceof FixedSpriteSymbol) sym.startIdleAnim();
    }
  }

  /** Start idle shine on ALL visible symbols (initial load + slam-stop fallback). */
  function startAllIdleAnims(): void {
    for (let i = 0; i < reelSet.reels.length; i++) startReelIdleAnims(i);
  }

  // Wire per-reel shine: each reel starts shining as it stops, not when the
  // last reel lands. spin:reelLanded fires even on slam-stop (0.4.0 patch).
  reelSet.events.on('spin:reelLanded', (reelIndex) => startReelIdleAnims(reelIndex));

  // Symbols are already placed on the initial grid — kick off their shine now.
  // Use a microtask so the reelSet container has been added to the stage first.
  Promise.resolve().then(startAllIdleAnims);

  /** Cleanup fn for the win:group / win:end listeners registered in showWin. */
  let removeWinListeners: (() => void) | null = null;

  // Tracked timelines for label animations — .kill() stops ALL sub-tweens
  // (label, label.scale, label.position) unlike gsap.killTweensOf() which
  // only kills tweens where the label itself is the direct target.
  const labelTimelines: gsap.core.Timeline[] = [];

  function clearLabels(): void {
    for (const tl of labelTimelines) tl.kill();
    labelTimelines.length = 0;
    labelsLayer.removeChildren().forEach((c) => c.destroy());
  }

  /** Spawn floating $ labels for a single winline's cells. */
  function spawnLabelsForWinline(line: Winline, currency: string, scale: number): void {
    const share = line.amount / line.positions.length;
    if (share <= 0) return; // skip labels for zero-value wins (e.g. cinematic reveal)
    for (const pos of line.positions) {
      // getCellBounds gives accurate reelSet-local coords without hardcoded constants.
      const b = reelSet.getCellBounds(pos.reel, pos.row);
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;

      const label = new Text({
        text: formatAmount(share, currency),
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
      label.position.set(cx, cy);
      label.alpha = 0;
      label.scale.set(0.5);
      labelsLayer.addChild(label);

      const tl = gsap.timeline()
        .to(label, { alpha: 1, duration: 0.15 * scale, ease: 'power2.out' }, 0)
        .to(label.scale, { x: 1.15, y: 1.15, duration: 0.18 * scale, ease: 'back.out(2)' }, 0)
        .to(label.scale, { x: 1, y: 1, duration: 0.12 * scale, ease: 'power2.inOut' }, 0.18 * scale)
        .to(label.position, { y: cy - 48, duration: 0.9 * scale, ease: 'power1.out' }, 0.2 * scale)
        .to(label, { alpha: 0, duration: 0.35 * scale, ease: 'power2.in' }, 0.75 * scale)
        .call(() => {
          const idx = labelTimelines.indexOf(tl);
          if (idx >= 0) labelTimelines.splice(idx, 1);
          label.destroy();
        }, undefined, 1.1 * scale);
      labelTimelines.push(tl);
    }
  }

  return {
    async spin() {
      spinPromise = reelSet.spin();
      // Don't await — SpinPhase runs this concurrently with the network call.
    },
    async setResult(grid: Grid, onPenultimate?: () => void) {
      // Resolve as soon as the last reel visually snaps to its result position
      // (spin:reelLanded fires synchronously in the animation frame where each
      // reel stops). Resolving here — rather than on spinPromise — removes the
      // one-frame delay between the visual landing and any sound/logic that
      // follows (e.g. the no-win stop sound).
      const numReels = reelSet.reels.length;
      let landedCount = 0;
      let resolveLanded!: () => void;
      const landedPromise = new Promise<void>((r) => { resolveLanded = r; });
      const onLanded = () => {
        ++landedCount;
        // Fire the penultimate callback one reel before the last so callers can
        // trigger audio that perceptually aligns with the final reel settling.
        if (landedCount === numReels - 1 && onPenultimate) onPenultimate();
        if (landedCount >= numReels) resolveLanded();
      };
      reelSet.events.on('spin:reelLanded', onLanded);

      // pixi-reels 1.x takes ColumnTarget[] ({ visible }) — the legacy
      // string[][] form was removed in 1.0.0. Grid is [reel][row], so each
      // row-array maps straight onto one column's `visible`.
      reelSet.setResult(grid.map((visible) => ({ visible })));
      await landedPromise;
      reelSet.events.off('spin:reelLanded', onLanded);

      // Let spinPromise drain in the background so pixi-reels finalises its
      // internal state before the next round. By the time WinShowPhase ends
      // (~450 ms minimum) this will have long resolved.
      const p = spinPromise;
      spinPromise = null;
      p?.catch(() => undefined);
    },
    setAnticipation(reels: number[]) {
      if (reels.length > 0) reelSet.setAnticipation(reels);
    },
    setSpeedMode(mode: SpeedMode) {
      reelSet.setSpeed(SPEED_NAME[mode]);
      if (mode !== _winPresenterSpeed) {
        winPresenter.destroy();
        winPresenter = makeWinPresenter(mode);
        _winPresenterSpeed = mode;
      }
    },
    forceStop() {
      // requestSkip() queues the slam-stop if setResult() hasn't arrived yet,
      // preventing the reel from snapping onto mid-scroll buffer state.
      reelSet.requestSkip();
    },
    showWin(winlines: Winline[], currency: string) {
      if (winlines.length === 0) return;

      // Set win.id = index into winlines so the win:group handler can find
      // the matching Winline without relying on object-reference Map lookups
      // (WinPresenter sorts wins before iterating, but preserves each object).
      const wins: Win[] = winlines.map((w, i) => ({
        cells: w.positions.map((p) => ({ reelIndex: p.reel, rowIndex: p.row })),
        value: w.amount,
        id: i,
      }));

      // Tear down any leftover listeners from a previous (cleared) show.
      removeWinListeners?.();

      // Spawn labels only when WinPresenter starts showing that specific win,
      // so labels appear in sync with the cell animations — not all at once.
      // Also clear any labels from the previous win first — cells can overlap
      // between lines, and stacking two labels at the same position causes jitter.
      const winScale = WIN_SCALE[_winPresenterSpeed];
      function onWinGroup(win: Win): void {
        clearLabels();
        const line = win.id !== undefined ? winlines[win.id] : undefined;
        if (line) spawnLabelsForWinline(line, currency, winScale);
      }
      function onWinEnd(reason: string): void {
        removeWinListeners?.();
      }
      reelSet.events.on('win:group', onWinGroup);
      reelSet.events.on('win:end', onWinEnd);
      removeWinListeners = () => {
        reelSet.events.off('win:group', onWinGroup);
        reelSet.events.off('win:end', onWinEnd);
        removeWinListeners = null;
      };

      void winPresenter.show(wins);
    },
    clearWin() {
      removeWinListeners?.();
      winPresenter.abort();
      clearLabels();
    },
    dispose() {
      winPresenter.destroy();
      reelSet.destroy();
    },
  };
}