// Typed DI tokens — replaces stringly-typed container keys.
//
// A `Token<T>` is a `Symbol` tagged at the type level with the service
// type. `container.get(Tokens.Network)` infers `NetworkManager` directly,
// so misspelled keys turn into compile errors instead of runtime errors.
//
// To add a new service:
//   1. Append it to the Tokens object below with the right type parameter.
//   2. `container.register(Tokens.MyThing, () => new MyThing())` in composition.
//   3. `container.get(Tokens.MyThing)` anywhere downstream.

import type { Analytics } from '@/infrastructure/Analytics';
import type { AssetLoader } from '@/infrastructure/AssetLoader';
import type { NetworkManager } from '@/infrastructure/network';
import type { Ticker } from '@/infrastructure/timing';
import type { BackgroundPresenter } from '@/presenters/BackgroundPresenter';
import type { RootStore } from '@/state/RootStore';
import type { MainScene } from '@/view/scenes/MainScene';

declare const __token: unique symbol;
export type Token<T> = symbol & { [__token]?: T };

function token<T>(label: string): Token<T> {
  return Symbol(label) as Token<T>;
}

export const Tokens = {
  Stores: token<RootStore>('stores'),
  Ticker: token<Ticker>('ticker'),
  Network: token<NetworkManager>('network'),
  Analytics: token<Analytics>('analytics'),
  Assets: token<AssetLoader>('assets'),
  Scene: token<MainScene>('scene'),
  Background: token<BackgroundPresenter>('background'),
} as const;
