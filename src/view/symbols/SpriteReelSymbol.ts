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
    this.sprite.anchor.set(0, 0); // slotplate convention — top-left
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
    return new Promise((resolve) => {
      this.winTween = gsap.to(this.scale, {
        x: 1.15,
        y: 1.15,
        duration: 0.25,
        yoyo: true,
        repeat: 3,
        ease: 'power2.inOut',
        onComplete: () => {
          this.scale.set(1);
          resolve();
        },
      });
    });
  }

  stopAnimation(): void {
    this.winTween?.kill();
    this.winTween = null;
    this.scale.set(1);
  }

  resize(width: number, height: number): void {
    // Re-fit the sprite to the cell. Called on every symbol swap by the
    // reel engine — always repaint from scratch here, never assume
    // previous state.
    this.sprite.width = width;
    this.sprite.height = height;
    this.sprite.position.set(0, 0);
  }
}
