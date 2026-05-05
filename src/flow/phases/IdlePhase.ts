import type { Phase, PhaseContext } from '../Phase';

export class IdlePhase implements Phase {
  readonly name = 'idle';

  enter(ctx: PhaseContext): void {
    ctx.stores.ui.setSpinning(false);
  }
}
