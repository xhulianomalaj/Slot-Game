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
  const result = Object.fromEntries(symbolIds.map((id) => [id, loaded[`symbols/${id}.png`]])) as Record<string, Texture>;

  // Disable auto-generated mipmaps on every symbol texture.
  // On mobile, the reel panel is scaled down significantly, so symbols are
  // displayed well below their native resolution. During win animations the
  // scale tween crosses a mipmap boundary, causing the GPU to jump to a
  // lower-res mipmap level — visually a sudden quality drop. With mipmaps
  // off, the GPU always samples the full-res texture with bilinear filtering.
  for (const texture of Object.values(result)) {
    if (texture?.source) {
      texture.source.autoGenerateMipmaps = false;
      texture.source.mipLevelCount = 1;
      texture.source.update();
    }
  }

  return result;
}
