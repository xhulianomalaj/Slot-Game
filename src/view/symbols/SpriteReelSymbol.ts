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
    // Kill any in-progress tween before starting a new one — guards against
    // being called twice on the same container (e.g. symbol wins on multiple lines).
    this.winTween?.kill();
    this.sprite.scale.set(1);
    return new Promise((resolve) => {
      // Tween the *sprite's* scale (anchor 0.5 → grows from center) rather than
      // the container's scale (which the reel engine positions externally).
      // Peak 1.1 is punchy on desktop and safe on mobile — stays inside the cell.
      this.winTween = gsap.to(this.sprite.scale, {
        x: 1.1,
        y: 1.1,
        duration: 0.22,
        yoyo: true,
        repeat: 3,
        ease: 'power2.inOut',
        onComplete: () => {
          this.sprite.scale.set(1);
          resolve();
        },
      });
    });
  }

  stopAnimation(): void {
    this.winTween?.kill();
    this.winTween = null;
    this.sprite.scale.set(1);
  }

  resize(width: number, height: number): void {
    // Re-fit the sprite to the cell. Called on every symbol swap by the
    // reel engine — always repaint from scratch here, never assume
    // previous state.
    this.sprite.width = width;
    this.sprite.height = height;
    // With anchor 0.5, the sprite must be positioned at cell center so it
    // renders in the same place as before. The container's position/pivot
    // are left untouched — the reel engine controls the container.
    this.sprite.position.set(width / 2, height / 2);
  }
}
