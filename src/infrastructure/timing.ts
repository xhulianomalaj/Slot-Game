// Ticker — the only place in slotplate that schedules time.
//
// Principle #2: no setTimeout / setInterval in game code. setTimeout keeps
// firing in hidden tabs while the Pixi ticker pauses, producing desyncs and
// leaked callbacks. GSAP's delayedCall, when GSAP is synced to app.ticker,
// pauses and resumes with the game.
//
// Every scheduled call returns a Disposable so the owner can cancel on
// scene/phase exit without remembering any handles.

import gsap from 'gsap';
import type { Disposable } from '@/utils/Disposable';

export interface Ticker {
  /** Call `fn` once after `delayMs` milliseconds. Pauses with the app. */
  schedule(delayMs: number, fn: () => void): Disposable;
  /** Call `fn` every `intervalMs` milliseconds until disposed. */
  every(intervalMs: number, fn: () => void): Disposable;
  /** Call `fn` on the next frame. */
  nextFrame(fn: () => void): Disposable;
}

export class GsapTicker implements Ticker {
  schedule(delayMs: number, fn: () => void): Disposable {
    const tween = gsap.delayedCall(delayMs / 1000, fn);
    return { dispose: () => tween.kill() };
  }

  every(intervalMs: number, fn: () => void): Disposable {
    let killed = false;
    const loop = () => {
      if (killed) return;
      fn();
      tween = gsap.delayedCall(intervalMs / 1000, loop);
    };
    let tween = gsap.delayedCall(intervalMs / 1000, loop);
    return {
      dispose: () => {
        killed = true;
        tween.kill();
      },
    };
  }

  nextFrame(fn: () => void): Disposable {
    const tween = gsap.delayedCall(0, fn);
    return { dispose: () => tween.kill() };
  }
}

/**
 * Sync GSAP's ticker to the Pixi app.ticker. Call once during composition,
 * before any scene mounts. Without this, GSAP runs on its own rAF loop and
 * keeps going in hidden tabs while Pixi pauses.
 *
 * Pass any object with an `add(fn)` method — typically `app.ticker`.
 */
export function syncGsapToPixi(pixiTicker: { add: (fn: () => void) => void }): void {
  gsap.ticker.remove(gsap.updateRoot);
  pixiTicker.add(() => gsap.updateRoot(performance.now() / 1000));
}
