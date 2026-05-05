// InspectorChannel — same-origin RPC between the game tab and a popped-out
// inspector window, over the browser's BroadcastChannel API.
//
// The game tab (the one running the actual app + TestBridge) is the
// "server": it listens for command messages and broadcasts state updates
// at a fixed cadence. The popped-out tab is the "client": it sends
// commands and renders state.
//
// No infra required — BroadcastChannel works across same-origin tabs in
// every modern browser. There's no shared bundle either; the popout page
// is a static HTML file (`public/__inspector.html`) that talks the same
// protocol.
//
// Wire format (all messages JSON-cloneable):
//
//   client → server  { type: 'hello' }                          // first connect
//   client → server  { type: 'cmd', id, method, args }          // RPC call
//   client → server  { type: 'goodbye' }                        // before unload
//
//   server → client  { type: 'ack', testId, version }           // hello reply
//   server → client  { type: 'state', testId, dump, t }         // 5Hz heartbeat
//   server → client  { type: 'reply', id, result | error }      // RPC reply
//
// Method names are the public TestBridge methods that return JSON-safe
// values (or `Promise<JSON-safe>`). Commands that throw bubble back as
// `error: string` so the popout can show a toast.

import type { TestBridge } from './TestBridge';

export const INSPECTOR_CHANNEL = 'slotplate-inspector';
export const INSPECTOR_PROTOCOL_VERSION = 1;

/** Whitelist of TestBridge methods the popout can call. Keeps the surface
 *  intentional — no foot-guns from accidentally exposing internal helpers. */
const ALLOWED_METHODS = new Set<keyof TestBridge>([
  'state',
  'networkHistory',
  'fsmTransitions',
  'grid',
  'pixiLabels',
  'pixiBounds',
  'a11yTree',
  'dumpAll',
  'queueSpin',
  'queueWin',
  'queueLoss',
  'queueError',
  'simulateOffline',
  'simulateOnline',
  'resetNetwork',
  'spin',
  'startSpin',
  'skipPhase',
  'recoverFromError',
  'setBet',
  'tapToStart',
  'startAutospin',
  'stopAutospin',
  'toggleSound',
  'setLanguage',
  'openMenu',
  'closeMenu',
  'simulateLowBalance',
  'replay',
  'pauseTicker',
  'resumeTicker',
  'tickFrames',
  'clickPixi',
  // Recorder
  'startRecording',
  'stopRecording',
  'isRecording',
  'getRecording',
  'formatAsSpec',
  // Audio + visuals
  'recordAudio',
  'audioLog',
  'clearAudioLog',
  'snapshotCanvas',
] as const);

interface CmdMessage {
  type: 'cmd';
  id: string;
  method: string;
  args: unknown[];
}
interface HelloMessage {
  type: 'hello';
}
interface GoodbyeMessage {
  type: 'goodbye';
}
type ClientMessage = CmdMessage | HelloMessage | GoodbyeMessage;

export class InspectorChannel {
  private readonly channel: BroadcastChannel;
  // setInterval returns `number` in browsers, `Timeout` in node typings —
  // type this loosely so TS doesn't pick the wrong overload.
  private heartbeat: ReturnType<typeof globalThis.setInterval> | null = null;
  private remoteCount = 0;
  private listeners = new Set<() => void>();

  constructor(private readonly bridge: TestBridge) {
    this.channel = new BroadcastChannel(INSPECTOR_CHANNEL);
    this.channel.addEventListener('message', this.onMessage);
    // 5Hz state heartbeat — cheap (a JSON snapshot) and keeps the popout
    // responsive without requiring it to poll.
    this.heartbeat = globalThis.setInterval(() => {
      if (this.remoteCount > 0) this.broadcastState();
    }, 200);
  }

  /** True when at least one remote inspector tab is connected. */
  get hasRemote(): boolean {
    return this.remoteCount > 0;
  }

  /** Subscribe to remote-connected/disconnected events. */
  onRemoteChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  dispose(): void {
    this.channel.removeEventListener('message', this.onMessage);
    this.channel.close();
    if (this.heartbeat != null) globalThis.clearInterval(this.heartbeat);
    this.listeners.clear();
  }

  private onMessage = (e: MessageEvent<ClientMessage>): void => {
    const msg = e.data;
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
    switch (msg.type) {
      case 'hello':
        this.remoteCount += 1;
        this.notify();
        this.channel.postMessage({
          type: 'ack',
          testId: this.bridge.testId,
          version: INSPECTOR_PROTOCOL_VERSION,
        });
        // Send an immediate state snapshot so the popout can render at once.
        this.broadcastState();
        break;
      case 'goodbye':
        this.remoteCount = Math.max(0, this.remoteCount - 1);
        this.notify();
        break;
      case 'cmd':
        void this.handleCommand(msg);
        break;
    }
  };

  private async handleCommand(msg: CmdMessage): Promise<void> {
    try {
      if (!ALLOWED_METHODS.has(msg.method as keyof TestBridge)) {
        throw new Error(`method not allowed: ${msg.method}`);
      }
      const fn = (this.bridge as unknown as Record<string, (...a: unknown[]) => unknown>)[msg.method];
      if (typeof fn !== 'function') throw new Error(`unknown method: ${msg.method}`);
      const result = await fn.apply(this.bridge, msg.args);
      this.channel.postMessage({ type: 'reply', id: msg.id, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.channel.postMessage({ type: 'reply', id: msg.id, error: message });
    }
  }

  private broadcastState(): void {
    try {
      this.channel.postMessage({
        type: 'state',
        testId: this.bridge.testId,
        dump: this.bridge.dumpAll(),
        t: Date.now(),
      });
    } catch {
      /* heartbeat best-effort — don't crash on transient serialization issues */
    }
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}
