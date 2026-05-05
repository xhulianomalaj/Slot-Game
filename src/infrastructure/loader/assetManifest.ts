// Asset bundles. The structure is what `pixi.js`'s `Assets.addBundle` expects.
// In production, the bundles are populated by `@assetpack/core` — the
// `.assetpack.mjs` config at the repo root generates this manifest at build
// time from `raw-assets/`.
//
// For now, this file hand-declares a minimal manifest so the game boots
// before you wire the assetpack pipeline.

export interface AssetEntry {
  alias: string | string[];
  src: string;
}
export interface AssetBundleDef {
  name: string;
  assets: AssetEntry[];
}

export const BUNDLES: AssetBundleDef[] = [
  {
    name: 'boot',
    // Boot-critical: logo, first fonts, splash bg. Keep tiny — blocks the loader.
    assets: [],
  },
  {
    name: 'main',
    // Main-game art — symbols, frames, UI accents.
    assets: [
      // Example once you have assets:
      // { alias: 'cherry', src: 'assets/symbols/cherry.webp' },
      // { alias: 'lemon',  src: 'assets/symbols/lemon.webp' },
    ],
  },
  {
    name: 'bonus',
    // Lazy-loaded when the bonus phase enters. Don't block the main game.
    assets: [],
  },
];
