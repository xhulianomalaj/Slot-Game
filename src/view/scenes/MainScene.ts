// MainScene — mounts the Pixi app, constructs the reels engine, owns lifecycle.
//
// Uses pixi-reels as documented: build a ReelSet via ReelSetBuilder, add it
// as a child of the adaptive ReelsFrame, and hand an adapter to the app's
// ReelsPresenter. Loads real symbol art from public/assets/symbols/*.png;
// falls back to programmatic placeholders if any texture is missing.

import { Application, Assets, type Texture } from 'pixi.js';
import { ReelSetBuilder, SpeedPresets } from 'pixi-reels';
import { GAME } from '@/config/gameConfig';
import { THEME } from '@/config/theme';
import { syncGsapToPixi } from '@/infrastructure/timing';
import type { ReelsEngine } from '@/presenters/ReelsPresenter';
import type { Disposable } from '@/utils/Disposable';
import { BackgroundLayer } from '@/view/scenes/BackgroundLayer';
import { ReelsFrame, resizeObject } from '@/view/smart';
import { FixedSpriteSymbol } from '@/view/symbols/FixedSpriteSymbol';
import { createPlaceholderTextures } from './placeholderTextures';
import { adaptReelSet } from './reelsEngineAdapter';
import { loadSymbolTextures } from './symbolTextures';

const CELL_SIZE = 140;

export class MainScene implements Disposable {
  readonly app: Application;
  private reelsFrame: ReelsFrame | null = null;
  private background: BackgroundLayer | null = null;
  private engineDisposable: Disposable | null = null;
  private textures: Record<string, Texture> | null = null;
  private reelPanelTexture: Texture | null = null;

  constructor() {
    this.app = new Application();
  }

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: THEME.clearColor,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    // Expose app to the PixiJS DevTools browser extension.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__PIXI_APP__ = this.app;
    host.appendChild(this.app.canvas);
    syncGsapToPixi(this.app.ticker);

    // Background goes in first so everything else stacks above it.
    this.background = new BackgroundLayer();
    this.app.stage.addChild(this.background);

    // Dev-only handles so the background can be tweaked from the browser console.
    // Stripped from production by the `import.meta.env.DEV` guard.
    if (import.meta.env.DEV) {
      const w = globalThis as unknown as { __SLOTPLATE?: { app: Application; bg: BackgroundLayer } };
      w.__SLOTPLATE = { app: this.app, bg: this.background };
    }

    this.reelsFrame = new ReelsFrame({
      columns: GAME.columns,
      rows: GAME.rows,
      cellSize: CELL_SIZE,
      hudTop: 160,
      hudBottom: 240,
    });
    this.app.stage.addChild(this.reelsFrame);
  }

  /** Exposed so a presenter / debug command can hot-swap the theme. */
  get backgroundLayer(): BackgroundLayer | null {
    return this.background;
  }

  /** Load real art. Call before createReelsEngine. */
  async loadAssets(): Promise<void> {
    // Background runs in parallel with symbol loading — neither blocks the other.
    const bgPromise = this.background?.load() ?? Promise.resolve();
    try {
      this.textures = await loadSymbolTextures(GAME.symbolIds);
    } catch (err) {
      console.warn('[MainScene] symbol textures failed to load, falling back to placeholders:', err);
      this.textures = null;
    }
    try {
      await bgPromise;
    } catch (err) {
      console.warn('[MainScene] background texture failed to load, falling back to clearColor:', err);
    }
    try {
      this.reelPanelTexture = await Assets.load<Texture>('reel-frame.png');
    } catch (err) {
      console.warn('[MainScene] reel-frame texture failed to load, panel will be skipped:', err);
    }
  }

  createReelsEngine(): ReelsEngine {
    const textures = this.textures ?? createPlaceholderTextures(this.app, GAME.symbolIds, CELL_SIZE);

    // pixi-reels canonical wiring — fluent builder from the README.
    const reelSet = new ReelSetBuilder()
      .reels(GAME.columns)
      .visibleSymbols(GAME.rows)
      .symbolSize(CELL_SIZE, CELL_SIZE)
      .symbolGap(8, 8)
      .symbols((registry) => {
        for (const id of GAME.symbolIds) {
          registry.register(id, FixedSpriteSymbol, { textures, anchor: { x: 0, y: 0 } });
        }
      })
      .speed('normal', SpeedPresets.NORMAL)
      .speed('turbo', SpeedPresets.TURBO)
      .speed('superTurbo', SpeedPresets.SUPER_TURBO)
      .ticker(this.app.ticker)
      .build();

    this.reelsFrame?.setContent(reelSet);
    if (this.reelPanelTexture) this.reelsFrame?.setPanel(this.reelPanelTexture);
    resizeObject.remeasure();

    const adapter = adaptReelSet(reelSet);
    this.engineDisposable = adapter;
    return adapter;
  }

  dispose(): void {
    this.engineDisposable?.dispose();
    this.engineDisposable = null;
    this.reelsFrame?.dispose();
    this.reelsFrame = null;
    this.background?.dispose();
    this.background = null;
    this.app.destroy(true, { children: true });
  }
}
