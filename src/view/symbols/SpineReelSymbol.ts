// SpineReelSymbol — OPTIONAL. Wrapper around a Spine skeleton, patterned
// after the `bonbon-hw` codebase's GameSymbol + SymbolAnimationPlayer split.
//
// This file is a stub. To enable Spine:
//   1. pnpm add @esotericsoftware/spine-pixi-v8
//   2. Uncomment the import and the Spine-dependent bodies below.
//   3. Register per-symbol animations in src/config/spineAnimations.ts.
//   4. Use SpineReelSymbol for the symbols that need rigged animations and
//      keep SpriteReelSymbol for the rest — the SymbolFactory picks per id.
//
// Why this pattern (not one big class):
//   - Animation selection (which named tracks run for 'idle'/'landing'/'win')
//     is data, owned by SymbolAnimationPlayer.
//   - The symbol class is a dumb container that owns lifecycle + resize.
//   - Swappable: a game can ship a subset of symbols as Spine without forking
//     the renderer.

import { Container } from 'pixi.js';
// import { Spine } from '@esotericsoftware/spine-pixi-v8';

export type SpineAnimationName = 'idle' | 'landing' | 'win' | 'bigwin';

export interface SymbolAnimationConfig {
  // animationName → list of track names to play in parallel
  [key: string]: string[];
}

export interface SymbolAnimationPlayer {
  play(animation: { name: SpineAnimationName; loop: boolean; onComplete?: () => void }): void;
  stop(): void;
  clear(): void;
}

export class SpineReelSymbol extends Container {
  // private spine: Spine | null = null;
  private player: SymbolAnimationPlayer | null = null;

  constructor(
    public readonly id: string,
    // skeletonAtlas: string,
    // skeletonJson: string,
  ) {
    super();
    // Instantiate spine here once the peer dep is installed:
    //   this.spine = Spine.from({ atlas: skeletonAtlas, skeleton: skeletonJson });
    //   this.addChild(this.spine);
  }

  setPlayer(player: SymbolAnimationPlayer): void {
    this.player = player;
  }

  onActivate(): void {
    this.visible = true;
    this.player?.play({ name: 'idle', loop: true });
  }

  onDeactivate(): void {
    this.player?.stop();
    this.visible = false;
  }

  async playWin(): Promise<void> {
    return new Promise((resolve) => {
      this.player?.play({
        name: 'win',
        loop: false,
        onComplete: () => {
          this.player?.play({ name: 'idle', loop: true });
          resolve();
        },
      });
    });
  }

  stopAnimation(): void {
    this.player?.stop();
    this.player?.play({ name: 'idle', loop: true });
  }

  resize(_width: number, _height: number): void {
    // Spine centers at origin, so offset to cell center:
    //   this.spine.position.set(_width / 2, _height / 2);
    //   const scale = Math.min(_width / skeletonWidth, _height / skeletonHeight);
    //   this.spine.scale.set(scale);
  }
}
