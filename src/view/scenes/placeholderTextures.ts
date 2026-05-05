// Generates placeholder textures for each symbol id so pixi-reels can boot
// before real art lands. Replace with real loaded textures by updating the
// asset manifest; the rest of the wiring is unchanged.

import { type Application, Graphics, type Renderer, type Texture } from 'pixi.js';

const SYMBOL_COLORS: Record<string, [number, number]> = {
  cherry: [0xef4444, 0xb91c1c],
  lemon: [0xf5c518, 0xca8a04],
  orange: [0xff8a3d, 0xc2410c],
  plum: [0xc084fc, 0x7e22ce],
  bell: [0xfbbf24, 0xb45309],
  bar: [0x60a5fa, 0x1d4ed8],
  seven: [0xf43f5e, 0x9f1239],
  wild: [0x22d3ee, 0x0e7490],
  scatter: [0xa78bfa, 0x6d28d9],
};

export function createPlaceholderTextures(
  app: Application,
  symbolIds: readonly string[],
  size = 140,
): Record<string, Texture> {
  const renderer = app.renderer as Renderer;
  const textures: Record<string, Texture> = {};
  for (const id of symbolIds) {
    const [light, dark] = SYMBOL_COLORS[id] ?? [0x4b5563, 0x1f2937];
    const g = new Graphics();
    g.roundRect(0, 0, size, size, 18);
    g.fill({ color: light });
    g.roundRect(0, 0, size, size, 18);
    g.stroke({ color: 0xffffff, alpha: 0.12, width: 2 });
    // Dark accent stripe
    g.rect(0, size * 0.72, size, size * 0.28);
    g.fill({ color: dark, alpha: 0.65 });
    const texture = renderer.generateTexture({ target: g, resolution: 2 });
    textures[id] = texture;
    g.destroy();
  }
  return textures;
}
