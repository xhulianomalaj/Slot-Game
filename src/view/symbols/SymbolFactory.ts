// Per-symbol factory: picks the right class (sprite vs spine) per symbol id.
// The ReelsPresenter asks the factory for a fresh symbol; the factory reads
// config and returns a ready-to-pool Container.

import { type Container, Texture } from 'pixi.js';
import { SpriteReelSymbol } from './SpriteReelSymbol';
// import { SpineReelSymbol } from './SpineReelSymbol';

export type SymbolRenderer = 'sprite' | 'spine';

export interface SymbolDefinition {
  id: string;
  renderer: SymbolRenderer;
  // Sprite:
  textureAlias?: string;
  // Spine:
  atlasAlias?: string;
  skeletonAlias?: string;
}

export class SymbolFactory {
  constructor(private readonly definitions: Record<string, SymbolDefinition>) {}

  create(id: string): Container {
    const def = this.definitions[id];
    if (!def) throw new Error(`[SymbolFactory] unknown symbol id: ${id}`);

    switch (def.renderer) {
      case 'sprite': {
        if (!def.textureAlias) throw new Error(`[SymbolFactory] sprite symbol ${id} missing textureAlias`);
        const texture = Texture.from(def.textureAlias);
        return new SpriteReelSymbol(id, texture);
      }
      case 'spine': {
        // Uncomment once @esotericsoftware/spine-pixi-v8 is installed:
        //   return new SpineReelSymbol(id, def.atlasAlias!, def.skeletonAlias!);
        throw new Error(`[SymbolFactory] spine symbol ${id}: peer dep @esotericsoftware/spine-pixi-v8 not installed`);
      }
      default: {
        const _exhaustive: never = def.renderer;
        return _exhaustive;
      }
    }
  }
}
