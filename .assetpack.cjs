// AssetPack config — optimizes `raw-assets/` into `public/assets/` at build time.
//
//   pnpm run assets:pack   # one-off
//   pnpm run assets:watch  # watch mode for dev
//
// CJS format so the assetpack CLI's require() path works on Node 22+.
// (Node 22 can require() .mjs files without throwing ERR_REQUIRE_ESM, which
// broke the CLI's ESM-fallback detection and caused it to ignore the config.)
//
// Extend with texture-packer, webp compression, audio plugins as your game grows.
// See https://pixijs.io/assetpack/ for the full plugin set.

const { pixiPipes } = require('@assetpack/core/pixi');

module.exports = {
  entry: './raw-assets',
  output: './public/assets',
  cache: true,
  cacheLocation: '.assetpack-cache',
  pipes: [...pixiPipes({ cacheBust: true, resolutions: { default: 1, low: 0.5 }, compression: { jpg: true, png: true, webp: true } })],
};
