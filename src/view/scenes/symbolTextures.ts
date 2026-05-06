// Load symbol textures via Pixi's Assets API. Aliases like "bar.png" are
// registered by Assets.init() from the assetpack-generated manifest, which
// resolves them to the correct cache-busted URLs automatically.
//
// Returns Promise<Record<symbolId, Texture>> ready for
// ReelSetBuilder().symbols((r) => r.register(id, SpriteSymbol, { textures })).

import { Assets, type Texture } from 'pixi.js';

export async function loadSymbolTextures(symbolIds: readonly string[]): Promise<Record<string, Texture>> {
  // Aliases in the manifest are "<id>.png" — e.g. "bar.png", "bell.png".
  const aliases = symbolIds.map((id) => `${id}.png`);
  const loaded = await Assets.load(aliases);
  // Re-key by plain id (without .png) for ReelSetBuilder compatibility.
  return Object.fromEntries(symbolIds.map((id) => [id, loaded[`${id}.png`]])) as Record<string, Texture>;
}
