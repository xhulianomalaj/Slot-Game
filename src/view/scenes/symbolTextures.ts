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

  // Prevent mipmap-level switching during win scale animations.
  // On mobile the reel panel is scaled down significantly, so symbols are
  // displayed well below their native resolution. As the scale tween runs,
  // the GPU's LOD calculation crosses a mipmap boundary and the driver snaps
  // to a lower-res mip level mid-animation — visible as a sudden quality drop.
  //
  // lodMaxClamp = 0 is the correct sampler-level fix: it clamps the GPU's
  // level-of-detail selection to mip level 0 (full resolution) regardless of
  // how small the symbol appears on screen. The sampler change takes effect
  // immediately on already-uploaded textures, unlike post-load source mutations
  // (autoGenerateMipmaps / mipLevelCount) which don't re-upload GPU data.
  for (const texture of Object.values(result)) {
    if (texture?.source?.style) {
      texture.source.style.lodMaxClamp = 0;
    }
  }

  return result;
}
