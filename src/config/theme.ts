// Theme registry — visual config that does NOT cross the wire.
//
// Anything in here is purely cosmetic: backgrounds, tints, vignette strength,
// HUD palette. Swapping a theme should never change game math, server contract,
// or grid dimensions (those live in `gameConfig.ts`).
//
// To add a new background, drop a tileable PNG into `public/assets/bg/`,
// register it in `BACKGROUNDS` below, then point `THEME.background` at the
// new id. No other file needs to change.

export interface BackgroundDef {
  /** Public URL of the tileable texture. Loaded by `AssetLoader`. */
  src: string;
  /**
   * Multiplier on the design tile size. The tile is rendered at
   * `tileScale * (viewportShorterEdge / 1080)` so the same texture looks
   * proportionate on a phone and a 4K monitor.
   *
   * Bump this up for chunky low-frequency tiles (1.5–2). Drop it for
   * busy high-frequency tiles (0.5–0.75). 1.0 is the safe default.
   */
  tileScale?: number;
  /** Multiplicative tint applied to the tile. 0xFFFFFF = no tint. */
  tint?: number;
  /** Optional vignette overlay drawn on top of the tile. */
  vignette?: VignetteDef | false;
}

export interface VignetteDef {
  /** Public URL of a soft radial gradient (white-center, black-edge). */
  src: string;
  /** 0..1 — opacity of the vignette overlay. 0.45 looks good on Dark tiles. */
  alpha?: number;
  /** Tint applied to the vignette. Use a dark color to dim the edges. */
  color?: number;
}

const DEFAULT_VIGNETTE: VignetteDef = {
  src: '/assets/bg/vignette-radial.png',
  alpha: 0.55,
  color: 0x000000,
};

/**
 * The catalog of available backgrounds. Add new entries here and they become
 * selectable everywhere (`THEME.background = '<id>'` or
 * `bgPresenter.setBackground('<id>')` at runtime for a theme picker).
 */
export const BACKGROUNDS = {
  'proto-dark-01': {
    src: '/assets/bg/proto-dark-01.png',
    tileScale: 1.0,
    tint: 0xffffff,
    vignette: DEFAULT_VIGNETTE,
  },
  'proto-dark-05': {
    src: '/assets/bg/proto-dark-05.png',
    tileScale: 0.85,
    tint: 0xffffff,
    vignette: DEFAULT_VIGNETTE,
  },
  'proto-dark-13': {
    src: '/assets/bg/proto-dark-13.png',
    tileScale: 0.9,
    tint: 0xffffff,
    vignette: DEFAULT_VIGNETTE,
  },
  'proto-light-01': {
    src: '/assets/bg/proto-light-01.png',
    tileScale: 1.0,
    tint: 0xdfe4e8,
    vignette: { ...DEFAULT_VIGNETTE, alpha: 0.35 },
  },
  'proto-purple-05': {
    src: '/assets/bg/proto-purple-05.png',
    tileScale: 0.85,
    tint: 0xffffff,
    vignette: { ...DEFAULT_VIGNETTE, alpha: 0.5, color: 0x14072b },
  },
  'proto-green-05': {
    src: '/assets/bg/proto-green-05.png',
    tileScale: 0.85,
    tint: 0xffffff,
    vignette: { ...DEFAULT_VIGNETTE, alpha: 0.5, color: 0x06160c },
  },
} as const satisfies Record<string, BackgroundDef>;

export type BackgroundId = keyof typeof BACKGROUNDS;

/**
 * Active theme. Change `background` to swap the tile everywhere with no
 * other code change — the BackgroundLayer reads this at boot and the
 * BackgroundPresenter exposes `setBackground(id)` for live swapping.
 */
export const THEME = {
  /** Solid color drawn under the tile — what you see while assets load. */
  clearColor: 0x0e1d21,
  /** Active background id. Must be a key of `BACKGROUNDS`. */
  background: 'proto-dark-05' as BackgroundId,
} as const;

export function getBackground(id: BackgroundId): BackgroundDef {
  const def = BACKGROUNDS[id];
  if (!def) throw new Error(`[theme] unknown background id "${id}". Add it to BACKGROUNDS in src/config/theme.ts.`);
  return def;
}
