// SoundManager — thin Web Audio wrapper for game sound effects and music.
//
// Loads sounds eagerly on init() so playback is instantaneous.
// Volume and mute state are driven reactively from UIStore via MobX reactions.
//
// Volume routing:
//   SFX  → sfxGain  (ui.sfxVolume)   → masterGain (0 when muted) → destination
//   Music → musicGain (ui.ambientVolume) → masterGain              → destination

import { reaction } from 'mobx';
import type { UIStore } from '@/state/UIStore';

export type SoundId = 'spinning' | 'win' | 'stop' | 'click' | 'background';

const SOUND_PATHS: Record<SoundId, string> = {
  spinning:   '/assets/audio/spinning.wav',
  win:        '/assets/audio/win.wav',
  stop:       '/assets/audio/stopSound.wav',
  click:      '/assets/audio/click.wav',
  background: '/assets/audio/background.mp3',
};

const MUSIC_IDS = new Set<SoundId>(['background']);

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers = new Map<SoundId, AudioBuffer>();
  private activeSources = new Map<SoundId, AudioBufferSourceNode>();
  private ready = false;
  private disposeReactions: (() => void) | null = null;

  constructor(private readonly ui: UIStore) {}

  /** Called on the first pointer-down anywhere in the window to un-suspend the AudioContext. */
  private readonly onFirstInteraction = (): void => {
    this.ctx?.resume().catch(() => undefined);
  };

  async init(): Promise<void> {
    this.ctx = new AudioContext();

    // Master gain — toggled to 0 on mute, 1 when on.
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.ui.soundEnabled ? 1 : 0;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.ui.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.ui.ambientVolume;
    this.musicGain.connect(this.masterGain);

    await Promise.all(
      (Object.entries(SOUND_PATHS) as [SoundId, string][]).map(([id, path]) =>
        this.loadBuffer(id, path),
      ),
    );
    this.ready = true;

    // Un-suspend the AudioContext on the first user interaction anywhere in the window.
    // The browser freezes AudioContext created with no user gesture; resume() unlocks it so
    // the background music (already started above) actually begins playing.
    if (this.ctx.state === 'suspended') {
      window.addEventListener('pointerdown', this.onFirstInteraction, { once: true });
    }

    // Keep gain nodes in sync with store changes.
    const r1 = reaction(
      () => this.ui.soundEnabled,
      (on) => { if (this.masterGain) this.masterGain.gain.value = on ? 1 : 0; },
    );
    const r2 = reaction(
      () => this.ui.sfxVolume,
      (v) => { if (this.sfxGain) this.sfxGain.gain.value = v; },
    );
    const r3 = reaction(
      () => this.ui.ambientVolume,
      (v) => { if (this.musicGain) this.musicGain.gain.value = v; },
    );
    this.disposeReactions = () => { r1(); r2(); r3(); };
  }

  /** Start looping background music. Call once after init(). */
  startMusic(): void {
    this.play('background', { loop: true });
  }

  private async loadBuffer(id: SoundId, path: string): Promise<void> {
    if (!this.ctx) return;
    try {
      const res = await fetch(path);
      const raw = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(raw);
      this.buffers.set(id, buf);
    } catch (err) {
      console.warn(`[SoundManager] failed to load ${id}:`, err);
    }
  }

  play(id: SoundId, { loop = false } = {}): void {
    if (!this.ready || !this.ctx) return;
    const buf = this.buffers.get(id);
    if (!buf) return;

    // Stop any previous instance of the same sound.
    this.stop(id);

    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    source.loop = loop;
    const gain = MUSIC_IDS.has(id) ? this.musicGain! : this.sfxGain!;
    source.connect(gain);
    source.start();
    source.onended = () => {
      if (this.activeSources.get(id) === source) this.activeSources.delete(id);
    };
    this.activeSources.set(id, source);
  }

  stop(id: SoundId): void {
    const source = this.activeSources.get(id);
    if (source) {
      try { source.stop(); } catch { /* already stopped */ }
      this.activeSources.delete(id);
    }
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.onFirstInteraction);
    this.disposeReactions?.();
    this.disposeReactions = null;
    for (const id of this.activeSources.keys()) this.stop(id);
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.ready = false;
  }
}

