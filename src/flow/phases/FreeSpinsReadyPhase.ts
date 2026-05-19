import type { Phase, PhaseContext } from '../Phase';

// FreeSpinsReadyPhase — the FSM idles here after free spins are awarded,
// waiting for the player to click the "Start" button. The spin button detects
// ui.freeSpinsAwaitingStart and renders itself as "Start" instead of "Spin".
// When clicked it calls ui.setFreeSpinsAwaitingStart(false) and transitions
// to 'spin', which the FSM allows because freeSpinsReady clears _spinInFlight.

export class FreeSpinsReadyPhase implements Phase {
  readonly name = 'freeSpinsReady';

  enter(ctx: PhaseContext): void {
    ctx.stores.ui.setSpinning(false);
  }
}
