// AssetLoader — facade over Pixi's Assets API with progress reporting.
//
// Usage:
//   const loader = new AssetLoader(BUNDLES);
//   await loader.loadAll((progress) => uiStore.setLoadProgress(progress));
//
// In production, `@assetpack/core` (configured via `.assetpack.mjs` at the
// repo root) compiles `raw-assets/` into optimized bundles and hashes them
// for long cache TTLs. The `BUNDLES` manifest is what we feed Pixi's
// `Assets` API — one Pixi bundle per logical phase (boot / main / bonus).

import { Assets } from 'pixi.js';
import type { AssetBundleDef } from './loader/assetManifest';

export type ProgressFn = (progress: number) => void;

export class AssetLoader {
  private loadedBundles = new Set<string>();

  constructor(private readonly bundles: AssetBundleDef[]) {
    for (const b of bundles) {
      if (b.assets.length === 0) continue;
      Assets.addBundle(b.name, b.assets as unknown as Record<string, string>);
    }
  }

  /** Load every bundle in declared order, reporting aggregate progress. */
  async loadAll(onProgress?: ProgressFn): Promise<void> {
    const bundlesToLoad = this.bundles.filter((b) => b.assets.length > 0);
    if (bundlesToLoad.length === 0) {
      onProgress?.(1);
      return;
    }
    for (const [i, bundle] of bundlesToLoad.entries()) {
      const base = i / bundlesToLoad.length;
      const step = 1 / bundlesToLoad.length;
      await Assets.loadBundle(bundle.name, (p) => onProgress?.(base + p * step));
      this.loadedBundles.add(bundle.name);
    }
    onProgress?.(1);
  }

  async load(name: string, onProgress?: ProgressFn): Promise<void> {
    if (this.loadedBundles.has(name)) return;
    await Assets.loadBundle(name, onProgress);
    this.loadedBundles.add(name);
  }

  async unload(name: string): Promise<void> {
    if (!this.loadedBundles.has(name)) return;
    await Assets.unloadBundle(name);
    this.loadedBundles.delete(name);
  }
}
