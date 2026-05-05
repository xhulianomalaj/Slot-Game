// Playwright fixture — `slot` is the remote control over the in-page TestBridge.
//
// Every test gets a freshly-booted page in `?test=1` mode. The fixture owns:
//
//   - boot waiting (load the page, wait for the bridge to appear and the
//     app to reach `bootStage === 'ready'`)
//   - typed wrappers around `page.evaluate` so specs look like
//     `await slot.queueWin(...)` instead of `page.evaluate(t => t.queueWin(...))`
//   - waits and assertions that read the bridge's state snapshot
//
// The bridge exists in the page; the fixture exists in the test runner.
// They communicate over `page.evaluate`, which serializes args/returns
// across the boundary, so anything the fixture passes must be JSON-safe.

import { test as base, expect, type Page } from '@playwright/test';
import type { SpinResponse, Winline } from '@/domain/types';
import type {
  AudioEvent,
  BridgeFullDump,
  BridgeStateSnapshot,
  FsmTransition,
  PixiBounds,
  RecordedAction,
} from '@/testing/TestBridge';

declare global {
  interface Window {
    __SLOTPLATE_TEST?: {
      readonly testId: string | null;
      state(): BridgeStateSnapshot;
      networkHistory(): Array<Record<string, unknown>>;
      grid(): string[][];
      setSession(s: unknown): void;
      queueSpin(s: unknown): void;
      queueWin(grid: string[][], totalWin: number, winlines?: Winline[]): void;
      queueLoss(grid: string[][]): void;
      queueError(error: string, delayMs?: number): void;
      simulateOffline(): void;
      simulateOnline(): void;
      resetNetwork(startingBalance?: number): void;
      spin(): Promise<void>;
      startSpin(): void;
      skipPhase(): void;
      setBet(bet: number): void;
      startAutospin(rounds: number): void;
      stopAutospin(): void;
      waitForPhase(name: string, timeoutMs?: number): Promise<void>;
      waitForBalance(target: number, timeoutMs?: number): Promise<void>;
      waitForSpinning(spinning: boolean, timeoutMs?: number): Promise<void>;
      waitForBootReady(timeoutMs?: number): Promise<void>;
      tapToStart(): void;
      recoverFromError(): Promise<void>;
      pixiLabels(): string[];
      pixiBounds(label: string): PixiBounds | null;
      clickPixi(label: string): void;
      pauseTicker(): void;
      resumeTicker(): void;
      tickFrames(n: number): void;
      a11yTree(): PixiBounds[];
      fsmTransitions(): FsmTransition[];
      dumpAll(): BridgeFullDump;
      replay(spins: SpinResponse[]): Promise<void>;
      toggleSound(): void;
      setLanguage(lang: string): void;
      openMenu(tab?: 'paytable' | 'info' | 'settings'): void;
      closeMenu(): void;
      simulateLowBalance(value?: number): void;
      startRecording(): void;
      stopRecording(): void;
      isRecording(): boolean;
      getRecording(): RecordedAction[];
      formatAsSpec(testTitle?: string): string;
      recordAudio(name: string, meta?: Record<string, unknown>): void;
      audioLog(): AudioEvent[];
      clearAudioLog(): void;
      snapshotCanvas(): string | null;
    };
  }
}

export interface ScriptedSpinShape {
  kind: 'response' | 'error';
  response?: Partial<SpinResponse>;
  error?: { message: string };
  delayMs?: number;
}

export class SlotDriver {
  constructor(public readonly page: Page) {}

  /**
   * The canonical boot sequence — every scenario test starts here. The
   * stages match the production boot, just driven deterministically:
   *
   *   1. Navigate to `/?test=<id>`. The bridge reads the id and exposes
   *      it as `slot.testId` so log lines, dev overlays and CI artifacts
   *      can correlate failures to the scenario name.
   *   2. Wait for the bridge to mount on `window`.
   *   3. Wait for asset loading + session handshake (`bootStage === 'ready'`).
   *      In test mode this resolves instantly because the network is the
   *      ScriptableMockNetwork with `defaultDelayMs: 0`.
   *   4. (Optional) verify the splash / intro screen is visible — tests
   *      can assert features and CTA copy here. Pass `keepSplash: true`
   *      to keep it open; otherwise the bridge calls `tapToStart()`.
   *   5. The FSM is now in `idle`. The test can queue spins and drive.
   *
   * The fixture identifies the test name from the spec — pass `testId`
   * explicitly when your spec name doesn't make a good URL token.
   */
  async boot(
    opts: {
      startingBalance?: number;
      bet?: number;
      /** Custom test id; falls back to the spec's title-derived slug. */
      testId?: string;
      keepSplash?: boolean;
    } = {},
  ): Promise<void> {
    const id = opts.testId ?? slugifyTitle(test.info().title);
    await this.page.goto(`/?test=${encodeURIComponent(id)}`);
    await this.page.waitForFunction(() => Boolean(window.__SLOTPLATE_TEST), null, { timeout: 15_000 });
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.waitForBootReady());
    if (!opts.keepSplash) {
      await this.page.evaluate(() => window.__SLOTPLATE_TEST!.tapToStart());
    }
    if (opts.startingBalance !== undefined) {
      await this.page.evaluate((b) => window.__SLOTPLATE_TEST!.resetNetwork(b), opts.startingBalance);
    }
    if (opts.bet !== undefined) {
      await this.setBet(opts.bet);
    }
  }

  /** Returns the test id resolved by `boot()` — useful for log lines. */
  async testId(): Promise<string | null> {
    return this.page.evaluate(() => window.__SLOTPLATE_TEST!.testId);
  }

  // ─── Programming the next server response ────────────────────────

  async queueWin(grid: string[][], totalWin: number, winlines?: Winline[]): Promise<void> {
    // Important: pass `undefined` (not `[]`) when caller didn't provide lines,
    // so the mock's synth-default kicks in and the WinShowPhase actually
    // credits the wallet. WinShowPhase ignores `totalWin` if `winlines` is
    // empty.
    await this.page.evaluate(({ g, w, lines }) => window.__SLOTPLATE_TEST!.queueWin(g, w, lines), {
      g: grid,
      w: totalWin,
      lines: winlines as Winline[] | undefined,
    });
  }

  async queueLoss(grid: string[][]): Promise<void> {
    await this.page.evaluate((g) => window.__SLOTPLATE_TEST!.queueLoss(g), grid);
  }

  async queueError(message: string, delayMs?: number): Promise<void> {
    await this.page.evaluate(({ m, d }) => window.__SLOTPLATE_TEST!.queueError(m, d), { m: message, d: delayMs });
  }

  /** Drop a fully-formed scripted spin onto the queue (advanced). */
  async queueSpin(spec: ScriptedSpinShape): Promise<void> {
    await this.page.evaluate((s) => {
      const reified =
        s.kind === 'error'
          ? { kind: 'error', error: new Error(s.error?.message ?? 'scripted error'), delayMs: s.delayMs }
          : { kind: 'response', response: s.response ?? {}, delayMs: s.delayMs };
      window.__SLOTPLATE_TEST!.queueSpin(reified);
    }, spec);
  }

  // ─── Connection state ─────────────────────────────────────────────

  async simulateOffline(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.simulateOffline());
  }
  async simulateOnline(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.simulateOnline());
  }

  // ─── Actions ─────────────────────────────────────────────────────

  /**
   * "Click" the spin button. This template renders the HUD inside Pixi
   * (canvas) — there's no DOM spin button to locate. The bridge emits
   * `pointertap` directly on the labeled Pixi container, which is what
   * the production handler is wired to anyway.
   */
  async clickSpin(): Promise<void> {
    await this.clickPixi('spin');
  }

  /** Click any labeled Pixi node (HUD button, labeled overlay, etc.). */
  async clickPixi(label: string): Promise<void> {
    await this.page.evaluate((l) => window.__SLOTPLATE_TEST!.clickPixi(l), label);
  }

  /** Get bounds of a labeled Pixi node in canvas coordinates. */
  async pixiBounds(label: string): Promise<ReturnType<NonNullable<Window['__SLOTPLATE_TEST']>['pixiBounds']>> {
    return this.page.evaluate((l) => window.__SLOTPLATE_TEST!.pixiBounds(l), label);
  }

  /** List every labeled Pixi node — useful for debugging "what can I click?". */
  async pixiLabels(): Promise<string[]> {
    return this.page.evaluate(() => window.__SLOTPLATE_TEST!.pixiLabels());
  }

  /** Full canvas a11y tree: every labeled node + bounds + visibility. */
  async a11yTree(): Promise<PixiBounds[]> {
    return this.page.evaluate(() => window.__SLOTPLATE_TEST!.a11yTree());
  }

  /** FSM transition log since boot. */
  async fsmTransitions(): Promise<FsmTransition[]> {
    return this.page.evaluate(() => window.__SLOTPLATE_TEST!.fsmTransitions());
  }

  /** Single JSON blob with state, history, transitions, a11y tree, grid. */
  async dumpAll(): Promise<BridgeFullDump> {
    return this.page.evaluate(() => window.__SLOTPLATE_TEST!.dumpAll());
  }

  /** Feed a sequence of `SpinResponse` payloads (e.g. from a server log). */
  async replay(spins: SpinResponse[]): Promise<void> {
    await this.page.evaluate((s) => window.__SLOTPLATE_TEST!.replay(s), spins);
  }

  // ─── Higher-level actions ────────────────────────────────────────

  async toggleSound(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.toggleSound());
  }

  async setLanguage(lang: string): Promise<void> {
    await this.page.evaluate((l) => window.__SLOTPLATE_TEST!.setLanguage(l), lang);
  }

  async openMenu(tab?: 'paytable' | 'info' | 'settings'): Promise<void> {
    await this.page.evaluate((t) => window.__SLOTPLATE_TEST!.openMenu(t), tab);
  }

  async closeMenu(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.closeMenu());
  }

  async simulateLowBalance(value = 0): Promise<void> {
    await this.page.evaluate((v) => window.__SLOTPLATE_TEST!.simulateLowBalance(v), value);
  }

  // ─── Recorder ────────────────────────────────────────────────────

  async startRecording(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.startRecording());
  }

  async stopRecording(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.stopRecording());
  }

  async getRecording(): Promise<RecordedAction[]> {
    return this.page.evaluate(() => window.__SLOTPLATE_TEST!.getRecording());
  }

  async formatAsSpec(title?: string): Promise<string> {
    return this.page.evaluate((t) => window.__SLOTPLATE_TEST!.formatAsSpec(t), title);
  }

  // ─── Audio ───────────────────────────────────────────────────────

  async audioLog(): Promise<AudioEvent[]> {
    return this.page.evaluate(() => window.__SLOTPLATE_TEST!.audioLog());
  }

  async clearAudioLog(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.clearAudioLog());
  }

  /** Mostly used by the audio engine; tests can fire synthetic cues too. */
  async recordAudio(name: string, meta?: Record<string, unknown>): Promise<void> {
    await this.page.evaluate(({ n, m }) => window.__SLOTPLATE_TEST!.recordAudio(n, m), { n: name, m: meta });
  }

  // ─── Visual snapshot ─────────────────────────────────────────────

  async snapshotCanvas(): Promise<string | null> {
    return this.page.evaluate(() => window.__SLOTPLATE_TEST!.snapshotCanvas());
  }

  /** Pause Pixi + GSAP. Call before screenshots so animations can't tear. */
  async pauseTicker(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.pauseTicker());
  }
  async resumeTicker(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.resumeTicker());
  }
  async tickFrames(n: number): Promise<void> {
    await this.page.evaluate((count) => window.__SLOTPLATE_TEST!.tickFrames(count), n);
  }

  /** Drive a spin through the bridge (FSM transition). Resolves at idle. */
  async spin(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.spin());
  }

  /** Kick off a spin without awaiting — for tests that want the in-flight state. */
  async startSpin(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.startSpin());
  }

  async skipPhase(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.skipPhase());
  }

  /** Reset the FSM after a network error left it stuck in `spin`. */
  async recoverFromError(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.recoverFromError());
  }

  async setBet(bet: number): Promise<void> {
    await this.page.evaluate((b) => window.__SLOTPLATE_TEST!.setBet(b), bet);
  }

  async startAutospin(rounds: number): Promise<void> {
    await this.page.evaluate((r) => window.__SLOTPLATE_TEST!.startAutospin(r), rounds);
  }
  async stopAutospin(): Promise<void> {
    await this.page.evaluate(() => window.__SLOTPLATE_TEST!.stopAutospin());
  }

  /** Press a key with the page focused. Hotkeys (Space, etc.) ride this. */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  // ─── Waits ───────────────────────────────────────────────────────

  async waitForPhase(name: string, timeoutMs?: number): Promise<void> {
    await this.page.evaluate(({ n, t }) => window.__SLOTPLATE_TEST!.waitForPhase(n, t), { n: name, t: timeoutMs });
  }

  async waitForBalance(target: number, timeoutMs?: number): Promise<void> {
    await this.page.evaluate(({ b, t }) => window.__SLOTPLATE_TEST!.waitForBalance(b, t), { b: target, t: timeoutMs });
  }

  async waitForSpinning(spinning: boolean, timeoutMs?: number): Promise<void> {
    await this.page.evaluate(({ s, t }) => window.__SLOTPLATE_TEST!.waitForSpinning(s, t), {
      s: spinning,
      t: timeoutMs,
    });
  }

  // ─── Reads ───────────────────────────────────────────────────────

  state(): Promise<BridgeStateSnapshot> {
    return this.page.evaluate(() => window.__SLOTPLATE_TEST!.state());
  }

  grid(): Promise<string[][]> {
    return this.page.evaluate(() => window.__SLOTPLATE_TEST!.grid());
  }

  history(): Promise<Array<Record<string, unknown>>> {
    return this.page.evaluate(() => window.__SLOTPLATE_TEST!.networkHistory());
  }

  // ─── Assertions ──────────────────────────────────────────────────

  async expectPhase(name: string): Promise<void> {
    const snapshot = await this.state();
    expect(snapshot.phase, `expected phase "${name}", got "${snapshot.phase}"`).toBe(name);
  }

  async expectBalance(target: number): Promise<void> {
    const snapshot = await this.state();
    expect(snapshot.balance, 'balance').toBe(target);
  }

  async expectLastWin(target: number): Promise<void> {
    const snapshot = await this.state();
    expect(snapshot.lastWin, 'lastWin').toBe(target);
  }

  async expectGrid(grid: string[][]): Promise<void> {
    const actual = await this.grid();
    expect(actual).toEqual(grid);
  }

  /** Assert the HUD's spin button is in the expected enabled state. */
  async expectSpinButtonEnabled(enabled: boolean): Promise<void> {
    const btn = this.page.locator('[data-testid="spin"]');
    if (enabled) {
      await expect(btn).toBeEnabled();
    } else {
      await expect(btn).toBeDisabled();
    }
  }

  /**
   * Assert that the most recently completed round was faster than `ms`.
   * Catches accidental real-time animations after refactors — instant-mode
   * tests should clock in well under 100ms per round.
   */
  async expectLastRoundFasterThan(ms: number): Promise<void> {
    const snap = await this.state();
    expect(snap.lastRoundMs, 'lastRoundMs (round wall-clock)').not.toBeNull();
    expect(snap.lastRoundMs!).toBeLessThan(ms);
  }
}

// ─── Locale matrix helper ───────────────────────────────────────────

/**
 * Run the same scenario in every supported language. Catches text overflow,
 * plural rules, RTL clipping, and missing translation keys. Use it inside
 * `test.describe` like a normal `test(...)` call:
 *
 *   forEachLocale(['en', 'de', 'es', 'fr', 'pt', 'ru'], (lang) => {
 *     test(`spin works in ${lang}`, async ({ slot }) => {
 *       await slot.boot({ testId: `spin-${lang}` });
 *       await slot.setLanguage(lang);
 *       // ... assertions specific to that locale
 *     });
 *   });
 */
export function forEachLocale(locales: readonly string[], body: (lang: string) => void): void {
  for (const lang of locales) body(lang);
}

export interface SlotFixtures {
  slot: SlotDriver;
}

export const test = base.extend<SlotFixtures>({
  slot: async ({ page }, use, testInfo) => {
    // Surface every runtime error to the test report — without this,
    // a TypeError in a Pixi handler is swallowed by the canvas and the
    // test fails with a vague timeout. Now you see the original.
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const consoleAll: string[] = [];
    page.on('console', (msg) => {
      const line = `[${msg.type()}] ${msg.text()}`;
      consoleAll.push(line);
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        testInfo.annotations.push({ type: 'console-error', description: msg.text() });
      }
    });
    page.on('pageerror', (err) => {
      const line = `${err.name}: ${err.message}\n${err.stack ?? ''}`;
      pageErrors.push(line);
      testInfo.annotations.push({ type: 'page-error', description: line });
    });

    const driver = new SlotDriver(page);
    await use(driver);

    // Always-attached on failure: a single JSON file with state, history,
    // FSM transitions, a11y tree, and the console buffer. A QA engineer
    // pastes this into a bug report and a developer can replay it.
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        const dump = await driver.dumpAll();
        await testInfo.attach('bridge-dump.json', {
          body: JSON.stringify({ ...dump, consoleAll }, null, 2),
          contentType: 'application/json',
        });
      } catch {
        /* best-effort — the page may have already navigated away */
      }
    }

    // Fail the test if anything blew up while it ran. Stack trace + message
    // is preserved in the annotation, so a triage engineer sees the
    // original error instead of a downstream timeout.
    if (pageErrors.length > 0) {
      throw new Error(`page errors during test:\n\n${pageErrors.join('\n\n')}`);
    }
    if (consoleErrors.length > 0) {
      throw new Error(`console errors during test:\n\n${consoleErrors.join('\n\n')}`);
    }
  },
});

export { expect } from '@playwright/test';

/**
 * Convert a Playwright test title into a URL-safe id used as `?test=<id>`.
 * `"three spins compose: 100 → 99 → 99 + 5 → 103 + 0 = 103 with $1 bet"`
 * becomes `"three-spins-compose-100-99-99-5-103-0-103-with-1-bet"`.
 */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
