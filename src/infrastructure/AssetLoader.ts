// AssetLoader — facade over Pixi's Assets API with progress reporting.
//
// At boot, calls `Assets.init({ manifest: '/assets/manifest.json' })` to
// register the assetpack-generated manifest. This manifest maps stable aliases
// (e.g. "bg-landscape.png") to the real cache-busted filenames on disk.
// All subsequent `Assets.load()` / `Assets.loadBundle()` calls use those
// stable aliases — the hashed URLs are resolved automatically by Pixi.

import { Assets } from 'pixi.js';

export type ProgressFn = (progress: number) => void;

let manifestInitialized = false;

/** Initialize Pixi Assets with the assetpack-generated manifest. Call once at boot. */
export async function initAssets(): Promise<void> {
  if (manifestInitialized) return;
  await Assets.init({ manifest: '/assets/manifest.json', basePath: '/assets' });
  manifestInitialized = true;
}

export class AssetLoader {
  /** Load every bundle declared in the manifest, reporting aggregate progress. */
  async loadAll(onProgress?: ProgressFn): Promise<void> {
    await initAssets();
    // The generated manifest has a single "default" bundle containing all assets.
    await Assets.loadBundle('default', (p) => onProgress?.(p));
    onProgress?.(1);
  }
}
