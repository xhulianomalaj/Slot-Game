// BackgroundLayer — full-viewport tiled background with optional vignette.
//
// Why a dedicated class (and not a SmartContainer):
//   - SmartContainer scales a fixed safe-area design (1920x1080 / 1080x1920)
//     into the viewport. That's right for HUD + reels, where you want
//     "letterbox is fine, content stays readable".
//   - The background must do the OPPOSITE: cover every pixel of the viewport
//     at every aspect ratio, with no letterboxing, ever.
//
// Two rendering modes, chosen per BackgroundDef:
//
//   TILE mode  (default) — TilingSprite fills the viewport and repeats the
//     texture. Good for abstract prototype tiles. `tileScale` controls density.
//
//   COVER mode — when `srcLandscape` / `srcPortrait` are set on the def, a
//     plain Sprite is scaled with fitCover (uniformly, cropping the edges).
//     On orientation change the correct texture variant is swapped in.
//     Used for full-bleed scene art that has separate landscape/portrait versions.
//
// Hot-swap: call `setBackground(id)` at any time.

import { Assets, Container, Sprite, Texture, TilingSprite } from 'pixi.js';
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
  private readonly coverSprite: Sprite;
  private readonly vignette: Sprite;
  private readonly designShorterEdge: number;
  private currentId: BackgroundId;
  private currentDef: BackgroundDef;
  private coverLandscapeTex: Texture | null = null;
  private coverPortraitTex: Texture | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(opts: BackgroundLayerOpts = {}) {
    super();
    this.label = 'background'; // pixi-test-label
    this.designShorterEdge = opts.designShorterEdge ?? 1080;
    this.currentId = opts.initial ?? THEME.background;
    this.currentDef = getBackground(this.currentId);

    const placeholder = Texture.EMPTY;

    this.tile = new TilingSprite({ texture: placeholder, width: 1, height: 1 });
    this.addChild(this.tile);

    this.coverSprite = new Sprite(placeholder);
    this.coverSprite.visible = false;
    this.addChild(this.coverSprite);

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

  private isCoverMode(def: BackgroundDef): boolean {
    return !!(def.srcLandscape || def.srcPortrait);
  }

  private async applyDefinition(def: BackgroundDef): Promise<void> {
    if (this.isCoverMode(def)) {
      // Load both orientation textures in parallel.
      const [land, port] = await Promise.all([
        Assets.load<Texture>(def.srcLandscape ?? def.src),
        Assets.load<Texture>(def.srcPortrait ?? def.src),
      ]);
      this.coverLandscapeTex = land;
      this.coverPortraitTex = port;
      this.tile.visible = false;
      this.coverSprite.visible = true;
    } else {
      const texture = await Assets.load<Texture>(def.src);
      if (texture.source) texture.source.addressMode = 'repeat';
      this.tile.texture = texture;
      this.tile.tint = def.tint ?? 0xffffff;
      this.coverLandscapeTex = null;
      this.coverPortraitTex = null;
      this.tile.visible = true;
      this.coverSprite.visible = false;
    }

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
    const { width: vw, height: vh, isPortrait } = resizeObject;
    if (vw <= 0 || vh <= 0) return;

    if (this.coverSprite.visible) {
      // COVER mode — fitCover scaling: fill viewport, crop the excess.
      const tex = isPortrait
        ? (this.coverPortraitTex ?? this.coverLandscapeTex)
        : (this.coverLandscapeTex ?? this.coverPortraitTex);

      if (tex && this.coverSprite.texture !== tex) {
        this.coverSprite.texture = tex;
      }

      if (tex) {
        const scaleX = vw / tex.width;
        const scaleY = vh / tex.height;
        const scale = Math.max(scaleX, scaleY);
        this.coverSprite.scale.set(scale);
        this.coverSprite.x = (vw - tex.width * scale) / 2;
        this.coverSprite.y = (vh - tex.height * scale) / 2;
      }
    } else {
      // TILE mode — fill viewport, scale tile density from shorter edge.
      this.tile.width = Math.ceil(vw);
      this.tile.height = Math.ceil(vh);

      const shorter = Math.min(vw, vh);
      const baseScale = shorter / this.designShorterEdge;
      const tileScale = (this.currentDef.tileScale ?? 1) * baseScale;
      this.tile.tileScale.set(tileScale);
    }

    if (this.vignette.visible) {
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

// 1x1 transparent PNG previously used as placeholder — replaced by Texture.EMPTY.
// Kept here in case it's referenced elsewhere; safe to delete if unused.
// const emptyDataURL =
//   'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
