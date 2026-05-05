// Audio bridge helper — for projects that ship an audio engine.
//
// Slotplate's template doesn't bundle an audio engine yet. When you add
// one (Howler, Tone, Web Audio direct, …), call `notifyAudioCue(name)`
// every time a SFX fires. The TestBridge captures the cue, and tests
// assert against `slot.audioLog()`.
//
// Wire-up (single line in your audio engine):
//
//     import { notifyAudioCue } from '@/testing/audioBridge';
//
//     play(name: string, opts?: { volume?: number }) {
//       this.howl.play(name);
//       notifyAudioCue(name, { volume: opts?.volume });
//     }
//
// Then in a spec:
//
//     await slot.spin();
//     expect(await slot.audioLog()).toContainEqual(
//       expect.objectContaining({ name: 'win-show' }),
//     );
//
// The function is a no-op when test mode is off, so it's safe to leave
// in production code.

import { TEST_BRIDGE_GLOBAL } from './index';
import type { TestBridge } from './TestBridge';

export function notifyAudioCue(name: string, meta?: Record<string, unknown>): void {
  if (typeof globalThis === 'undefined') return;
  const bridge = (globalThis as Record<string, unknown>)[TEST_BRIDGE_GLOBAL] as TestBridge | undefined;
  bridge?.recordAudio(name, meta);
}
