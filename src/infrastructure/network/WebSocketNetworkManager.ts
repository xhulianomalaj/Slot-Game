// WebSocketNetworkManager — request/response over a single WS connection.
//
// Wire-protocol assumption (change to taste):
//
//   client → { id: string, type: 'session', payload: SessionRequest }
//   server → { id: string, type: 'session', payload: SessionResponse }
//   client → { id: string, type: 'spin',    payload: SpinRequest }
//   server → { id: string, type: 'spin',    payload: SpinResponse }
//
//   server may also push { type: 'error', id?, message } to reject in-flight
//   requests. Anything without a known `id` is logged and ignored.
//
// This is a starting point: replace with your protocol when you have one.
// The failure modes (reconnect, heartbeat, queueing) are intentionally
// minimal — add them when your server demands them.

import type { SessionRequest, SessionResponse, SpinRequest, SpinResponse } from '@/domain/types';
import type { NetworkManager } from './types';

export interface WsNetworkOptions {
  url: string;
  token?: string;
  /** Time to wait for the socket to open before failing. Default 8s. */
  openTimeoutMs?: number;
  /** Time to wait for a single request response. Default 15s. */
  requestTimeoutMs?: number;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof globalThis.setTimeout>;
}

export class WebSocketNetworkManager implements NetworkManager {
  private socket: WebSocket | null = null;
  private opening: Promise<WebSocket> | null = null;
  private pending = new Map<string, Pending>();
  private nextId = 1;

  constructor(private readonly opts: WsNetworkOptions) {
    if (!opts.url) throw new Error('[WebSocketNetworkManager] url is required');
  }

  session(req: SessionRequest): Promise<SessionResponse> {
    return this.request<SessionResponse>('session', req);
  }

  spin(req: SpinRequest): Promise<SpinResponse> {
    return this.request<SpinResponse>('spin', req);
  }

  dispose(): void {
    for (const [, p] of this.pending) {
      globalThis.clearTimeout(p.timer);
      p.reject(new Error('[WebSocketNetworkManager] disposed'));
    }
    this.pending.clear();
    this.socket?.close();
    this.socket = null;
    this.opening = null;
  }

  private async request<T>(type: 'session' | 'spin', payload: unknown): Promise<T> {
    const ws = await this.connect();
    const id = `${type}-${this.nextId++}`;
    return new Promise<T>((resolve, reject) => {
      const timer = globalThis.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`[WebSocketNetworkManager] ${type} timed out`));
      }, this.opts.requestTimeoutMs ?? 15000);
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });
      ws.send(JSON.stringify({ id, type, payload, token: this.opts.token }));
    });
  }

  private connect(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve(this.socket);
    if (this.opening) return this.opening;
    this.opening = new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(this.opts.url);
      const timer = globalThis.setTimeout(() => {
        ws.close();
        reject(new Error('[WebSocketNetworkManager] open timed out'));
      }, this.opts.openTimeoutMs ?? 8000);

      ws.addEventListener('open', () => {
        globalThis.clearTimeout(timer);
        this.socket = ws;
        resolve(ws);
      });
      ws.addEventListener('error', () => {
        globalThis.clearTimeout(timer);
        reject(new Error('[WebSocketNetworkManager] socket error'));
      });
      ws.addEventListener('close', () => {
        for (const [, p] of this.pending) {
          globalThis.clearTimeout(p.timer);
          p.reject(new Error('[WebSocketNetworkManager] socket closed'));
        }
        this.pending.clear();
        this.socket = null;
        this.opening = null;
      });
      ws.addEventListener('message', (ev) => {
        this.handleMessage(ev.data);
      });
    });
    return this.opening;
  }

  private handleMessage(raw: unknown): void {
    let parsed: { id?: string; type?: string; payload?: unknown; message?: string };
    try {
      parsed = JSON.parse(typeof raw === 'string' ? raw : '');
    } catch {
      console.warn('[WebSocketNetworkManager] non-JSON message ignored');
      return;
    }
    const id = parsed.id;
    if (!id) {
      console.warn('[WebSocketNetworkManager] message without id ignored', parsed);
      return;
    }
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    globalThis.clearTimeout(pending.timer);
    if (parsed.type === 'error') {
      pending.reject(new Error(`[WebSocketNetworkManager] server error: ${parsed.message ?? 'unknown'}`));
    } else {
      pending.resolve(parsed.payload);
    }
  }
}
