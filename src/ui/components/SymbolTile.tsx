// Small visual tile for a symbol id. Uses real art from public/assets/symbols/
// with a colored-gradient fallback so the HUD stays readable if art is missing.

import type { JSX } from 'preact';

const SYMBOL_COLOR: Record<string, [string, string]> = {
  cherry: ['#ef4444', '#b91c1c'],
  lemon: ['#f5c518', '#ca8a04'],
  orange: ['#ff8a3d', '#c2410c'],
  plum: ['#c084fc', '#7e22ce'],
  bell: ['#fbbf24', '#b45309'],
  bar: ['#60a5fa', '#1d4ed8'],
  seven: ['#f43f5e', '#9f1239'],
  wild: ['#22d3ee', '#0e7490'],
  scatter: ['#a78bfa', '#6d28d9'],
};

export function SymbolTile({ symbolId, size = 48 }: { symbolId: string; size?: number }): JSX.Element {
  const [a, b] = SYMBOL_COLOR[symbolId] ?? ['#4b5563', '#1f2937'];
  return (
    <div
      class="symbol-tile"
      role="img"
      aria-label={symbolId}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${a}, ${b})`,
      }}
    >
      <img
        src={`/assets/symbols/${symbolId}.png`}
        alt={symbolId}
        onError={(e) => {
          // If art is missing, drop the image and the gradient shows through.
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}
