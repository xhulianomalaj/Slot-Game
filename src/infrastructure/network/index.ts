// Network adapters — barrel export.
//
// Most consumers only need the type:
//   import type { NetworkManager } from '@/infrastructure/network';
//
// Composition (or a test) instantiates an adapter:
//   import { createNetwork, MockNetworkManager } from '@/infrastructure/network';

export { createNetwork } from './createNetwork';
export { HttpNetworkManager, type HttpNetworkOptions } from './HttpNetworkManager';
export { MockNetworkManager, type MockNetworkOptions } from './MockNetworkManager';
export { defineNetworkAdapter, type NetworkManager } from './types';
export { WebSocketNetworkManager, type WsNetworkOptions } from './WebSocketNetworkManager';
