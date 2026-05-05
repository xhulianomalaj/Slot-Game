import { action, computed, makeObservable, observable } from 'mobx';

export type SpeedMode = 'normal' | 'turbo' | 'superTurbo';
export type BootStage = 'session' | 'assets' | 'ready';
export type GraphicsQuality = 'high' | 'medium' | 'low';
export type MenuTab = 'paytable' | 'info' | 'settings' | 'autoplay' | 'bet' | 'history' | 'responsible' | 'help';
/** Reality-check interval in minutes; 0 = off. */
export type RealityCheckMinutes = 0 | 15 | 30 | 60;

const BETS = [0.2, 0.5, 1, 2, 5, 10, 25, 50, 100] as const;

export interface AutoplayConfig {
  rounds: number; // 10, 25, 50, 100, 250, 500, 0=∞
  stopOnAnyWin: boolean;
  stopOnFeature: boolean;
  stopIfSingleWinAbove: number | null;
  stopIfLossReaches: number | null;
  stopIfBalanceBelow: number | null;
  stopIfBalanceAbove: number | null;
}

const DEFAULT_AUTOPLAY: AutoplayConfig = {
  rounds: 10,
  stopOnAnyWin: false,
  stopOnFeature: true,
  stopIfSingleWinAbove: null,
  stopIfLossReaches: null,
  stopIfBalanceBelow: null,
  stopIfBalanceAbove: null,
};

export class UIStore {
  // Spin / flow
  spinEnabled = true;
  stopEnabled = false;
  spinning = false;
  speed: SpeedMode = 'normal';
  autospinRemaining = 0;

  // Audio
  soundEnabled = true;
  musicEnabled = true;
  ambientEnabled = true;
  sfxEnabled = true;
  sfxVolume = 0.8;
  ambientVolume = 0.5;

  // Gameplay prefs
  quickSpin = false;
  skipIntro = false;
  spaceToSpin = true;
  hapticsEnabled = true;
  graphics: GraphicsQuality = 'high';

  // Autoplay
  autoplay: AutoplayConfig = { ...DEFAULT_AUTOPLAY };

  // Responsible gaming
  realityCheck: RealityCheckMinutes = 0;
  sessionLimitMinutes: number | null = null;
  sessionLossLimit: number | null = null;

  // Menu state
  menuOpen = false;
  menuTab: MenuTab = 'paytable';
  rulesOpen = false;
  rulesTab = 'how-to-play';

  // Session-derived
  sessionStartedAt = Date.now();
  totalStaked = 0;
  totalWon = 0;
  roundsPlayed = 0;

  // Boot / infra
  loadProgress = 0;
  bootStage: BootStage = 'session';
  sessionId: string | null = null;
  currency = 'USD';
  language = 'en';
  loadError: string | null = null;
  /** True once the player has tapped past the splash. Game logic + audio
   * unlock should wait on this — browsers gate audio on a user gesture. */
  tappedToStart = false;

  constructor() {
    makeObservable(this, {
      spinEnabled: observable,
      stopEnabled: observable,
      spinning: observable,
      speed: observable,
      autospinRemaining: observable,
      soundEnabled: observable,
      musicEnabled: observable,
      ambientEnabled: observable,
      sfxEnabled: observable,
      sfxVolume: observable,
      ambientVolume: observable,
      quickSpin: observable,
      skipIntro: observable,
      spaceToSpin: observable,
      hapticsEnabled: observable,
      graphics: observable,
      autoplay: observable,
      realityCheck: observable,
      sessionLimitMinutes: observable,
      sessionLossLimit: observable,
      menuOpen: observable,
      menuTab: observable,
      rulesOpen: observable,
      rulesTab: observable,
      sessionStartedAt: observable,
      totalStaked: observable,
      totalWon: observable,
      roundsPlayed: observable,
      loadProgress: observable,
      bootStage: observable,
      sessionId: observable,
      currency: observable,
      language: observable,
      loadError: observable,
      tappedToStart: observable,
      isAutospinning: computed,
      net: computed,
      setSpinning: action,
      setSpeed: action,
      toggleSound: action,
      toggleMusic: action,
      toggleAmbient: action,
      toggleSfx: action,
      setSfxVolume: action,
      setAmbientVolume: action,
      toggleQuickSpin: action,
      toggleSkipIntro: action,
      toggleSpaceToSpin: action,
      toggleHaptics: action,
      setGraphics: action,
      updateAutoplay: action,
      setRealityCheck: action,
      setSessionLimit: action,
      setLossLimit: action,
      openMenu: action,
      closeMenu: action,
      setMenuTab: action,
      openRules: action,
      closeRules: action,
      setRulesTab: action,
      startAutospin: action,
      stopAutospin: action,
      tickAutospin: action,
      recordStake: action,
      recordWin: action,
      setLoadProgress: action,
      setBootStage: action,
      setSession: action,
      setLoadError: action,
      setLanguage: action,
      tapToStart: action,
    });
  }

  get isAutospinning(): boolean {
    return this.autospinRemaining > 0;
  }
  get net(): number {
    return this.totalWon - this.totalStaked;
  }

  setSpinning(s: boolean): void {
    this.spinning = s;
    this.spinEnabled = !s;
    this.stopEnabled = s;
  }
  setSpeed(speed: SpeedMode): void {
    this.speed = speed;
  }

  toggleSound(): void {
    this.soundEnabled = !this.soundEnabled;
  }
  toggleMusic(): void {
    this.musicEnabled = !this.musicEnabled;
  }
  toggleAmbient(): void {
    this.ambientEnabled = !this.ambientEnabled;
  }
  toggleSfx(): void {
    this.sfxEnabled = !this.sfxEnabled;
  }
  setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }
  setAmbientVolume(v: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, v));
  }
  toggleQuickSpin(): void {
    this.quickSpin = !this.quickSpin;
  }
  toggleSkipIntro(): void {
    this.skipIntro = !this.skipIntro;
  }
  toggleSpaceToSpin(): void {
    this.spaceToSpin = !this.spaceToSpin;
  }
  toggleHaptics(): void {
    this.hapticsEnabled = !this.hapticsEnabled;
  }
  setGraphics(q: GraphicsQuality): void {
    this.graphics = q;
  }

  updateAutoplay(patch: Partial<AutoplayConfig>): void {
    this.autoplay = { ...this.autoplay, ...patch };
  }

  setRealityCheck(m: RealityCheckMinutes): void {
    this.realityCheck = m;
  }
  setSessionLimit(m: number | null): void {
    this.sessionLimitMinutes = m;
  }
  setLossLimit(v: number | null): void {
    this.sessionLossLimit = v;
  }

  openMenu(tab?: MenuTab): void {
    this.menuOpen = true;
    if (tab) this.menuTab = tab;
  }
  closeMenu(): void {
    this.menuOpen = false;
  }
  setMenuTab(tab: MenuTab): void {
    this.menuTab = tab;
  }

  openRules(tab?: string): void {
    this.rulesOpen = true;
    if (tab) this.rulesTab = tab;
  }
  closeRules(): void {
    this.rulesOpen = false;
  }
  setRulesTab(tab: string): void {
    this.rulesTab = tab;
  }

  startAutospin(count: number): void {
    this.autospinRemaining = count;
  }
  stopAutospin(): void {
    this.autospinRemaining = 0;
  }
  tickAutospin(): void {
    if (this.autospinRemaining > 0) this.autospinRemaining -= 1;
  }

  recordStake(v: number): void {
    this.totalStaked += v;
    this.roundsPlayed += 1;
  }
  recordWin(v: number): void {
    this.totalWon += v;
  }

  setLoadProgress(p: number): void {
    this.loadProgress = Math.max(0, Math.min(1, p));
  }
  setBootStage(stage: BootStage): void {
    this.bootStage = stage;
    if (stage === 'ready') this.loadProgress = 1;
  }
  setSession(sessionId: string, currency: string): void {
    this.sessionId = sessionId;
    this.currency = currency;
  }
  setLoadError(msg: string | null): void {
    this.loadError = msg;
  }
  setLanguage(lang: string): void {
    this.language = lang;
  }
  tapToStart(): void {
    this.tappedToStart = true;
  }
}

export const AVAILABLE_BETS = BETS;
