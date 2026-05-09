// FixedSpriteSymbol — patches a scale-reset bug in pixi-reels v0.1.0 and
// replaces the basic bounce with a richer GSAP win animation.
//
// Bug: SpriteSymbol.stopAnimation() calls `this._sprite.scale.set(1, 1)`.
// resize() sets dimensions via `sprite.width = w` which Pixi stores as a
// fractional scale (e.g. 140/256 ≈ 0.547). Resetting to (1,1) snaps the
// sprite to native texture size — symbols blow up after a win animation.
//
// Fix: track last resize dimensions, re-apply them after super.stopAnimation().
// Remove this file once pixi-reels ships a fix upstream.
//
// NOTE: ColorMatrixFilter intentionally removed from the win animation.
// When Pixi applies a filter to a container it renders that container to an
// offscreen framebuffer sized to the element's SCREEN-SPACE bounds. On mobile
// the symbol is ~50 CSS pixels, so the framebuffer is ~100px (2× DPR). The
// scale tween then draws that 100px framebuffer at 135% — you see the
// framebuffer stretched, not the original texture. Without a filter, Pixi
// renders directly from the full-res texture each frame with no intermediary.

import gsap from 'gsap';
import { SpriteSymbol } from 'pixi-reels';

export class FixedSpriteSymbol extends SpriteSymbol {
  private _lastW = 0;
  private _lastH = 0;
  private _winTimeline: gsap.core.Timeline | null = null;

  override resize(w: number, h: number): void {
    this._lastW = w;
    this._lastH = h;
    super.resize(w, h);
  }

  override async playWin(): Promise<void> {
    this._killWinTimeline();

    return new Promise((resolve) => {
      this._winTimeline = gsap
        .timeline({
          onComplete: () => resolve(),
        })
        // 1) Pop up with overshoot — no filter so Pixi renders straight from texture
        .to(this.view.scale, { x: 1.35, y: 1.35, duration: 0.18, ease: 'back.out(2.5)' }, 0)
        // 2) Rotation wobble — left, right, centre
        .to(this.view, { rotation:  0.13, duration: 0.09, ease: 'power1.inOut' }, 0.16)
        .to(this.view, { rotation: -0.13, duration: 0.09, ease: 'power1.inOut' }, 0.25)
        .to(this.view, { rotation:  0,    duration: 0.09, ease: 'power1.inOut' }, 0.34)
        // 3) Settle back to normal size with a small bounce
        .to(this.view.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(1.8)' }, 0.28)
        // 4) Second mini-pulse for extra flair
        .to(this.view.scale, { x: 1.15, y: 1.15, duration: 0.13, ease: 'power2.out' }, 0.56)
        .to(this.view.scale, { x: 1,    y: 1,    duration: 0.18, ease: 'power2.inOut' }, 0.69);
    });
  }

  override stopAnimation(): void {
    this._killWinTimeline();
    // Reset container transform before calling super (which resets sprite scale).
    this.view.rotation = 0;
    this.view.scale.set(1, 1);
    super.stopAnimation(); // kills parent tween + incorrectly resets sprite scale to (1,1)
    // Re-apply correct pixel dimensions to undo the sprite scale reset.
    if (this._lastW > 0) super.resize(this._lastW, this._lastH);
  }

  private _killWinTimeline(): void {
    this._winTimeline?.kill();
    this._winTimeline = null;
  }
}

