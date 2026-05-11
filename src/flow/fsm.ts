// The FSM owns game time. Phases run to completion and call `fsm.transition`
// to move on. No other subsystem schedules top-level game flow.

import type { Phase, PhaseContext } from './Phase';

export class FSM {
  private current: Phase | null = null;
  private phases = new Map<string, Phase>();
  private ctx: Omit<PhaseContext, 'fsm'>;
  // True while any spin chain is in-flight (spin → stopSpin → winShow → …).
  // Cleared only when we enter 'idle'. External spin requests are dropped
  // unless the current phase is 'winShow' (internal autoplay continuation)
  // or the FSM hasn't started yet.
  private _spinInFlight = false;

  constructor(ctx: Omit<PhaseContext, 'fsm'>) {
    this.ctx = ctx;
  }

  /**
   * Patch the shared phase context after construction. Used by composition
   * to resolve the circular hud↔fsm dependency without a hidden cast.
   */
  patchContext(patch: Partial<Omit<PhaseContext, 'fsm'>>): void {
    this.ctx = { ...this.ctx, ...patch };
  }

  register(phase: Phase): void {
    if (this.phases.has(phase.name)) {
      throw new Error(`[FSM] phase already registered: ${phase.name}`);
    }
    this.phases.set(phase.name, phase);
  }

  async transition(to: string): Promise<void> {
    if (to === 'spin') {
      const currentPhaseName = this.current?.name ?? null;
      // Allow the transition only if:
      //  a) no spin is running yet, OR
      //  b) we're inside WinShowPhase continuing the autoplay chain
      const isInternalContinuation = currentPhaseName === 'winShow' || currentPhaseName === null;
      if (this._spinInFlight && !isInternalContinuation) {
        return;
      }
      this._spinInFlight = true;
    }
    if (to === 'idle') {
      this._spinInFlight = false;
    }

    const next = this.phases.get(to);
    if (!next) throw new Error(`[FSM] unknown phase: ${to}`);
    if (this.current) {
      try {
        this.current.exit?.(this.context());
      } catch (err) {
        console.error(`[FSM] exit failed for ${this.current.name}`, err);
      }
    }
    this.current = next;
    await next.enter(this.context());
  }

  skip(): void {
    this.current?.skip?.(this.context());
  }

  get phase(): string | null {
    return this.current?.name ?? null;
  }

  private context(): PhaseContext {
    return { ...this.ctx, fsm: this };
  }
}
