// ReelsFrame — the container that holds your ReelSet. Positioned responsively
// via SmartContainer. Swap in your real ReelSet as a child; the frame
// handles the "where does it go on the screen" problem.
//
// Typical use from MainScene:
//
//   this.reelsFrame = new ReelsFrame({ columns: 5, rows: 3, cellSize: 140 });
//   this.reelsFrame.setPanel(panelSprite);   // decorative frame behind symbols
//   this.reelsFrame.setContent(myReelSetContainer);
//   this.app.stage.addChild(this.reelsFrame);

import { Sprite, type Container, type Texture } from 'pixi.js';
import { SmartContainer, type SmartContainerOptions } from './SmartContainer';
import { resizeObject } from './ResizeObserver';

export interface ReelsFrameConfig {
  columns: number;
  rows: number;
  /** Cell size in design pixels. Used to compute the reelset bounding box. */
  cellSize: number;
  /** Gap between symbols in design pixels (must match ReelSetBuilder.symbolGap). */
  gapX?: number;
  gapY?: number;
  /** Extra padding added to each side of the panel sprite (design pixels). */
  panelPadding?: number;
  /** Optional HUD safe areas (design pixels) to subtract from the reel area. */
  hudTop?: number;
  hudBottom?: number;
  hudLeft?: number;
  hudRight?: number;
  /**
   * Override hudTop/hudBottom used on mobile landscape (viewport height < 500px).
   * Lets you push the reels down / shrink them on short phone viewports without
   * affecting portrait or desktop landscape.
   */
  hudTopLandscape?: number;
  hudBottomLandscape?: number;
  /** Vertical offset in design pixels (negative = up, positive = down). */
  offsetY?: number;
}

const DEFAULT_DESIGN = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
};

export class ReelsFrame extends SmartContainer {
  private content: Container | null = null;
  private panel: Sprite | null = null;

  constructor(private readonly cfg: ReelsFrameConfig) {
    const hudTop = cfg.hudTop ?? 140;
    const hudBottom = cfg.hudBottom ?? 220;
    const options: SmartContainerOptions = {
      landscapeData: {
        safeWidth: DEFAULT_DESIGN.landscape.width,
        safeHeight: DEFAULT_DESIGN.landscape.height,
        fitContain: true,
        halign: 'center',
        valign: 'center',
        offsetY: cfg.offsetY ?? 0,
      },
      portraitData: {
        safeWidth: DEFAULT_DESIGN.portrait.width,
        safeHeight: DEFAULT_DESIGN.portrait.height,
        fitContain: true,
        halign: 'center',
        valign: 'center',
        offsetY: cfg.offsetY ?? 0,
      },
    };
    super(options);
    this.label = 'reels-frame'; // pixi-test-label
    // Internal marker for subclasses that want to read HUD inset.
    void hudTop;
    void hudBottom;
  }

  setContent(container: Container): void {
    if (this.content) this.removeChild(this.content);
    this.content = container;
    this.addChild(container);
    this.relayout();
  }

  /** Place a decorative panel sprite behind the symbols. Call before setContent. */
  setPanel(texture: Texture): void {
    if (this.panel) {
      this.removeChild(this.panel);
      this.panel.destroy();
    }
    this.panel = new Sprite(texture);
    this.addChildAt(this.panel, 0); // always behind the ReelSet
    this.relayout();
  }

  protected override onResize(): void {
    const { columns, rows, cellSize } = this.cfg;
    const gapX = this.cfg.gapX ?? 0;
    const gapY = this.cfg.gapY ?? 0;
    const pad  = this.cfg.panelPadding ?? 0;

    // Include inter-symbol gaps in the bounding box so panel and content align.
    const reelW = columns * cellSize + (columns - 1) * gapX;
    const reelH = rows    * cellSize + (rows    - 1) * gapY;
    const safeW = this.layout.safeWidth;
    const safeH = this.layout.safeHeight;

    // Use mobile-landscape overrides when viewport is short (phones on their side).
    const isMobileLandscape = !resizeObject.isPortrait && resizeObject.height < 500;
    const hudTop    = (isMobileLandscape ? (this.cfg.hudTopLandscape    ?? this.cfg.hudTop)    : this.cfg.hudTop)    ?? 140;
    const hudBottom = (isMobileLandscape ? (this.cfg.hudBottomLandscape ?? this.cfg.hudBottom) : this.cfg.hudBottom) ?? 220;
    const availH = safeH - hudTop - hudBottom;
    const availW = safeW - (this.cfg.hudLeft ?? 0) - (this.cfg.hudRight ?? 0);

    // Pick the scale that fills the available box while preserving aspect ratio.
    const scale = Math.min(availW / reelW, availH / reelH);

    const scaledW = reelW * scale;
    const scaledH = reelH * scale;
    const x = Math.round((this.cfg.hudLeft ?? 0) + (availW - scaledW) / 2);
    const y = Math.round(hudTop + (availH - scaledH) / 2);

    if (this.content) {
      this.content.scale.set(scale);
      this.content.position.set(x, y);
    }

    if (this.panel) {
      // Expand the panel by panelPadding on every side so the frame border
      // has breathing room beyond the symbol area.
      const scaledPad = pad * scale;
      this.panel.width  = scaledW + scaledPad * 2;
      this.panel.height = scaledH + scaledPad * 2;
      this.panel.position.set(x - scaledPad, y - scaledPad);
    }
  }
}
