// Phase registry. Composition imports `PHASES` and registers each one
// with the FSM. To add a phase:
//
//   1. Drop `MyPhase.ts` in this directory implementing `Phase`.
//   2. Append `new MyPhase()` to the array below.
//   3. Transition to it from another phase: `ctx.fsm.transition('myPhase')`.
//
// Phases are unit-testable without a canvas — see tests/flow/SpinPhase.test.ts.

import type { Phase } from '../Phase';
import { IdlePhase } from './IdlePhase';
import { SpinPhase } from './SpinPhase';
import { StopSpinPhase } from './StopSpinPhase';
import { WinShowPhase } from './WinShowPhase';

export const PHASES: Phase[] = [new IdlePhase(), new SpinPhase(), new StopSpinPhase(), new WinShowPhase()];

export { IdlePhase, SpinPhase, StopSpinPhase, WinShowPhase };
