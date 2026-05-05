// FixedSpriteSymbol — patches a scale-reset bug in pixi-reels v0.1.0.
//
// SpriteSymbol.stopAnimation() calls `this._sprite.scale.set(1, 1)` after
// killing the win tween. But resize() sets dimensions via `sprite.width = w`
// which Pixi stores as scale = w / textureWidth (e.g. 140/256 ≈ 0.547).
// Resetting to (1,1) snaps the sprite to its native texture size — causing
// symbols to blow up visually after a win animation ends or is interrupted.
//
// Fix: track the last resize dimensions and re-apply them after super.stopAnimation().
// Remove this file once pixi-reels ships a fix upstream.

import { SpriteSymbol } from 'pixi-reels';

export class FixedSpriteSymbol extends SpriteSymbol {
  private _lastW = 0;
  private _lastH = 0;

  override resize(w: number, h: number): void {
    this._lastW = w;
    this._lastH = h;
    super.resize(w, h);
  }

  override stopAnimation(): void {
    super.stopAnimation(); // kills tween, incorrectly sets sprite scale to (1,1)
    // Re-apply the correct pixel dimensions so the sprite fits the cell again.
    if (this._lastW > 0) super.resize(this._lastW, this._lastH);
  }
}
