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
import { Container, Graphics, Sprite } from 'pixi.js';
import { SpriteSymbol } from 'pixi-reels';

// High-value symbols get a periodic shine sweep while idle.
const HIGH_VALUE = new Set(['seven', 'wild', 'scatter']);

export class FixedSpriteSymbol extends SpriteSymbol {
  private _lastW = 0;
  private _lastH = 0;
  private _winTimeline: gsap.core.Timeline | null = null;
  private _glowSprite: Sprite | null = null;
  private _idSymbol = '';
  private _glintLayer: Container | null = null;
  private _glintTl: gsap.core.Timeline | null = null;
  private _particleContainer: Container | null = null;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  protected override onActivate(symbolId: string): void {
    super.onActivate(symbolId);
    this._idSymbol = symbolId;
    // Do NOT call _startIdleAnim here — view.y is set by pixi-reels AFTER
    // onActivate returns, so any position check here reads the stale value.
    // Idle animation is started externally via startIdleAnim() once the reel
    // has fully stopped and symbol positions are final.
  }

  protected override onDeactivate(): void {
    this._stopIdleAnim();
    this._killParticles();
    super.onDeactivate();
  }

  override resize(w: number, h: number): void {
    this._lastW = w;
    this._lastH = h;
    super.resize(w, h);
  }

  // ── Win animation ─────────────────────────────────────────────────────────

  override async playWin(): Promise<void> {
    this._stopIdleAnim();
    this._killWinTimeline();
    this._destroyGlow();
    this._killParticles();
    this._burstParticles();

    // Additive-blend glow overlay — same texture, GPU blends src+dst directly.
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
    this._killParticles();
    this._destroyGlow();
    // Reset container transform before calling super (which resets sprite scale).
    this.view.rotation = 0;
    this.view.scale.set(1, 1);
    super.stopAnimation(); // kills parent tween + incorrectly resets sprite scale to (1,1)
    // Re-apply correct pixel dimensions to undo the sprite scale reset.
    if (this._lastW > 0) super.resize(this._lastW, this._lastH);
    // Spotlight just ended — this symbol is visible, restart its idle shine.
    this.startIdleAnim();
  }

  /**
   * Start the idle shine sweep. Called externally by the adapter after each
   * spin finishes, on visible symbols only — so we never animate buffer rows.
   */
  startIdleAnim(): void {
    this._startIdleAnim();
  }

  // ── Idle shine sweep ──────────────────────────────────────────────────────

  private _startIdleAnim(): void {
    this._stopIdleAnim();
    if (!HIGH_VALUE.has(this._idSymbol) || this._lastW === 0) return;

    const w = this._lastW;
    const h = this._lastH;
    const SW = w * 0.38;   // band width
    const SK = h * 0.28;   // diagonal skew (how much the top leads the bottom)

    // Sub-container with a rect mask so the shine is clipped to the symbol.
    const layer = new Container();
    const clipMask = new Graphics().rect(0, 0, w, h).fill({ color: 0xffffff });
    layer.addChild(clipMask);
    layer.mask = clipMask;

    // The shine band is a skewed parallelogram.
    const shine = new Graphics()
      .poly([
        { x: SK,      y: 0 },
        { x: SK + SW, y: 0 },
        { x: SW,      y: h },
        { x: 0,       y: h },
      ])
      .fill({ color: 0xffffff, alpha: 0.55 });
    shine.blendMode = 'add';
    shine.alpha = 0;
    shine.x = -(SW + SK); // start off left edge
    layer.addChild(shine);
    this.view.addChild(layer);
    this._glintLayer = layer;

    // Stagger first glint by symbol id so on-screen sevens don't all flash at once.
    const phase = (this._idSymbol.charCodeAt(0) % 8) * 0.55;
    const SWEEP = 0.42;
    const HOLD  = 1.7;

    this._glintTl = gsap
      .timeline({ repeat: -1, delay: phase })
      .set(shine, { x: -(SW + SK), alpha: 0 })
      .to(shine, { alpha: 0.85, duration: 0.1, ease: 'power1.in' })
      .to(shine, { x: w + SK, duration: SWEEP, ease: 'power1.inOut' }, '<')
      .to(shine, { alpha: 0, duration: 0.1, ease: 'power1.out' }, `-=0.1`)
      .to({}, { duration: HOLD }); // pause before next sweep
  }

  private _stopIdleAnim(): void {
    this._glintTl?.kill();
    this._glintTl = null;
    if (this._glintLayer) {
      this._glintLayer.destroy({ children: true });
      this._glintLayer = null;
    }
  }

  // ── Particle burst ────────────────────────────────────────────────────────

  private _burstParticles(): void {
    const cx = this._lastW / 2;
    const cy = this._lastH / 2;
    if (cx === 0) return;

    const COLORS = [0xffd700, 0xffa500, 0xffe066, 0xffffaa, 0xff8c00];
    const COUNT = 10;

    const container = new Container();
    this.view.addChild(container);
    this._particleContainer = container;

    for (let i = 0; i < COUNT; i++) {
      const angle = (Math.PI * 2 * i) / COUNT + (Math.random() - 0.5) * 0.5;
      const speed = 60 + Math.random() * 80;
      const size = 4 + Math.random() * 4;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
      const dur = 0.55 + Math.random() * 0.3;

      const dot = new Graphics().circle(0, 0, size).fill({ color });
      dot.x = cx;
      dot.y = cy;
      container.addChild(dot);

      // Spread outward with a downward gravity bias so they arc and fall.
      const tx = cx + Math.cos(angle) * speed;
      const ty = cy + Math.sin(angle) * speed + 35;

      gsap
        .timeline()
        .to(dot, { x: tx, y: ty, duration: dur, ease: 'power2.out' }, 0)
        .to(dot, { alpha: 0, duration: dur * 0.4, ease: 'power2.in' }, dur * 0.6);
    }
  }

  private _killParticles(): void {
    if (this._particleContainer) {
      this._particleContainer.destroy({ children: true });
      this._particleContainer = null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

