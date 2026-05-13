import type { NetworkManager } from '@/infrastructure/NetworkManager';
import type { SoundManager } from '@/infrastructure/SoundManager';
import type { Ticker } from '@/infrastructure/timing';
import type { ReelsPresenter } from '@/presenters/ReelsPresenter';
import type { RootStore } from '@/state/RootStore';
import type { FSM } from './fsm';

export interface PhaseContext {
  fsm: FSM;
  stores: RootStore;
  ticker: Ticker;
  network: NetworkManager;
  reels: ReelsPresenter;
  sound: SoundManager;
}

export interface Phase {
  readonly name: string;
  enter(ctx: PhaseContext): void | Promise<void>;
  skip?(ctx: PhaseContext): void;
  exit?(ctx: PhaseContext): void;
}
