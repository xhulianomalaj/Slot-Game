// AssetPack config — optimizes `raw-assets/` into `public/assets/` at build time.
//
//   pnpm run assets:pack   # one-off
//   pnpm run assets:watch  # watch mode for dev
//
// Extend with texture-packer, webp compression, audio plugins as your game grows.
// See https://pixijs.io/assetpack/ for the full plugin set.

import { pixiPipes } from '@assetpack/core/pixi';

export default {
  entry: './raw-assets',
  output: './public/assets',
  cache: true,
  cacheLocation: '.assetpack-cache',
  pipes: [...pixiPipes({ cacheBust: true, resolutions: { default: 1, low: 0.5 }, compression: { jpg: true, png: true, webp: true } })],
};
