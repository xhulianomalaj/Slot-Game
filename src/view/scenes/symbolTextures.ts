// Load symbol textures via Pixi's Assets API. Art lives in
// public/assets/symbols/<id>.png — drop replacements there (or generate via
// `pnpm run assets:generate`) and the game picks them up.
//
// Returns Promise<Record<symbolId, Texture>> ready for
// ReelSetBuilder().symbols((r) => r.register(id, SpriteSymbol, { textures })).

import { Assets, type Texture } from 'pixi.js';

export async function loadSymbolTextures(symbolIds: readonly string[]): Promise<Record<string, Texture>> {
  const entries = symbolIds.map((id) => ({ alias: id, src: `/assets/symbols/${id}.png` }));
  Assets.add(entries);
  const loaded = await Assets.load(symbolIds as string[]);
  return loaded as Record<string, Texture>;
}
