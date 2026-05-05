// ReelsFrame — the container that holds your ReelSet. Positioned responsively
// via SmartContainer. Swap in your real ReelSet as a child; the frame
// handles the "where does it go on the screen" problem.
//
// Typical use from MainScene:
//
//   this.reelsFrame = new ReelsFrame({ columns: 5, rows: 3, cellSize: 140 });
//   this.reelsFrame.setContent(myReelSetContainer);
//   this.app.stage.addChild(this.reelsFrame);

import type { Container } from 'pixi.js';
import { SmartContainer, type SmartContainerOptions } from './SmartContainer';

export interface ReelsFrameConfig {
  columns: number;
  rows: number;
  /** Cell size in design pixels. Used to compute the reelset bounding box. */
  cellSize: number;
  /** Optional HUD safe areas (design pixels) to subtract from the reel area. */
  hudTop?: number;
  hudBottom?: number;
  hudLeft?: number;
  hudRight?: number;
}

const DEFAULT_DESIGN = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
};

export class ReelsFrame extends SmartContainer {
  private content: Container | null = null;

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
      },
      portraitData: {
        safeWidth: DEFAULT_DESIGN.portrait.width,
        safeHeight: DEFAULT_DESIGN.portrait.height,
        fitContain: true,
        halign: 'center',
        valign: 'center',
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

  protected override onResize(): void {
    if (!this.content) return;
    const { columns, rows, cellSize } = this.cfg;
    const reelW = columns * cellSize;
    const reelH = rows * cellSize;
    const safeW = this.layout.safeWidth;
    const safeH = this.layout.safeHeight;

    // Reserve space for HUD top/bottom bars. Center the reels in the remaining box.
    const hudTop = this.cfg.hudTop ?? 140;
    const hudBottom = this.cfg.hudBottom ?? 220;
    const availH = safeH - hudTop - hudBottom;
    const availW = safeW - (this.cfg.hudLeft ?? 0) - (this.cfg.hudRight ?? 0);

    // Pick the scale that fits the reel area in the available box, never > 1.
    const scale = Math.min(availW / reelW, availH / reelH, 1);
    this.content.scale.set(scale);

    const scaledW = reelW * scale;
    const scaledH = reelH * scale;
    this.content.position.set((this.cfg.hudLeft ?? 0) + (availW - scaledW) / 2, hudTop + (availH - scaledH) / 2);
  }
}
