// TestBridge — the surface that Playwright (or any external driver) talks to.
//
// Mounted on `window.__SLOTPLATE_TEST` when the app boots in test mode
// (`?test=1` URL param, or the `testMode: true` compose option). Outside
// test mode the bridge is never constructed — production bundles cannot
// expose this surface even if the URL param is forged.
//
// Design rules:
//
//   1. Every method is synchronous-or-Promise. No callbacks, no events.
//      Playwright-friendly: `await page.evaluate(t => t.spin())`.
//   2. State queries return plain JSON. Never return MobX observables —
//      they don't survive structured-clone across the page boundary.
//   3. Wait helpers use MobX `reaction` so they never poll. They settle
//      on the first matching state and dispose themselves.
//   4. The bridge owns nothing — it's a remote control over things owned
//      by composition. Disposing the bridge tears down its own listeners
//      only, not the app it's controlling.

import gsap from 'gsap';
import { reaction } from 'mobx';
import type { Application, Container } from 'pixi.js';
import type { SpinResponse, Winline } from '@/domain/types';
import type { FSM } from '@/flow/fsm';
import type { ScriptableMockNetwork } from '@/infrastructure/network/ScriptableMockNetwork';
import type { RootStore } from '@/state/RootStore';

export interface TestBridgeOptions {
  stores: RootStore;
  fsm: FSM;
  network: ScriptableMockNetwork;
  /**
   * The Pixi Application — needed for clickPixi/pixiBounds and ticker
   * pause/resume. Optional only because composition wires this lazily;
   * the methods that need it throw a clear error when it's missing.
   */
  app?: Application;
  /**
   * Whether the composition swapped in headless stubs (InstantTicker +
   * StubReelsEngine). Surfaced so the inspector can label the session
   * `live` vs `stubs` and the recorder spec output can warn about
   * stub-only behavior. Defaults to `false` (real engine).
   */
  usesStubs?: boolean;
}

export interface PixiBounds {
  /** Test label of the matched node. */
  label: string;
  /** Top-left x in renderer (canvas) coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Center x in renderer coordinates — pass to a Playwright canvas-click. */
  centerX: number;
  centerY: number;
  visible: boolean;
}

export interface BridgeStateSnapshot {
  phase: string | null;
  spinning: boolean;
  bet: number;
  balance: number;
  lastWin: number;
  totalWin: number;
  bootStage: string;
  loadProgress: number;
  loadError: string | null;
  autospinRemaining: number;
  pendingNetworkRequests: number;
  queuedSpins: number;
  /** Wall-clock duration of the last completed round, in milliseconds.
   *  Useful for `expect(state.lastRoundMs).toBeLessThan(50)` regressions. */
  lastRoundMs: number | null;
  /** Sound + language flags so locale-matrix and a11y specs can read them. */
  language: string;
  soundEnabled: boolean;
  menuOpen: boolean;
  menuTab: string;
}

export interface FsmTransition {
  /** Phase entered. */
  to: string;
  /** ms since boot. */
  at: number;
  /** ms spent in the previous phase. */
  prevDurationMs: number | null;
}

export interface RecordedAction {
  /** Bridge method name as written in a spec (e.g. `queueWin`, `clickPixi`). */
  method: string;
  /** Args passed to the method, JSON-cloneable. */
  args: unknown[];
  /** ms since recording started. */
  t: number;
}

export interface AudioEvent {
  /** Logical sound name — `'win-show'`, `'click'`, `'spin-start'`, ... */
  name: string;
  /** ms since boot. */
  at: number;
  /** Optional metadata the engine wants to surface (volume, channel, …). */
  meta?: Record<string, unknown>;
}

export interface BridgeFullDump {
  /** Test scenario id (`?test=<id>`), or null if not named. */
  testId: string | null;
  /** Snapshot of state at dump time. */
  state: BridgeStateSnapshot;
  /** Network request log since boot. */
  networkHistory: ReturnType<ScriptableMockNetwork['history']['slice']>;
  /** FSM transition log since boot. */
  fsmTransitions: FsmTransition[];
  /** Pixi a11y tree: every labeled node + bounds + visibility. */
  pixiTree: PixiBounds[];
  /** Current grid the view is displaying. */
  grid: string[][];
  /** Audio cue log since boot — populated by `bridge.recordAudio()`. */
  audioLog: AudioEvent[];
  /** Active recording buffer (or empty when not recording). */
  recording: RecordedAction[];
  /** Wall-clock when the dump was taken (epoch ms). */
  capturedAt: number;
}

const DEFAULT_WAIT_MS = 5_000;

/** Bridge methods that return a Promise — used by the recorder's spec-formatter. */
const AWAITED_ACTIONS = new Set<string>(['spin', 'recoverFromError', 'replay']);

export class TestBridge {
  /**
   * Test identifier from the `?test=<id>` URL parameter, or `null` when
   * test mode was enabled some other way (e.g. the env var or compose
   * option). Tests can use this to correlate failures with scenario names
   * and the dev/UI can display "running: <id>".
   */
  readonly testId: string | null;

  /**
   * True when the composition is using `InstantTicker` + `StubReelsEngine`
   * instead of the real Pixi/GSAP pipeline. Inspector renders `stubs` vs
   * `live` based on this; the recorded `.spec.ts` output uses it to add a
   * comment when the recorded session won't replay one-to-one in the real
   * engine (e.g. animation timings).
   */
  readonly usesStubs: boolean;

  /** Boot wall-clock — used to compute `lastRoundMs` and FSM-transition deltas. */
  private readonly bootedAt = Date.now();
  /** Most recent `idle → spin` start time, in ms-since-boot. */
  private spinStartedAtMs: number | null = null;
  /** Wall-clock duration of the most recently completed round. */
  private lastRoundMs: number | null = null;
  /** FSM transition log since boot. */
  private readonly transitions: FsmTransition[] = [];

  // ─── Recorder ────────────────────────────────────────────────────
  // The buffer always exists; `recordingActive` flips on/off whether
  // method calls are appended. Stopping doesn't clear — `getRecording()`
  // / `formatAsSpec()` keep working until you start a new session.
  private readonly recordingBuffer: RecordedAction[] = [];
  private recordingActive = false;
  private recordingStartedAt = 0;

  // ─── Audio event log ─────────────────────────────────────────────
  // Audio engines call `bridge.recordAudio(name)` whenever they fire a
  // cue. Tests assert with `expect(state.audioLog).toContain('win-show')`.
  private readonly audioEvents: AudioEvent[] = [];

  // ─── Visual snapshots ────────────────────────────────────────────
  // The bridge can capture the Pixi canvas to a PNG data URL so the
  // popout inspector can show a thumbnail strip. localStorage-backed in
  // the popout, not retained in-bridge — the bridge is just a producer.

  constructor(private readonly opts: TestBridgeOptions) {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('test');
      // `1` / `true` are "boot in test mode without a name" — return null.
      // Any other non-empty value is the scenario id.
      this.testId =
        param && param !== '1' && param !== 'true' && param !== '0' && param !== 'false' && param !== 'off'
          ? param
          : null;
    } else {
      this.testId = null;
    }
    this.usesStubs = opts.usesStubs ?? false;
    this.installFsmTransitionTap();
  }

  /**
   * Wrap `fsm.transition` so we record every phase change and compute the
   * wall-clock duration of each round. Tests get this for free in
   * `state().lastRoundMs` — useful for catching real-time animations that
   * leak into instant-mode tests.
   */
  private installFsmTransitionTap(): void {
    const fsm = this.opts.fsm;
    const orig = fsm.transition.bind(fsm);
    fsm.transition = async (to: string) => {
      const at = Date.now() - this.bootedAt;
      const prev = this.transitions[this.transitions.length - 1];
      const prevDurationMs = prev ? at - prev.at : null;
      this.transitions.push({ to, at, prevDurationMs });
      if (to === 'spin' && fsm.phase === 'idle') this.spinStartedAtMs = at;
      const result = await orig(to);
      // When we arrive at `idle` from a non-idle predecessor, that closes a round.
      if (to === 'idle' && this.spinStartedAtMs !== null) {
        this.lastRoundMs = Date.now() - this.bootedAt - this.spinStartedAtMs;
        this.spinStartedAtMs = null;
      }
      return result;
    };
  }

  /**
   * Late-bind the Pixi Application — composition calls this after
   * `MainScene.init()` finishes. Bridge methods that need the app
   * (clickPixi, pauseTicker, etc.) throw a clear error if called before
   * this lands.
   */
  attachApp(app: Application): void {
    this.opts.app = app;
  }

  // ─── State ────────────────────────────────────────────────────────

  state(): BridgeStateSnapshot {
    const { stores, fsm, network } = this.opts;
    return {
      phase: fsm.phase,
      spinning: stores.ui.spinning,
      bet: stores.balance.bet,
      balance: stores.balance.balance,
      lastWin: stores.balance.lastWin,
      totalWin: stores.data.totalWin,
      bootStage: stores.ui.bootStage,
      loadProgress: stores.ui.loadProgress,
      loadError: stores.ui.loadError,
      autospinRemaining: stores.ui.autospinRemaining,
      pendingNetworkRequests: network.pendingCount,
      queuedSpins: network.queuedSpinCount,
      lastRoundMs: this.lastRoundMs,
      language: stores.ui.language,
      soundEnabled: stores.ui.soundEnabled,
      menuOpen: stores.ui.menuOpen,
      menuTab: stores.ui.menuTab,
    };
  }

  /** FSM transition log since boot — useful in failure artifacts. */
  fsmTransitions(): FsmTransition[] {
    return this.transitions.slice();
  }

  /**
   * Everything-in-one-call dump. The fixture attaches this as JSON to every
   * failed test so a triage engineer can paste the file into a bug report
   * and reproduce immediately.
   */
  dumpAll(): BridgeFullDump {
    return {
      testId: this.testId,
      state: this.state(),
      networkHistory: this.networkHistory(),
      fsmTransitions: this.fsmTransitions(),
      pixiTree: this.a11yTree(),
      grid: this.grid(),
      audioLog: this.audioLog(),
      recording: this.getRecording(),
      capturedAt: Date.now(),
    };
  }

  /** Network call log since boot (or last `reset()`). */
  networkHistory(): ReturnType<ScriptableMockNetwork['history']['slice']> {
    return this.opts.network.history.slice();
  }

  /** Current grid the view is displaying. */
  grid(): string[][] {
    return this.opts.stores.data.grid.map((reel) => reel.slice());
  }

  // ─── Network programming (delegated to the mock) ──────────────────

  /** Replace whatever was programmed for the next session call. */
  setSession(...args: Parameters<ScriptableMockNetwork['setSession']>): void {
    this.opts.network.setSession(...args);
  }

  /** Append a scripted spin outcome to the FIFO queue. */
  queueSpin(...args: Parameters<ScriptableMockNetwork['queueSpin']>): void {
    this.opts.network.queueSpin(...args);
  }

  queueWin(grid: string[][], totalWin: number, winlines?: Winline[]): void {
    this.record('queueWin', winlines !== undefined ? [grid, totalWin, winlines] : [grid, totalWin], () =>
      this.opts.network.queueWin(grid, totalWin, ...(winlines ? [winlines] : ([] as []))),
    );
  }

  queueLoss(grid: string[][]): void {
    this.record('queueLoss', [grid], () => this.opts.network.queueLoss(grid));
  }

  queueError(error: Error | string, delayMs?: number): void {
    const msg = typeof error === 'string' ? error : error.message;
    this.record('queueError', delayMs !== undefined ? [msg, delayMs] : [msg], () =>
      this.opts.network.queueError(error, delayMs),
    );
  }

  simulateOffline(): void {
    this.record('simulateOffline', [], () => this.opts.network.simulateOffline());
  }

  simulateOnline(): void {
    this.record('simulateOnline', [], () => this.opts.network.simulateOnline());
  }

  /**
   * Reset the mock network's state. If `startingBalance` is provided, the
   * BalanceStore is also synced — by this point the boot session has already
   * resolved, so resetting the mock alone wouldn't update the wallet on
   * screen.
   */
  resetNetwork(startingBalance?: number): void {
    this.opts.network.reset(startingBalance);
    if (startingBalance !== undefined) {
      this.opts.stores.balance.setBalance(startingBalance);
    }
  }

  // ─── Actions (drive the FSM / stores directly) ────────────────────

  /**
   * Trigger a spin. Equivalent to clicking the Spin button when idle, but
   * bypasses pointer-event timing so test ordering is deterministic.
   * Resolves when the spin reaches `idle` again (one full round).
   *
   * In instant mode (the default), the bridge auto-skips the reel-stop
   * animation and the win-hold so the round completes in ~milliseconds
   * instead of seconds. Pass `{ instant: false }` to wait for real
   * animations (slow — only useful when asserting on motion timing).
   */
  async spin(): Promise<void> {
    if (this.opts.fsm.phase !== 'idle' && this.opts.fsm.phase !== null) {
      throw new Error(`[TestBridge] cannot spin from phase "${this.opts.fsm.phase}" — wait for idle first`);
    }
    // Record before the await so the recorded order matches the call order.
    this.record('spin', [], () => undefined);
    const transitionDone = this.opts.fsm.transition('spin');
    await Promise.race([transitionDone, this.waitForPhase('idle')]);
    await transitionDone;
  }

  /** Start a spin but DON'T wait for it to finish. Returns immediately. */
  startSpin(): void {
    if (this.opts.fsm.phase !== 'idle' && this.opts.fsm.phase !== null) {
      throw new Error(`[TestBridge] cannot startSpin from phase "${this.opts.fsm.phase}"`);
    }
    this.record('startSpin', [], () => {
      void this.opts.fsm.transition('spin');
    });
  }

  /** Skip whatever the current phase is doing (win-hold, anticipation, etc.). */
  skipPhase(): void {
    this.opts.fsm.skip();
  }

  /**
   * Force the FSM back to `idle` and reset the spinning UI flag. Use after
   * a spin rejected (network error, timeout) — without this, the FSM is
   * stuck in `spin` phase forever and subsequent spin calls fail.
   *
   * Real apps would handle this with a recovery phase; the bridge gives
   * tests a clean cut so they can keep scripting after they've asserted
   * what they wanted on the failure.
   */
  async recoverFromError(): Promise<void> {
    this.opts.stores.ui.setSpinning(false);
    await this.opts.fsm.transition('idle');
  }

  setBet(bet: number): void {
    this.record('setBet', [bet], () => this.opts.stores.balance.setBet(bet));
  }

  /** Dismiss the tap-to-start splash so subsequent clicks reach the HUD. */
  tapToStart(): void {
    this.record('tapToStart', [], () => this.opts.stores.ui.tapToStart());
  }

  startAutospin(rounds: number): void {
    this.record('startAutospin', [rounds], () => this.opts.stores.ui.startAutospin(rounds));
  }

  stopAutospin(): void {
    this.record('stopAutospin', [], () => this.opts.stores.ui.stopAutospin());
  }

  // ─── Wait helpers (Promise-returning, never poll) ─────────────────

  waitForPhase(name: string, timeoutMs: number = DEFAULT_WAIT_MS): Promise<void> {
    if (this.opts.fsm.phase === name) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        dispose();
        reject(
          new Error(
            `[TestBridge] waitForPhase("${name}") timed out after ${timeoutMs}ms; phase=${this.opts.fsm.phase}`,
          ),
        );
      }, timeoutMs);
      // We can't observe `fsm.phase` directly (not a MobX observable), so
      // poll lightly. The bridge itself drives the spin flow, so this only
      // fires while a transition is in progress.
      const tick = (): void => {
        if (this.opts.fsm.phase === name) {
          dispose();
          resolve();
          return;
        }
        rafId = globalThis.requestAnimationFrame(tick);
      };
      let rafId = globalThis.requestAnimationFrame(tick);
      const dispose = (): void => {
        globalThis.cancelAnimationFrame(rafId);
        globalThis.clearTimeout(timeout);
      };
    });
  }

  waitForBalance(target: number, timeoutMs: number = DEFAULT_WAIT_MS): Promise<void> {
    return this.waitForStore(
      () => this.opts.stores.balance.balance === target,
      `balance == ${target} (got ${this.opts.stores.balance.balance})`,
      timeoutMs,
    );
  }

  waitForSpinning(spinning: boolean, timeoutMs: number = DEFAULT_WAIT_MS): Promise<void> {
    return this.waitForStore(() => this.opts.stores.ui.spinning === spinning, `spinning == ${spinning}`, timeoutMs);
  }

  waitForBootReady(timeoutMs: number = 15_000): Promise<void> {
    return this.waitForStore(
      () => this.opts.stores.ui.bootStage === 'ready',
      `bootStage == "ready" (got "${this.opts.stores.ui.bootStage}")`,
      timeoutMs,
    );
  }

  // ─── Pixi labeled-object access ──────────────────────────────────

  /**
   * Walk the Pixi stage tree and return every node whose `.label` is
   * non-empty. Useful for sanity-checking what a test can find.
   */
  pixiLabels(): string[] {
    if (!this.opts.app) return [];
    const out: string[] = [];
    const walk = (n: Container): void => {
      if (n.label) out.push(String(n.label));
      for (const child of n.children) walk(child as Container);
    };
    walk(this.opts.app.stage);
    return out;
  }

  /**
   * The "accessibility tree" for the canvas: every labeled node plus its
   * bounds and visibility. This is what a screen reader or a QA engineer
   * needs to know to interact with Pixi-rendered UI without pixel-hunting.
   *
   * Authoring rule: every interactive Pixi `Container` should have a
   * `.label` set. The pixi-coverage spec asserts the required ones.
   */
  a11yTree(): PixiBounds[] {
    if (!this.opts.app) return [];
    const out: PixiBounds[] = [];
    const walk = (n: Container): void => {
      if (n.label) {
        const b = n.getBounds();
        out.push({
          label: String(n.label),
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          centerX: b.x + b.width / 2,
          centerY: b.y + b.height / 2,
          visible: n.visible,
        });
      }
      for (const child of n.children) walk(child as Container);
    };
    walk(this.opts.app.stage);
    return out;
  }

  /** Find a Pixi object by `.label` and return its bounds in canvas coords. */
  pixiBounds(label: string): PixiBounds | null {
    const node = this.findPixi(label);
    if (!node || !this.opts.app) return null;
    const b = node.getBounds();
    return {
      label,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      centerX: b.x + b.width / 2,
      centerY: b.y + b.height / 2,
      visible: node.visible,
    };
  }

  /**
   * Click a Pixi object by `.label`. Emits a `pointertap` event directly
   * on the matched container — bypasses hit-testing and z-order so test
   * ordering stays deterministic. For tests that need to verify the
   * pointer pipeline itself, drive Playwright's canvas click with the
   * coordinates returned by `pixiBounds(label)`.
   */
  clickPixi(label: string): void {
    this.record('clickPixi', [label], () => {
      const node = this.findPixi(label);
      if (!node)
        throw new Error(
          `[TestBridge] no pixi object with label "${label}". Available: ${this.pixiLabels().join(', ')}`,
        );
      // Pixi emits 'pointertap' for click handlers attached via `.on('pointertap', ...)`.
      // The handlers in slotplate ignore the event arg, so a partial event works.
      node.emit('pointertap', { type: 'pointertap', target: node } as never);
    });
  }

  private findPixi(label: string): Container | null {
    if (!this.opts.app) return null;
    const queue: Container[] = [this.opts.app.stage];
    while (queue.length > 0) {
      const node = queue.shift() as Container;
      if (node.label === label) return node;
      for (const child of node.children) queue.push(child as Container);
    }
    return null;
  }

  // ─── Ticker control ──────────────────────────────────────────────

  /**
   * Pause the Pixi app ticker AND GSAP. After this, no animation frame
   * progresses — perfect for capturing a deterministic screenshot mid-
   * round, or for stepping through frames manually.
   *
   * Call `resumeTicker()` to continue, or `tickFrames(n)` to step `n`
   * frames forward without leaving paused state.
   */
  pauseTicker(): void {
    if (this.opts.app) this.opts.app.ticker.stop();
    gsap.ticker.sleep();
  }

  resumeTicker(): void {
    if (this.opts.app) this.opts.app.ticker.start();
    gsap.ticker.wake();
  }

  /** Advance `n` frames manually. Useful when paused for screenshots. */
  tickFrames(n: number): void {
    if (!this.opts.app) return;
    for (let i = 0; i < n; i++) this.opts.app.ticker.update();
  }

  /** Generic MobX-reactive wait — settles the moment `predicate()` returns true. */
  waitForStore(predicate: () => boolean, description: string, timeoutMs: number = DEFAULT_WAIT_MS): Promise<void> {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = globalThis.setTimeout(() => {
        dispose();
        reject(new Error(`[TestBridge] waitForStore timed out (${description})`));
      }, timeoutMs);
      const dispose = reaction(
        predicate,
        (matched) => {
          if (matched) {
            globalThis.clearTimeout(timer);
            dispose();
            resolve();
          }
        },
        { fireImmediately: false },
      );
    });
  }

  // ─── Recorder API ────────────────────────────────────────────────

  /** Start capturing every action call. Wipes any previous buffer. */
  startRecording(): void {
    this.recordingBuffer.length = 0;
    this.recordingActive = true;
    this.recordingStartedAt = Date.now();
  }

  /** Stop capturing. The buffer is retained — read it with `getRecording()`. */
  stopRecording(): void {
    this.recordingActive = false;
  }

  isRecording(): boolean {
    return this.recordingActive;
  }

  getRecording(): RecordedAction[] {
    return this.recordingBuffer.slice();
  }

  /**
   * Format the recording buffer as a copy-pasteable Playwright scenario.
   * The result drops into `tests/scenarios/<name>.spec.ts` and runs.
   */
  formatAsSpec(testTitle = 'recorded scenario'): string {
    const actions = this.getRecording();
    const safeTitle = testTitle.replace(/'/g, "\\'");
    const lines: string[] = [
      "import { expect, test } from './slot-fixture';",
      '',
      `test('${safeTitle}', async ({ slot }) => {`,
      '  await slot.boot({ startingBalance: 100, bet: 1 });',
    ];
    for (const a of actions) {
      const argList = a.args.map((arg) => JSON.stringify(arg)).join(', ');
      const needsAwait = AWAITED_ACTIONS.has(a.method);
      lines.push(`  ${needsAwait ? 'await ' : ''}slot.${a.method}(${argList});`);
    }
    lines.push("  await slot.expectPhase('idle');");
    lines.push('});');
    return lines.join('\n');
  }

  /**
   * Internal: every public action method routes through this so the
   * recorder gets every call without needing a Proxy. Call sites stay
   * one line:
   *
   *     return this.record('queueLoss', [grid], () => network.queueLoss(grid));
   */
  private record<T>(method: string, args: unknown[], fn: () => T): T {
    if (this.recordingActive) {
      this.recordingBuffer.push({ method, args, t: Date.now() - this.recordingStartedAt });
    }
    return fn();
  }

  // ─── Audio recording ─────────────────────────────────────────────

  /**
   * Audio engine integration point. Wherever you fire a SFX cue:
   *
   *     window.__SLOTPLATE_TEST?.recordAudio('win-show', { volume: 0.8 });
   *
   * Then assert in tests:
   *
   *     expect(slot.audioLog().map(e => e.name)).toContain('win-show');
   */
  recordAudio(name: string, meta?: Record<string, unknown>): void {
    this.audioEvents.push({
      name,
      at: Date.now() - this.bootedAt,
      ...(meta ? { meta } : {}),
    });
  }

  audioLog(): AudioEvent[] {
    return this.audioEvents.slice();
  }

  clearAudioLog(): void {
    this.audioEvents.length = 0;
  }

  // ─── Visual snapshots ────────────────────────────────────────────

  /**
   * Capture the current Pixi canvas as a PNG data URL. Inspector popout
   * stores these in localStorage so QA can scrub through "before / after"
   * thumbnails for visual triage.
   */
  snapshotCanvas(): string | null {
    const canvas = this.opts.app?.canvas;
    if (!canvas) return null;
    try {
      return canvas.toDataURL('image/png');
    } catch {
      // Canvas may be tainted if cross-origin assets snuck in (shouldn't
      // happen with same-origin asset loading, but fail soft).
      return null;
    }
  }

  // ─── Higher-level QA actions ─────────────────────────────────────

  toggleSound(): void {
    this.record('toggleSound', [], () => this.opts.stores.ui.toggleSound());
  }

  setLanguage(lang: string): void {
    this.record('setLanguage', [lang], () => this.opts.stores.ui.setLanguage(lang));
  }

  openMenu(tab?: 'paytable' | 'info' | 'settings'): void {
    this.record('openMenu', tab !== undefined ? [tab] : [], () => this.opts.stores.ui.openMenu(tab));
  }

  closeMenu(): void {
    this.record('closeMenu', [], () => this.opts.stores.ui.closeMenu());
  }

  /** Drop the wallet to a chosen low value — for testing low-balance UI. */
  simulateLowBalance(value = 0): void {
    this.record('simulateLowBalance', [value], () => {
      this.opts.stores.balance.setBalance(value);
      this.opts.network.reset(value);
    });
  }

  // ─── Replay (from prod logs / CSVs / golden traces) ──────────────

  /**
   * Feed a sequence of `SpinResponse` payloads (e.g. from a server log) and
   * play each one as a spin. Returns the final state. The mock honors every
   * field of each response — totalWin, winlines, balance, teasingReels.
   *
   * Usage from a Playwright spec:
   *
   *   const log = JSON.parse(fs.readFileSync('./repro-spinlog.json', 'utf8'));
   *   await page.evaluate((log) => window.__SLOTPLATE_TEST!.replay(log), log);
   */
  async replay(spins: SpinResponse[]): Promise<void> {
    for (const response of spins) {
      this.opts.network.queueSpin({ kind: 'response', response });
    }
    while (this.opts.network.queuedSpinCount > 0) {
      // eslint-disable-next-line no-await-in-loop
      await this.spin();
    }
  }

  // ─── Convenience builders ─────────────────────────────────────────

  /**
   * Build a SpinResponse with sensible defaults — fill what you care
   * about, ignore the rest. Tests stay readable.
   */
  static buildSpin(partial: Partial<SpinResponse> & { columns?: number; rows?: number } = {}): SpinResponse {
    const columns = partial.columns ?? 5;
    const rows = partial.rows ?? 3;
    return {
      grid: partial.grid ?? Array.from({ length: columns }, () => Array.from({ length: rows }, () => 'cherry')),
      totalWin: partial.totalWin ?? 0,
      winlines: partial.winlines ?? [],
      ...(partial.teasingReels ? { teasingReels: partial.teasingReels } : {}),
      ...(partial.bonus ? { bonus: partial.bonus } : {}),
      balance: partial.balance ?? 100,
    };
  }
}
