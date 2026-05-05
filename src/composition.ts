// Composition root — the only file that knows how every subsystem is built.
// Change wiring here; every other file stays the same.
//
// Plugging in your server: pass a `network` to compose(), or set
// VITE_NETWORK + VITE_API_URL/VITE_WS_URL in .env.local and let the
// factory pick. See template/README.md → "Connect your server".
//
// Adding a phase: drop the file in src/flow/phases/, append it to
// src/flow/phases/index.ts, transition into it from another phase.
//
// Adding a service: append a token to src/container/tokens.ts, register
// the factory below, then `container.get(Tokens.Whatever)` anywhere.

import { GAME } from '@/config/gameConfig';
import { Container as DI, Tokens } from '@/container';
import { FSM } from '@/flow/fsm';
import { PHASES } from '@/flow/phases';
import { i18n, initI18n } from '@/i18n';
import { ConsoleAnalytics } from '@/infrastructure/Analytics';
import { AssetLoader } from '@/infrastructure/AssetLoader';
import { BUNDLES } from '@/infrastructure/loader/assetManifest';
import { createNetwork, type NetworkManager } from '@/infrastructure/network';
import { ScriptableMockNetwork } from '@/infrastructure/network/ScriptableMockNetwork';
import { GsapTicker, type Ticker } from '@/infrastructure/timing';
import { BackgroundPresenter } from '@/presenters/BackgroundPresenter';
import { ReelsPresenter } from '@/presenters/ReelsPresenter';
import { RootStore } from '@/state/RootStore';
import {
  InstantTicker,
  isTestModeEnabled,
  StubReelsEngine,
  shouldUseHeadlessStubs,
  TEST_BRIDGE_GLOBAL,
  TestBridge,
} from '@/testing';
import { InspectorChannel } from '@/testing/InspectorChannel';
import { mountInspector } from '@/testing/InspectorOverlay';
import { mountHUD } from '@/ui/mount';
import { mountLoader } from '@/ui/slots/loader';
import type { Disposable } from '@/utils/Disposable';
import { HUDLayer } from '@/view/hud';
import { MainScene } from '@/view/scenes/MainScene';
import { resizeObject } from '@/view/smart';

export interface App {
  container: DI;
  start(): Promise<void>;
  dispose(): void;
  /** Present only when test mode is on (`?test=1` or `VITE_TEST_BRIDGE=1`). */
  testBridge?: TestBridge;
}

export interface ComposeOptions {
  /** Pixi canvas host element. */
  host: HTMLElement;
  /** DOM element to mount the Preact HUD into. */
  hudHost: HTMLElement;
  /**
   * Optional NetworkManager override. When omitted, the factory in
   * `@/infrastructure/network/createNetwork` picks one based on
   * `VITE_NETWORK` (mock | http | ws). Pass a custom adapter here to
   * skip the factory entirely.
   */
  network?: NetworkManager;
  /** Optional Ticker override — see InstantTicker for the test-mode default. */
  ticker?: Ticker;
  /**
   * Force test mode on. Equivalent to setting `?test=1` in the URL or
   * `VITE_TEST_BRIDGE=1` at build. When true, swaps in
   * `ScriptableMockNetwork` + `InstantTicker` and exposes `TestBridge` on
   * `window.__SLOTPLATE_TEST` for Playwright to drive.
   */
  testMode?: boolean;
}

export async function compose({
  host,
  hudHost,
  network: networkOverride,
  ticker: tickerOverride,
  testMode,
}: ComposeOptions): Promise<App> {
  const testEnabled = testMode || isTestModeEnabled();
  // Bridge is on whenever testEnabled is true. Stubs are only swapped in
  // for automated drivers (Playwright sets navigator.webdriver) so a human
  // opening `?test=qa-inspector-demo` still sees real reels + GSAP.
  // Override with `&stubs=0` (force real) or `&stubs=1` (force stubs).
  const useStubs = shouldUseHeadlessStubs(testEnabled);
  await initI18n();
  const container = new DI();

  container.register(Tokens.Stores, () => {
    const root = new RootStore();
    root.balance.setBet(GAME.defaultBet);
    return root;
  });
  container.register(Tokens.Ticker, () => tickerOverride ?? (useStubs ? new InstantTicker() : new GsapTicker()));
  container.register(Tokens.Network, () => {
    if (networkOverride) return networkOverride;
    if (testEnabled) {
      return new ScriptableMockNetwork({
        symbolIds: GAME.symbolIds,
        columns: GAME.columns,
        rows: GAME.rows,
        startingBalance: GAME.startingBalance,
      });
    }
    return createNetwork();
  });
  container.register(Tokens.Analytics, () => new ConsoleAnalytics());
  container.register(Tokens.Assets, () => new AssetLoader(BUNDLES));
  container.register(Tokens.Scene, () => new MainScene());

  const stores = container.get(Tokens.Stores);
  const ticker = container.get(Tokens.Ticker);
  const network = container.get(Tokens.Network);
  const assets = container.get(Tokens.Assets);
  const scene = container.get(Tokens.Scene);

  const fsm = new FSM({
    stores,
    ticker,
    network,
    reels: null as unknown as ReelsPresenter,
  });

  // Sync detected i18n language into the store and keep them in lockstep.
  stores.ui.setLanguage(i18n.language || 'en');
  i18n.on('languageChanged', (lng) => stores.ui.setLanguage(lng));

  // Loader is rendered statically in index.html; this only wires it to the store.
  const loaderDisposable: Disposable = mountLoader(stores.ui);

  const hudDisposable: Disposable = mountHUD(hudHost, { stores, fsm });

  let hudLayer: HUDLayer | null = null;
  let inspectorDisposer: (() => void) | null = null;
  let inspectorChannel: InspectorChannel | null = null;

  for (const phase of PHASES) fsm.register(phase);

  // Test bridge — built only when test mode is enabled. The bridge is a
  // remote control over network/stores/fsm; production builds never expose it.
  let testBridge: TestBridge | undefined;
  if (testEnabled) {
    if (!(network instanceof ScriptableMockNetwork)) {
      throw new Error(
        '[composition] testMode requires a ScriptableMockNetwork. Either drop the `network` override or use ScriptableMockNetwork.',
      );
    }
    // App reference is patched in lazily after `MainScene.init()` completes
    // (see `start()` below) — the bridge methods that need it throw a
    // helpful error if accessed too early.
    testBridge = new TestBridge({ stores, fsm, network, usesStubs: useStubs });
    (globalThis as Record<string, unknown>)[TEST_BRIDGE_GLOBAL] = testBridge;
  }

  return {
    container,
    ...(testBridge ? { testBridge } : {}),
    async start() {
      try {
        // 1) Open Pixi — don't block the session call on this, but we need
        //    the canvas mounted before the reels engine is wired.
        await scene.init(host);
        resizeObject.remeasure();

        // 2) Session handshake (authoritative balance + config).
        stores.ui.setBootStage('session');
        stores.ui.setLoadProgress(0.1);
        const session = await network.session({});
        stores.ui.setSession(session.sessionId, session.currency);
        stores.balance.setBalance(session.balance);
        stores.balance.setBet(session.defaultBet);
        stores.ui.setLoadProgress(0.45);

        // 3) Assets — bundles + symbol textures.
        stores.ui.setBootStage('assets');
        await assets.loadAll((p) => stores.ui.setLoadProgress(0.45 + p * 0.3));
        await scene.loadAssets();
        stores.ui.setLoadProgress(1);

        // 4) Wire reels and run. Headless drivers (Playwright) get a
        //    StubReelsEngine so behavioral tests don't pay for ~3s of
        //    pixi-reels animation per spin — the FSM contract is what
        //    matters; visuals belong in screenshot tests. Humans opening
        //    a `?test=...` URL in a real browser see the full pipeline.
        const engine = useStubs ? new StubReelsEngine() : scene.createReelsEngine();
        const reels = new ReelsPresenter(engine);
        fsm.patchContext({ reels });

        // 5) Register the background presenter — late-bound because the
        //    BackgroundLayer is constructed inside MainScene.init().
        const bgLayer = scene.backgroundLayer;
        if (bgLayer) container.register(Tokens.Background, () => new BackgroundPresenter(bgLayer));

        // Late-bind the Pixi app on the bridge so clickPixi / pauseTicker work.
        testBridge?.attachApp(scene.app);

        // Mount the live inspector overlay so QA can poke the bridge with a
        // panel UI. Disabled by `?inspector=0` for tests that want a clean
        // canvas screenshot. Lives only when the bridge does — production
        // never builds this code path.
        //
        // The InspectorChannel runs unconditionally in test mode so a
        // popped-out inspector tab can connect even when the embedded UI
        // is suppressed (`?inspector=0`).
        if (testBridge) {
          inspectorChannel = new InspectorChannel(testBridge);
          const params = new URLSearchParams(window.location.search);
          const inspectorOff = params.get('inspector') === '0' || params.get('inspector') === 'off';
          if (!inspectorOff) inspectorDisposer = mountInspector(testBridge, inspectorChannel);
        }

        // 6) Mount the Pixi HUD on top of the reels.
        hudLayer = new HUDLayer({ stores, fsm });
        scene.app.stage.addChild(hudLayer);

        stores.ui.setBootStage('ready');
        await fsm.transition('idle');
      } catch (err) {
        stores.ui.setLoadError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    dispose() {
      inspectorDisposer?.();
      inspectorDisposer = null;
      inspectorChannel?.dispose();
      inspectorChannel = null;
      hudLayer?.dispose();
      hudLayer = null;
      loaderDisposable.dispose();
      hudDisposable.dispose();
      network.dispose?.();
      scene.dispose();
    },
  };
}
