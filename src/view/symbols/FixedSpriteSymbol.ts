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

import gsap from 'gsap';
import { ColorMatrixFilter } from 'pixi.js';
import { SpriteSymbol } from 'pixi-reels';

export class FixedSpriteSymbol extends SpriteSymbol {
  private _lastW = 0;
  private _lastH = 0;
  private _winTimeline: gsap.core.Timeline | null = null;
  private _glowFilter: ColorMatrixFilter | null = null;

  override resize(w: number, h: number): void {
    this._lastW = w;
    this._lastH = h;
    super.resize(w, h);
  }

  override async playWin(): Promise<void> {
    this._killWinTimeline();

    // Glow filter — brightness pulses on the container.
    const filter = new ColorMatrixFilter();
    this._glowFilter = filter;
    this.view.filters = [filter];
    const glow = { brightness: 1 };

    return new Promise((resolve) => {
      this._winTimeline = gsap
        .timeline({
          onComplete: () => {
            this._cleanupFilters();
            resolve();
          },
        })
        // 1) Pop up with overshoot
        .to(this.view.scale, { x: 1.35, y: 1.35, duration: 0.18, ease: 'back.out(2.5)' }, 0)
        // 2) Brightness flash in sync with the pop
        .to(glow, {
          brightness: 2.8,
          duration: 0.12,
          ease: 'power2.out',
          onUpdate: () => filter.brightness(glow.brightness, false),
        }, 0)
        // 3) Rotation wobble — left, right, centre
        .to(this.view, { rotation:  0.13, duration: 0.09, ease: 'power1.inOut' }, 0.16)
        .to(this.view, { rotation: -0.13, duration: 0.09, ease: 'power1.inOut' }, 0.25)
        .to(this.view, { rotation:  0,    duration: 0.09, ease: 'power1.inOut' }, 0.34)
        // 4) Brightness fades back
        .to(glow, {
          brightness: 1,
          duration: 0.32,
          ease: 'power2.in',
          onUpdate: () => filter.brightness(glow.brightness, false),
        }, 0.16)
        // 5) Settle back to normal size with a small bounce
        .to(this.view.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(1.8)' }, 0.28)
        // 6) Second mini-pulse for extra flair
        .to(this.view.scale, { x: 1.15, y: 1.15, duration: 0.13, ease: 'power2.out' }, 0.56)
        .to(this.view.scale, { x: 1,    y: 1,    duration: 0.18, ease: 'power2.inOut' }, 0.69);
    });
  }

  override stopAnimation(): void {
    this._killWinTimeline();
    this._cleanupFilters();
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

  private _cleanupFilters(): void {
    if (this._glowFilter) {
      this.view.filters = [];
      this._glowFilter.destroy();
      this._glowFilter = null;
    }
  }
}

