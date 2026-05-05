// BackgroundLayer — full-viewport tiled background with optional vignette.
//
// Why a dedicated class (and not a SmartContainer):
//   - SmartContainer scales a fixed safe-area design (1920x1080 / 1080x1920)
//     into the viewport. That's right for HUD + reels, where you want
//     "letterbox is fine, content stays readable".
//   - The background must do the OPPOSITE: cover every pixel of the viewport
//     at every aspect ratio, with no letterboxing, ever. We achieve that by
//     resizing a TilingSprite to the raw viewport dimensions and adjusting
//     `tileScale` so the texture stays proportionate across phones and 4K.
//
// Best-practice tiling rules baked in:
//   1. Use a power-of-two source texture (Kenney prototype textures are
//      1024x1024) — Pixi can wrap-sample without seams.
//   2. Set the addressMode to 'repeat' on both axes so TilingSprite samples
//      correctly across the seam.
//   3. Compute tileScale from the SHORTER viewport edge (so portrait and
//      landscape look matched) and divide by 1080 (our design baseline).
//   4. Round the rendered tile size to integer pixels — sub-pixel widths
//      give visible cracks at certain zoom levels on Retina displays.
//
// Hot-swap: call `setBackground(id)` at any time. The layer fades the new
// tile in over the old one without re-allocating the sprite.

import { Assets, Container, Sprite, type Texture, TilingSprite } from 'pixi.js';
import { type BackgroundDef, type BackgroundId, getBackground, THEME } from '@/config/theme';
import type { Disposable } from '@/utils/Disposable';
import { resizeObject } from '@/view/smart';

export interface BackgroundLayerOpts {
  /** Initial background id. Defaults to `THEME.background`. */
  initial?: BackgroundId;
  /**
   * Design baseline used to pick the tile scale. Default 1080 — the same
   * value SmartContainer uses for the portrait safe height.
   */
  designShorterEdge?: number;
}

export class BackgroundLayer extends Container implements Disposable {
  private readonly tile: TilingSprite;
  private readonly vignette: Sprite;
  private readonly designShorterEdge: number;
  private currentId: BackgroundId;
  private currentDef: BackgroundDef;
  private unsubscribe: (() => void) | null = null;

  constructor(opts: BackgroundLayerOpts = {}) {
    super();
    this.label = 'background'; // pixi-test-label
    this.designShorterEdge = opts.designShorterEdge ?? 1080;
    this.currentId = opts.initial ?? THEME.background;
    this.currentDef = getBackground(this.currentId);

    // The tile is created with a 1x1 transparent placeholder texture so the
    // sprite exists before assets load — we swap the real texture in
    // `loadInitial` without ever destroying the sprite.
    this.tile = new TilingSprite({
      texture: Sprite.from(emptyDataURL).texture,
      width: 1,
      height: 1,
    });
    this.addChild(this.tile);

    this.vignette = new Sprite();
    this.vignette.visible = false;
    this.addChild(this.vignette);

    this.unsubscribe = resizeObject.subscribe(() => this.applyResize());
    queueMicrotask(() => this.applyResize());
  }

  /** Load the initial background texture and apply it. Call once at boot. */
  async load(): Promise<void> {
    await this.applyDefinition(this.currentDef);
  }

  /** Hot-swap the background. Loads the new texture if needed and applies it. */
  async setBackground(id: BackgroundId): Promise<void> {
    if (id === this.currentId) return;
    const def = getBackground(id);
    await this.applyDefinition(def);
    this.currentId = id;
    this.currentDef = def;
  }

  /** Current background id — useful for theme pickers / settings UI. */
  get backgroundId(): BackgroundId {
    return this.currentId;
  }

  private async applyDefinition(def: BackgroundDef): Promise<void> {
    const texture = await Assets.load<Texture>(def.src);
    // Repeat-sample so the tiling sprite has no seam.
    if (texture.source) texture.source.addressMode = 'repeat';
    this.tile.texture = texture;
    this.tile.tint = def.tint ?? 0xffffff;

    if (def.vignette === false || !def.vignette) {
      this.vignette.visible = false;
    } else {
      const vTex = await Assets.load<Texture>(def.vignette.src);
      this.vignette.texture = vTex;
      this.vignette.alpha = def.vignette.alpha ?? 0.5;
      this.vignette.tint = def.vignette.color ?? 0x000000;
      this.vignette.visible = true;
    }

    this.applyResize();
  }

  private applyResize(): void {
    const { width: vw, height: vh } = resizeObject;
    if (vw <= 0 || vh <= 0) return;

    // Cover the full viewport — no letterbox on the background, ever.
    this.tile.width = Math.ceil(vw);
    this.tile.height = Math.ceil(vh);

    // Scale the tile so it looks proportionate across resolutions:
    // base it on the shorter edge so portrait and landscape match.
    const shorter = Math.min(vw, vh);
    const baseScale = shorter / this.designShorterEdge;
    const tileScale = (this.currentDef.tileScale ?? 1) * baseScale;
    this.tile.tileScale.set(tileScale);

    if (this.vignette.visible) {
      // Stretch the vignette across the full viewport — gradient tolerates
      // any aspect ratio. We let it stretch (not cover) so the dim band
      // hugs the edges regardless of orientation.
      this.vignette.width = vw;
      this.vignette.height = vh;
    }
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.destroy({ children: true });
  }
}

// 1x1 transparent PNG. Used as a placeholder so TilingSprite has a valid
// texture during the brief window before `load()` resolves.
const emptyDataURL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
