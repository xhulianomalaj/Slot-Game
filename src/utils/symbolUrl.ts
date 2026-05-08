// Resolves a symbol id to the actual URL of its full-resolution PNG.
//
// AssetPack renames every file to a cache-busted hash (e.g. bar-GENEYg.png).
// HTML <img> tags can't use Pixi's asset registry, so we parse the manifest
// once and build a plain id→url map. Falls back to the unhashed path so dev
// builds without a compiled manifest still show something.

import manifest from '../../public/assets/manifest.json';

interface ManifestAsset {
  alias: string[];
  src: string[];
}
interface ManifestBundle {
  assets: ManifestAsset[];
}

// Build { "bar" → "/assets/symbols/bar-GENEYg.png", … } once at module load.
function buildSymbolMap(): Record<string, string> {
  const map: Record<string, string> = {};
  const basePath = '/assets/';

  for (const bundle of (manifest as { bundles: ManifestBundle[] }).bundles) {
    for (const asset of bundle.assets) {
      // We only care about symbol assets — aliases contain "symbols/<id>.png"
      const symbolAlias = asset.alias.find(
        (a) => a.startsWith('symbols/') && a.endsWith('.png') && !a.includes('@'),
      );
      if (!symbolAlias) continue;

      // e.g. "symbols/bar.png" → "bar"
      const id = symbolAlias.replace('symbols/', '').replace('.png', '');

      // Pick the best src: full-res PNG (no @0.5x, no .webp)
      const src =
        asset.src.find((s) => s.endsWith('.png') && !s.includes('@0.5x')) ??
        asset.src.find((s) => s.endsWith('.png')) ??
        asset.src[0];

      if (src) map[id] = `${basePath}${src}`;
    }
  }
  return map;
}

const SYMBOL_URL_MAP = buildSymbolMap();

export function symbolUrl(id: string): string {
  return SYMBOL_URL_MAP[id] ?? `/assets/symbols/${id}.png`;
}
