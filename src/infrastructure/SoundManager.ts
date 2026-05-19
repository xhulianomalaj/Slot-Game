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
  /** True when we explicitly suspended the context on tab hide. */
  private suspendedByVisibility = false;
  /** True when we explicitly suspended the context because the menu opened on mobile. */
  private suspendedByMenu = false;

  constructor(private readonly ui: UIStore) {}

  /** Called on the first touch/pointer anywhere in the window to un-suspend the AudioContext.
   *  Registered for both touchstart and pointerdown because mobile Chrome requires touchstart
   *  to count as a qualifying user gesture for AudioContext.resume(). */
  private readonly onFirstInteraction = (): void => {
    // Remove both event types — we only need this once.
    window.removeEventListener('touchstart', this.onFirstInteraction);
    window.removeEventListener('pointerdown', this.onFirstInteraction);
    this.ctx?.resume().catch(() => undefined);
  };

  /** Suspend audio when the tab is hidden; resume when it becomes visible again. */
  private readonly onVisibilityChange = (): void => {
    if (!this.ctx || !this.masterGain) return;
    if (document.hidden) {
      this.suspendedByVisibility = true;
      // Set gain to 0 immediately — ctx.suspend() is async and on some Android
      // Chrome builds it doesn't silence fast enough before the OS hands focus
      // to the home screen, so the music audibly leaks through.
      this.masterGain.gain.value = 0;
      this.ctx.suspend().catch(() => undefined);
    } else if (this.suspendedByVisibility) {
      // Only resume if we were the ones who suspended — avoids accidentally
      // un-blocking a context that was never unlocked by a user gesture.
      this.suspendedByVisibility = false;
      this.ctx.resume().catch(() => undefined);
      this.masterGain.gain.value = this.ui.soundEnabled ? 1 : 0;
    }
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
      // touchstart is the event mobile Chrome treats as a qualifying user gesture;
      // pointerdown covers desktop and some mobile scenarios.
      window.addEventListener('touchstart', this.onFirstInteraction);
      window.addEventListener('pointerdown', this.onFirstInteraction);
    }

    // Pause / resume audio automatically when the player switches tabs.
    document.addEventListener('visibilitychange', this.onVisibilityChange);

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

  /** Pause audio when the mobile menu opens. Mirrors onVisibilityChange. */
  suspendForMenu(): void {
    if (!this.ctx || !this.masterGain) return;
    this.suspendedByMenu = true;
    this.masterGain.gain.value = 0;
    this.ctx.suspend().catch(() => undefined);
  }

  /** Resume audio when the mobile menu closes. */
  resumeFromMenu(): void {
    if (!this.ctx || !this.masterGain || !this.suspendedByMenu) return;
    this.suspendedByMenu = false;
    this.ctx.resume().catch(() => undefined);
    this.masterGain.gain.value = this.ui.soundEnabled ? 1 : 0;
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
    window.removeEventListener('touchstart', this.onFirstInteraction);
    window.removeEventListener('pointerdown', this.onFirstInteraction);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.disposeReactions?.();
    this.disposeReactions = null;
    for (const id of this.activeSources.keys()) this.stop(id);
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.ready = false;
  }
}

