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
import { Sprite } from 'pixi.js';
import { SpriteSymbol } from 'pixi-reels';

export class FixedSpriteSymbol extends SpriteSymbol {
  private _lastW = 0;
  private _lastH = 0;
  private _winTimeline: gsap.core.Timeline | null = null;
  private _glowSprite: Sprite | null = null;

  override resize(w: number, h: number): void {
    this._lastW = w;
    this._lastH = h;
    super.resize(w, h);
  }

  override async playWin(): Promise<void> {
    this._killWinTimeline();
    this._destroyGlow();

    // Additive-blend glow overlay — same texture, GPU blends src+dst directly.
    // No filter → no offscreen framebuffer → no resolution cap → no pixelation.
    // _sprite is private in SpriteSymbol; view.children[0] is always the sprite
    // (SpriteSymbol constructor adds it first and nothing else prepends to view).
    const baseSprite = this.view.children[0] as Sprite;
    const glow = new Sprite(baseSprite.texture);
    glow.anchor.copyFrom(baseSprite.anchor);
    glow.width = this._lastW;
    glow.height = this._lastH;
    glow.blendMode = 'add';
    glow.alpha = 0;
    this.view.addChild(glow);
    this._glowSprite = glow;

    return new Promise((resolve) => {
      this._winTimeline = gsap
        .timeline({
          onComplete: () => {
            this._destroyGlow();
            resolve();
          },
        })
        // 1) Pop up with overshoot
        .to(this.view.scale, { x: 1.35, y: 1.35, duration: 0.18, ease: 'back.out(2.5)' }, 0)
        // 2) Glow flash in sync with the pop (alpha 0 → 0.65 → 0)
        .to(glow, { alpha: 0.65, duration: 0.12, ease: 'power2.out' }, 0)
        .to(glow, { alpha: 0,    duration: 0.32, ease: 'power2.in'  }, 0.16)
        // 3) Rotation wobble — left, right, centre
        .to(this.view, { rotation:  0.13, duration: 0.09, ease: 'power1.inOut' }, 0.16)
        .to(this.view, { rotation: -0.13, duration: 0.09, ease: 'power1.inOut' }, 0.25)
        .to(this.view, { rotation:  0,    duration: 0.09, ease: 'power1.inOut' }, 0.34)
        // 4) Settle back to normal size with a small bounce
        .to(this.view.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(1.8)' }, 0.28)
        // 5) Second mini-pulse with a quick glow re-flash
        .to(this.view.scale, { x: 1.15, y: 1.15, duration: 0.13, ease: 'power2.out'   }, 0.56)
        .to(glow,            { alpha: 0.4,        duration: 0.10, ease: 'power2.out'   }, 0.56)
        .to(this.view.scale, { x: 1,    y: 1,    duration: 0.18, ease: 'power2.inOut' }, 0.69)
        .to(glow,            { alpha: 0,           duration: 0.18, ease: 'power2.in'   }, 0.69);
    });
  }

  override stopAnimation(): void {
    this._killWinTimeline();
    this._destroyGlow();
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

  private _destroyGlow(): void {
    if (this._glowSprite) {
      this._glowSprite.destroy();
      this._glowSprite = null;
    }
  }
}

