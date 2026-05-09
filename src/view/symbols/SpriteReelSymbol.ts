// SpriteReelSymbol — the default symbol implementation for slotplate.
//
// This uses plain Pixi Sprites and GSAP for win animations. No Spine.
// For Spine symbols, see SpineReelSymbol.ts (optional peer dep).
//
// The class mirrors the contract of `pixi-reels`'s ReelSymbol:
//   onActivate(): called when the symbol is shown or swapped in.
//   onDeactivate(): called when the symbol scrolls off / returns to pool.
//   playWin(): win-cycle animation.
//   stopAnimation(): interrupt playWin.
//   resize(w, h): called on every swap — reposition internals here.
//
// When you wire real pixi-reels, extend its `ReelSymbol` instead of this stub.

import gsap from 'gsap';
import { Container, Sprite, type Texture } from 'pixi.js';

export class SpriteReelSymbol extends Container {
  private sprite: Sprite;
  private winTween: gsap.core.Tween | null = null;
  /** Cell-fitted scale set by resize() — restored after every animation. */
  private fittedScaleX = 1;
  private fittedScaleY = 1;

  constructor(
    public readonly id: string,
    texture: Texture,
  ) {
    super();
    this.sprite = new Sprite(texture);
    // Anchor at center so scale tweens on the sprite grow from its middle,
    // not the top-left corner. Position is set to cell center in resize().
    this.sprite.anchor.set(0.5);
    this.addChild(this.sprite);
  }

  onActivate(): void {
    this.visible = true;
    this.alpha = 1;
    this.scale.set(1);
  }

  onDeactivate(): void {
    this.stopAnimation();
    this.visible = false;
  }

  playWin(): Promise<void> {
    // Kill any in-progress tween before starting a new one.
    this.winTween?.kill();
    // Use fromTo so GSAP knows the exact start value (the cell-fitted scale).
    // Using gsap.to() with a prior scale.set(1) was the bug: it snapped the
    // sprite to native texture size and left it there after onComplete.
    const sx = this.fittedScaleX;
    const sy = this.fittedScaleY;
    return new Promise((resolve) => {
      this.winTween = gsap.fromTo(
        this.sprite.scale,
        { x: sx, y: sy },
        {
          x: sx * 1.1,
          y: sy * 1.1,
          duration: 0.22,
          yoyo: true,
          repeat: 3,
          ease: 'power2.inOut',
          onComplete: () => {
            this.sprite.scale.set(sx, sy);
            resolve();
          },
        },
      );
    });
  }

  stopAnimation(): void {
    this.winTween?.kill();
    this.winTween = null;
    // Restore cell-fitted scale so the sprite looks correct after interruption.
    this.sprite.scale.set(this.fittedScaleX, this.fittedScaleY);
  }

  resize(width: number, height: number): void {
    this.sprite.width = width;
    this.sprite.height = height;
    // Round to whole pixels — fractional centers cause sub-pixel sampling
    // shifts during the scale tween that are very visible on small mobile screens.
    this.sprite.position.set(Math.round(width / 2), Math.round(height / 2));
    // Snapshot the scale Pixi computed from width/height so animations
    // can tween relative to it and restore it precisely afterwards.
    this.fittedScaleX = this.sprite.scale.x;
    this.fittedScaleY = this.sprite.scale.y;
  }
}
