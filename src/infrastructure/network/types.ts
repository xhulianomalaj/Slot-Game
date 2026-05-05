// NetworkManager — the single seam between the client and your server.
//
// Implement this interface to plug slotplate into any backend. Three
// reference adapters ship with the template:
//
//   - MockNetworkManager  — offline fake server (dev / asset previews)
//   - HttpNetworkManager  — POST /session and /spin against a REST endpoint
//   - WebSocketNetworkManager — request/response over a single WS
//
// The contract is intentionally tiny: open a session, then send spins and
// render whatever comes back. The server is authoritative on every number
// the player sees — the client never evaluates wins, never knows the
// paytable, never simulates math.

import type { SessionRequest, SessionResponse, SpinRequest, SpinResponse } from '@/domain/types';

export interface NetworkManager {
  /** Opens a session with the server. Called once on boot. Authoritative on balance. */
  session(req: SessionRequest): Promise<SessionResponse>;
  /** Sends a spin and resolves with the resolved round (grid, winlines, balance). */
  spin(req: SpinRequest): Promise<SpinResponse>;
  /** Optional teardown — close sockets, flush buffers, etc. */
  dispose?(): void;
}

/**
 * Type helper for authoring custom adapters. Use it when you want the
 * inferred return type to be exactly `NetworkManager` without restating
 * the interface:
 *
 * ```ts
 * export const createMyAdapter = defineNetworkAdapter((opts: { url: string }) => ({
 *   async session(req) { ... },
 *   async spin(req)    { ... },
 * }));
 * ```
 */
export function defineNetworkAdapter<Opts>(factory: (opts: Opts) => NetworkManager): (opts: Opts) => NetworkManager {
  return factory;
}
