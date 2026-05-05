// BackgroundPresenter — the one surface for swapping the in-game background.
//
// The HUD / settings menu / debug command never reach into MainScene or
// BackgroundLayer directly. They go through this presenter, which is the
// stable contract:
//
//   - List the available backgrounds (drives the picker UI).
//   - Get the current background id (drives the "selected" indicator).
//   - Swap to a different one (asynchronously, since textures load lazily).
//
// To replace BackgroundLayer with a video / shader / WebGL shader, swap the
// implementation in `composition.ts`. Callers stay the same.

import { BACKGROUNDS, type BackgroundId } from '@/config/theme';
import type { BackgroundLayer } from '@/view/scenes/BackgroundLayer';

export interface BackgroundOption {
  id: BackgroundId;
  /** Human-readable label for a settings UI. */
  label: string;
}

export class BackgroundPresenter {
  constructor(private readonly layer: BackgroundLayer) {}

  list(): BackgroundOption[] {
    return (Object.keys(BACKGROUNDS) as BackgroundId[]).map((id) => ({ id, label: idToLabel(id) }));
  }

  current(): BackgroundId {
    return this.layer.backgroundId;
  }

  async setBackground(id: BackgroundId): Promise<void> {
    await this.layer.setBackground(id);
  }
}

function idToLabel(id: BackgroundId): string {
  return id
    .split('-')
    .map((s) => {
      const first = s.charAt(0);
      return first ? first.toUpperCase() + s.slice(1) : s;
    })
    .join(' ');
}
