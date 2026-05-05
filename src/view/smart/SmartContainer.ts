// SmartContainer — a Pixi Container that knows about viewport orientation
// and provides declarative fit/align/position rules per orientation.
//
// Design mirrors bonbon-hw's SmartContainer (from @gcp/renderer), but built
// in-tree so slotplate projects don't pull in private packages.
//
// Usage:
//
//   class ReelsFrame extends SmartContainer {
//     constructor() {
//       super({
//         portraitData:  { fitContain: true, valign: 'center', halign: 'center', safeWidth: 1080, safeHeight: 1920 },
//         landscapeData: { fitContain: true, valign: 'center', halign: 'center', safeWidth: 1920, safeHeight: 1080 },
//       });
//     }
//     override onResize() { /* per-layout tweaks */ }
//   }
//
// The container calls onResize() after every viewport change and positions
// itself in world coords. Content lives inside — addChild like any Container.

import { Container } from 'pixi.js';
import type { Disposable } from '@/utils/Disposable';
import { resizeObject } from './ResizeObserver';

export type HAlign = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'center' | 'bottom';

export interface SmartLayout {
  /** Reference design width for this orientation. */
  safeWidth: number;
  /** Reference design height for this orientation. */
  safeHeight: number;
  /** Scale to cover the viewport (may crop content). */
  fitCover?: boolean;
  /** Scale to contain the content inside the viewport (may letterbox). */
  fitContain?: boolean;
  /**
   * Stretch to viewport with no aspect-ratio preservation. Right for
   * full-bleed gradients/vignettes where distortion is harmless. Wrong
   * for art-with-shape — use BackgroundLayer for tiled art.
   */
  fitFill?: boolean;
  /** Horizontal alignment inside the viewport. */
  halign?: HAlign;
  /** Vertical alignment inside the viewport. */
  valign?: VAlign;
  /** Fixed offset applied after alignment. */
  offsetX?: number;
  offsetY?: number;
}

export interface SmartContainerOptions {
  portraitData: SmartLayout;
  landscapeData: SmartLayout;
}

export class SmartContainer extends Container implements Disposable {
  private unsubscribe: (() => void) | null = null;
  protected layout: SmartLayout;

  constructor(private readonly opts: SmartContainerOptions) {
    super();
    this.layout = resizeObject.isPortrait ? opts.portraitData : opts.landscapeData;
    this.unsubscribe = resizeObject.subscribe(() => this.applyResize());
    // Apply once on next frame so subclass constructors can finish first.
    queueMicrotask(() => this.applyResize());
  }

  /** Override in subclasses to adjust layout of children per orientation. */
  protected onResize(): void {
    /* default no-op */
  }

  /** Force a re-layout now. Useful after adding children. */
  public relayout(): void {
    this.applyResize();
  }

  private applyResize(): void {
    this.layout = resizeObject.isPortrait ? this.opts.portraitData : this.opts.landscapeData;
    const { width: vw, height: vh } = resizeObject;
    const { safeWidth, safeHeight, halign = 'center', valign = 'center', offsetX = 0, offsetY = 0 } = this.layout;

    let scaleX = 1;
    let scaleY = 1;
    if (this.layout.fitCover) {
      const s = Math.max(vw / safeWidth, vh / safeHeight);
      scaleX = scaleY = s;
    } else if (this.layout.fitContain) {
      const s = Math.min(vw / safeWidth, vh / safeHeight);
      scaleX = scaleY = s;
    } else if (this.layout.fitFill) {
      scaleX = vw / safeWidth;
      scaleY = vh / safeHeight;
    }
    this.scale.set(scaleX, scaleY);

    const scaledW = safeWidth * scaleX;
    const scaledH = safeHeight * scaleY;

    let x = 0;
    if (halign === 'center') x = (vw - scaledW) / 2;
    else if (halign === 'right') x = vw - scaledW;

    let y = 0;
    if (valign === 'center') y = (vh - scaledH) / 2;
    else if (valign === 'bottom') y = vh - scaledH;

    this.position.set(x + offsetX, y + offsetY);
    this.onResize();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.destroy({ children: true });
  }
}
