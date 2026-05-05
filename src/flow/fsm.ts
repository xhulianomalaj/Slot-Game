// The FSM owns game time. Phases run to completion and call `fsm.transition`
// to move on. No other subsystem schedules top-level game flow.

import type { Phase, PhaseContext } from './Phase';

export class FSM {
  private current: Phase | null = null;
  private phases = new Map<string, Phase>();
  private ctx: Omit<PhaseContext, 'fsm'>;

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
