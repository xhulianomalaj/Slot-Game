// ScriptableMockNetwork — the mock you can drive from tests.
//
// Every test wants different things: a specific grid, a forced server error,
// a 5-second hang, a connection drop in the middle of a spin. Stuffing all
// that into MockNetworkManager would turn it into a paytable substitute and
// violate principle #1 (the client does not evaluate). Instead, this is a
// pure transport adapter that asks the *test* what the server should say.
//
// The contract:
//
//   - `setSession(...)` programs the next session response (or error).
//   - `queueSpin(...)` appends to a FIFO queue used by the next `spin()` call.
//   - `simulateOffline()` puts the network into a state where every pending
//     and future request hangs until `simulateOnline()` is called. This
//     mirrors what happens when a real WebSocket drops mid-round.
//   - `history` records every request and outcome, in order, for assertions.
//
// If the queue is empty when `spin()` is called, the network falls back to a
// deterministic "no-win" response so the happy path still boots without
// scripting. Tests that care about the response should always queue first.

import type { SessionRequest, SessionResponse, SpinRequest, SpinResponse } from '@/domain/types';
import type { NetworkManager } from './types';

export interface ScriptableMockOptions {
  symbolIds: readonly string[];
  columns: number;
  rows: number;
  startingBalance?: number;
  /**
   * Default delay (ms) applied to scripted responses when the script
   * doesn't specify one. 0 means "next microtask". Default 0 — fast tests
   * by default; opt into latency per-response when you want it.
   */
  defaultDelayMs?: number;
}

export type ScriptedSpin =
  | {
      kind: 'response';
      response: Partial<SpinResponse>;
      delayMs?: number;
    }
  | {
      kind: 'error';
      error: Error;
      delayMs?: number;
    };

export type ScriptedSession =
  | { kind: 'response'; response: Partial<SessionResponse>; delayMs?: number }
  | { kind: 'error'; error: Error; delayMs?: number };

export interface NetworkHistoryEntry {
  kind: 'session' | 'spin';
  request: SessionRequest | SpinRequest;
  outcome: 'resolved' | 'rejected' | 'pending';
  startedAt: number;
  resolvedAt?: number;
  /** When kind === 'spin', the response or error returned. */
  response?: SpinResponse | SessionResponse;
  error?: Error;
}

interface PendingDeferred {
  resolve: () => void;
  reject: (e: Error) => void;
  /** Called when the deferred actually fires its scripted outcome. */
  fire: () => void;
}

export class ScriptableMockNetwork implements NetworkManager {
  private balance: number;
  private readonly defaultDelayMs: number;
  private spinQueue: ScriptedSpin[] = [];
  private nextSession: ScriptedSession | null = null;
  private offline = false;
  private pending: PendingDeferred[] = [];
  readonly history: NetworkHistoryEntry[] = [];

  constructor(private readonly opts: ScriptableMockOptions) {
    this.balance = opts.startingBalance ?? 100;
    this.defaultDelayMs = opts.defaultDelayMs ?? 0;
  }

  // ─── Programming surface ──────────────────────────────────────────

  /** Replace whatever was programmed for the next `session()` call. */
  setSession(scripted: ScriptedSession): void {
    this.nextSession = scripted;
  }

  /** Append one scripted spin outcome to the FIFO queue. */
  queueSpin(scripted: ScriptedSpin): void {
    this.spinQueue.push(scripted);
  }

  /**
   * Convenience: queue a winning spin. If you don't pass winlines, the mock
   * synthesizes one so the WinShowPhase actually credits the wallet — the
   * phase ignores `totalWin` when `winlines.length === 0`. Provide real
   * winlines when the test asserts spotlight positions.
   */
  queueWin(grid: SpinResponse['grid'], totalWin: number, winlines?: SpinResponse['winlines']): void {
    const lines: SpinResponse['winlines'] = winlines ?? [
      {
        lineId: 0,
        symbolId: grid[0]?.[0] ?? 'cherry',
        matchCount: 1,
        amount: totalWin,
        positions: [{ reel: 0, row: 0 }],
      },
    ];
    this.queueSpin({
      kind: 'response',
      response: { grid, totalWin, winlines: lines },
    });
  }

  /** Convenience: queue a losing spin with the given grid. */
  queueLoss(grid: SpinResponse['grid']): void {
    this.queueSpin({
      kind: 'response',
      response: { grid, totalWin: 0, winlines: [] },
    });
  }

  /** Convenience: the next spin will reject after `delayMs`. */
  queueError(error: Error | string, delayMs?: number): void {
    this.queueSpin({
      kind: 'error',
      error: error instanceof Error ? error : new Error(error),
      ...(delayMs !== undefined ? { delayMs } : {}),
    });
  }

  /**
   * Put the transport into "offline" mode: every in-flight and future
   * request hangs forever until `simulateOnline()` is called. Use this to
   * test connection-loss banners, retry UIs, and round-recovery paths.
   */
  simulateOffline(): void {
    this.offline = true;
  }

  /** Restore connectivity. Pending requests resolve their scripted outcome. */
  simulateOnline(): void {
    this.offline = false;
    const drained = this.pending.splice(0);
    for (const d of drained) d.fire();
  }

  /** Drop the queue and resolve nothing — useful between tests. */
  reset(startingBalance = this.balance): void {
    this.spinQueue = [];
    this.nextSession = null;
    this.balance = startingBalance;
    for (const p of this.pending) p.reject(new Error('[ScriptableMockNetwork] reset while pending'));
    this.pending = [];
    this.history.length = 0;
  }

  /** How many requests are currently hanging (because of `simulateOffline`). */
  get pendingCount(): number {
    return this.pending.length;
  }

  /** How many spins are still queued. */
  get queuedSpinCount(): number {
    return this.spinQueue.length;
  }

  // ─── NetworkManager implementation ────────────────────────────────

  async session(req: SessionRequest): Promise<SessionResponse> {
    const entry: NetworkHistoryEntry = {
      kind: 'session',
      request: req,
      outcome: 'pending',
      startedAt: Date.now(),
    };
    this.history.push(entry);

    const scripted = this.nextSession ?? this.defaultSession();
    this.nextSession = null;

    await this.gate(scripted.delayMs ?? this.defaultDelayMs);

    if (scripted.kind === 'error') {
      entry.outcome = 'rejected';
      entry.resolvedAt = Date.now();
      entry.error = scripted.error;
      throw scripted.error;
    }
    const response: SessionResponse = { ...this.defaultSessionBody(), ...scripted.response };
    this.balance = response.balance;
    entry.outcome = 'resolved';
    entry.resolvedAt = Date.now();
    entry.response = response;
    return response;
  }

  async spin(req: SpinRequest): Promise<SpinResponse> {
    const entry: NetworkHistoryEntry = {
      kind: 'spin',
      request: req,
      outcome: 'pending',
      startedAt: Date.now(),
    };
    this.history.push(entry);

    const scripted = this.spinQueue.shift() ?? this.defaultSpin();

    await this.gate(scripted.delayMs ?? this.defaultDelayMs);

    if (scripted.kind === 'error') {
      entry.outcome = 'rejected';
      entry.resolvedAt = Date.now();
      entry.error = scripted.error;
      throw scripted.error;
    }

    // Balance contract: the server returns POST-WIN balance — bet already
    // debited and win already credited. WinShowPhase only updates the win
    // counter; it does NOT credit again. See domain/types.ts.
    const totalWin = scripted.response.totalWin ?? 0;
    const postDebit = Math.max(0, this.balance - req.bet);
    const postWin = postDebit + totalWin;
    const responseBalance = scripted.response.balance ?? postWin;
    // Track the running wallet so consecutive spins compose correctly.
    this.balance = responseBalance;

    const response: SpinResponse = {
      grid: scripted.response.grid ?? this.defaultGrid(),
      totalWin,
      winlines: scripted.response.winlines ?? [],
      ...(scripted.response.teasingReels ? { teasingReels: scripted.response.teasingReels } : {}),
      ...(scripted.response.bonus ? { bonus: scripted.response.bonus } : {}),
      balance: responseBalance,
    };
    entry.outcome = 'resolved';
    entry.resolvedAt = Date.now();
    entry.response = response;
    return response;
  }

  // ─── Internals ────────────────────────────────────────────────────

  /**
   * Wait `delayMs` then resolve — but if the network is offline, hang
   * until `simulateOnline()` is called. Tests that toggle offline in the
   * middle of a request use this to verify the spinning UI stays stuck.
   */
  private gate(delayMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = delayMs > 0 ? globalThis.setTimeout(() => fire(), delayMs) : null;
      const fire = () => {
        if (timer != null) globalThis.clearTimeout(timer);
        if (this.offline) {
          // Re-queue: wait for online.
          this.pending.push({ resolve, reject, fire });
          return;
        }
        resolve();
      };
      if (this.offline) {
        if (timer != null) globalThis.clearTimeout(timer);
        this.pending.push({ resolve, reject, fire });
      } else if (delayMs <= 0) {
        // Microtask resolution — keeps spec ordering deterministic.
        Promise.resolve().then(fire);
      }
    });
  }

  private defaultSession(): ScriptedSession {
    return { kind: 'response', response: {} };
  }

  private defaultSessionBody(): SessionResponse {
    return {
      sessionId: 'scripted-session',
      balance: this.balance,
      currency: 'USD',
      availableBets: [0.2, 0.5, 1, 2, 5, 10, 25, 50, 100],
      defaultBet: 1,
      columns: this.opts.columns,
      rows: this.opts.rows,
    };
  }

  private defaultSpin(): ScriptedSpin {
    return {
      kind: 'response',
      response: { grid: this.defaultGrid(), totalWin: 0, winlines: [] },
    };
  }

  private defaultGrid(): SpinResponse['grid'] {
    // Deterministic — pick the first symbol id everywhere so unscripted
    // spins are reproducible. Tests that assert on grid contents should
    // queue an explicit response.
    const sym = this.opts.symbolIds[0] ?? 'symbol';
    return Array.from({ length: this.opts.columns }, () => Array.from({ length: this.opts.rows }, () => sym));
  }
}
