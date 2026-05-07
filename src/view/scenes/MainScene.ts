// MainScene — mounts the Pixi app, constructs the reels engine, owns lifecycle.
//
// Uses pixi-reels as documented: build a ReelSet via ReelSetBuilder, add it
// as a child of the adaptive ReelsFrame, and hand an adapter to the app's
// ReelsPresenter. Loads real symbol art from public/assets/symbols/*.png;
// falls back to programmatic placeholders if any texture is missing.

import { Application, Assets, Graphics, type Texture } from "pixi.js";
import { ReelSetBuilder, SpeedPresets } from "pixi-reels";
import { GAME } from "@/config/gameConfig";
import { THEME } from "@/config/theme";
import { syncGsapToPixi } from "@/infrastructure/timing";
import type { ReelsEngine } from "@/presenters/ReelsPresenter";
import type { Disposable } from "@/utils/Disposable";
import { BackgroundLayer } from "@/view/scenes/BackgroundLayer";
import { ReelsFrame, resizeObject } from "@/view/smart";
import { FixedSpriteSymbol } from "@/view/symbols/FixedSpriteSymbol";
import { createPlaceholderTextures } from "./placeholderTextures";
import { adaptReelSet } from "./reelsEngineAdapter";
import { loadSymbolTextures } from "./symbolTextures";

const CELL_SIZE = 140;
const SYMBOL_GAP = 8; // must match .symbolGap() below
const PANEL_PADDING = 50; // must match panelPadding in ReelsFrame config

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
      const w = globalThis as unknown as {
        __SLOTPLATE?: { app: Application; bg: BackgroundLayer };
      };
      w.__SLOTPLATE = { app: this.app, bg: this.background };
    }

    this.reelsFrame = new ReelsFrame({
      columns: GAME.columns,
      rows: GAME.rows,
      cellSize: CELL_SIZE,
      gapX: 8,
      gapY: 8,
      panelPadding: PANEL_PADDING,
      hudTop: 200,
      hudBottom: 280,
      // Mobile landscape (phones < 500px tall): push reels down past the header
      // and give the bet board more room so nothing overlaps.
      hudTopLandscape: 310,
      hudBottomLandscape: 240,
      offsetY: -40,
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
      console.warn(
        "[MainScene] symbol textures failed to load, falling back to placeholders:",
        err,
      );
      this.textures = null;
    }
    try {
      await bgPromise;
    } catch (err) {
      console.warn(
        "[MainScene] background texture failed to load, falling back to clearColor:",
        err,
      );
    }
    try {
      this.reelPanelTexture = await Assets.load<Texture>("reel-frame.png");
    } catch (err) {
      console.warn(
        "[MainScene] reel-frame texture failed to load, panel will be skipped:",
        err,
      );
    }
  }

  createReelsEngine(): ReelsEngine {
    const textures =
      this.textures ??
      createPlaceholderTextures(this.app, GAME.symbolIds, CELL_SIZE);

    // pixi-reels canonical wiring — fluent builder from the README.
    const reelSet = new ReelSetBuilder()
      .reels(GAME.columns)
      .visibleSymbols(GAME.rows)
      .symbolSize(CELL_SIZE, CELL_SIZE)
      .symbolGap(SYMBOL_GAP, SYMBOL_GAP)
      .symbols((registry) => {
        for (const id of GAME.symbolIds) {
          registry.register(id, FixedSpriteSymbol, {
            textures,
            anchor: { x: 0, y: 0 },
          });
        }
      })
      .speed("normal", SpeedPresets.NORMAL)
      .speed("turbo", SpeedPresets.TURBO)
      .speed("superTurbo", SpeedPresets.SUPER_TURBO)
      .ticker(this.app.ticker)
      .build();

    // Expand the engine's scroll mask and dim overlay to cover the full panel
    // background area (panelPadding on every side beyond the symbol grid).
    // Both are accessed via pixi-reels public API — no private hacks needed.
    const rw = GAME.columns * CELL_SIZE + (GAME.columns - 1) * SYMBOL_GAP;
    const rh = GAME.rows * CELL_SIZE + (GAME.rows - 1) * SYMBOL_GAP;
    const vp = reelSet.viewport;
    // maskedContainer.mask is the scroll-clip Graphics (public via maskedContainer).
    const scrollMask = vp.maskedContainer.mask as unknown as Graphics;
    scrollMask.clear();
    // Expand only horizontally so the left/right panel edges are covered.
    // Do NOT expand vertically — buffer symbols sit just outside the top/bottom
    // and would become visible if we grew the mask upward or downward.
    scrollMask
      .rect(-PANEL_PADDING, -22, rw + PANEL_PADDING * 2, rh + 30)
      .fill({ color: 0xffffff });
    // dimOverlay can expand in all directions (it's just a colour overlay, not a clip).
    vp.dimOverlay.clear();
    vp.dimOverlay
      .rect(
        -PANEL_PADDING,
        -PANEL_PADDING,
        rw + PANEL_PADDING * 2,
        rh + PANEL_PADDING * 2,
      )
      .fill({ color: 0x000000, alpha: 0.5 });

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
