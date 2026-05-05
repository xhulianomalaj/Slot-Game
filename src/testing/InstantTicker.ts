// InstantTicker — fires every scheduled callback as soon as the current
// microtask drains. Use it in test mode so phases that hold for animation
// (WinShowPhase's win-hold) advance instantly. Real game code never sees
// this — the FSM just calls `ticker.schedule(N, fn)` and trusts the impl.
//
// Why a separate class instead of `setTimeout(fn, 0)`: principle #2 forbids
// `setTimeout` in game code, and we want test runs deterministic — every
// scheduled callback drains synchronously per microtask, so a sequence of
// transitions completes in a fixed number of awaits.

import type { Ticker } from '@/infrastructure/timing';
import type { Disposable } from '@/utils/Disposable';

export class InstantTicker implements Ticker {
  schedule(_delayMs: number, fn: () => void): Disposable {
    let killed = false;
    queueMicrotask(() => {
      if (!killed) fn();
    });
    return {
      dispose: () => {
        killed = true;
      },
    };
  }

  every(_intervalMs: number, _fn: () => void): Disposable {
    // Repeating timers in tests are almost always a bug — they trigger
    // unbounded recursion if `_fn` schedules another spin. Tests should
    // call the action they want directly, not wait for an interval.
    return { dispose: () => {} };
  }

  nextFrame(fn: () => void): Disposable {
    return this.schedule(0, fn);
  }
}
