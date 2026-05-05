// SymbolAnimationPlayer — optional companion for SpineReelSymbol.
// Mirrors the bonbon-hw pattern: animation selection is data, not class logic.
//
// Each SymbolAnimation ('idle'|'landing'|'win'|'bigwin') maps to a list of
// track names that get played in parallel on the Spine skeleton. That way
// shared animations (size pulses, glow) live alongside symbol-specific ones.

import type { SymbolAnimationPlayer as IPlayer, SpineAnimationName } from './SpineReelSymbol';

export interface SymbolAnimations {
  idle: Record<string, string[]>; // symbolId → [trackA, trackB, ...]
  landing: Record<string, string[]>;
  win: Record<string, string[]>;
  bigwin: Record<string, string[]>;
  size: Record<string, string[]>; // always-on scale control
}

// Stub implementation — plug in Spine refs when the peer dep is installed.
// The bonbon-hw SymbolAnimationPlayer is a good reference for the full wiring.
export class NoopAnimationPlayer implements IPlayer {
  play(animation: { name: SpineAnimationName; loop: boolean; onComplete?: () => void }): void {
    animation.onComplete?.();
  }

  stop(): void {}
  clear(): void {}
}
