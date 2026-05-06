// Load symbol textures via Pixi's Assets API. Aliases like "bar.png" are
// registered by Assets.init() from the assetpack-generated manifest, which
// resolves them to the correct cache-busted URLs automatically.
//
// Returns Promise<Record<symbolId, Texture>> ready for
// ReelSetBuilder().symbols((r) => r.register(id, SpriteSymbol, { textures })).

import { Assets, type Texture } from 'pixi.js';

export async function loadSymbolTextures(symbolIds: readonly string[]): Promise<Record<string, Texture>> {
  // Use the full "symbols/<id>.png" alias — unambiguous even when the same
  // filename exists in multiple folders (e.g. scatter/wild live in both
  // icons/ and symbols/, so assetpack omits the short alias for those).
  const aliases = symbolIds.map((id) => `symbols/${id}.png`);
  const loaded = await Assets.load(aliases);
  // Re-key by plain id (without path/extension) for ReelSetBuilder compatibility.
  return Object.fromEntries(symbolIds.map((id) => [id, loaded[`symbols/${id}.png`]])) as Record<string, Texture>;
}
