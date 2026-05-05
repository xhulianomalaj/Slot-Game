// HttpNetworkManager — minimal REST adapter.
//
// Wire-protocol assumption (change to taste):
//   POST {baseUrl}/session   body: SessionRequest   -> SessionResponse
//   POST {baseUrl}/spin      body: SpinRequest      -> SpinResponse
//
// Auth is forwarded as Authorization: Bearer <token> when supplied.
// All non-2xx responses throw. Network errors throw. No silent failures —
// the loader surfaces them in the boot UI.

import type { SessionRequest, SessionResponse, SpinRequest, SpinResponse } from '@/domain/types';
import type { NetworkManager } from './types';

export interface HttpNetworkOptions {
  /** Base URL of your RGS HTTP API (no trailing slash). */
  baseUrl: string;
  /** Optional bearer token from the lobby. */
  token?: string;
  /** Override fetch — useful for tests. Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Request timeout in ms. Defaults to 15s. */
  timeoutMs?: number;
}

export class HttpNetworkManager implements NetworkManager {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(opts: HttpNetworkOptions) {
    if (!opts.baseUrl) throw new Error('[HttpNetworkManager] baseUrl is required');
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.token = opts.token;
    this.fetchFn = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? 15000;
  }

  session(req: SessionRequest): Promise<SessionResponse> {
    return this.post<SessionResponse>('/session', req);
  }

  spin(req: SpinRequest): Promise<SpinResponse> {
    return this.post<SpinResponse>('/spin', req);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const ctrl = new AbortController();
    const timer = globalThis.setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (this.token) headers.authorization = `Bearer ${this.token}`;

      const res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`[HttpNetworkManager] ${path} ${res.status}: ${text || res.statusText}`);
      }
      return (await res.json()) as T;
    } finally {
      globalThis.clearTimeout(timer);
    }
  }
}
