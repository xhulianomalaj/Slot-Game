// InspectorOverlay — a live diagnostics panel mounted on top of the running
// game when test mode is on. Lets QA poke at every test-bridge method
// without writing a single line of code:
//
//   - watch the FSM phase, balance, win counter, queued spins, pending net
//   - queue a loss / win / error / offline drop with one click
//   - run a spin, autospin, recover, reset wallet
//   - copy the full bridge dump as JSON for bug reports
//   - see the Pixi a11y tree (every labeled node + bounds)
//   - dock to a corner, collapse, hide entirely with Esc
//
// Mounted only when `?test=<id>` is on the URL — production never builds it.
//
// All interactions go through the same TestBridge a Playwright spec uses,
// so what works in the inspector works in a script. This is the QA's
// playground AND the developer's repro tool.

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { InspectorChannel } from './InspectorChannel';
import type { TestBridge } from './TestBridge';

const STORAGE_KEY = '__slotplate_inspector__';

interface SavedPrefs {
  collapsed: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  hidden: boolean;
}

const DEFAULT_PREFS: SavedPrefs = { collapsed: false, position: 'top-right', hidden: false };

function loadPrefs(): SavedPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(p: SavedPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota / privacy mode */
  }
}

const NEUTRAL_GRID: string[][] = [
  ['cherry', 'lemon', 'orange'],
  ['lemon', 'orange', 'plum'],
  ['orange', 'plum', 'bell'],
  ['plum', 'bell', 'bar'],
  ['bell', 'bar', 'cherry'],
];
const SEVENS_GRID: string[][] = [
  ['seven', 'seven', 'seven'],
  ['seven', 'seven', 'seven'],
  ['seven', 'seven', 'seven'],
  ['seven', 'seven', 'seven'],
  ['seven', 'seven', 'seven'],
];

function Inspector({
  bridge,
  channel,
}: {
  bridge: TestBridge;
  channel: InspectorChannel | null;
}): preact.JSX.Element | null {
  const [prefs, setPrefs] = useState<SavedPrefs>(() => loadPrefs());
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<'state' | 'queue' | 'a11y' | 'history' | 'transitions' | 'rec' | 'snap'>('state');
  const [toast, setToast] = useState<string | null>(null);
  const [hasRemote, setHasRemote] = useState<boolean>(channel?.hasRemote ?? false);

  // Refresh state at 5Hz — cheap; only rendered while inspector visible.
  useEffect(() => {
    if (prefs.hidden) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 200);
    return () => window.clearInterval(t);
  }, [prefs.hidden]);

  // Track popped-out inspector tabs so we can dim ourselves and avoid
  // two competing UIs driving the bridge.
  useEffect(() => {
    if (!channel) return;
    setHasRemote(channel.hasRemote);
    return channel.onRemoteChange(() => setHasRemote(channel.hasRemote));
  }, [channel]);

  // `Esc` toggles full hide; `Alt+i` shows it again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !prefs.hidden) update({ hidden: true });
      if (e.altKey && e.key.toLowerCase() === 'i') update({ hidden: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function update(patch: Partial<SavedPrefs>): void {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  }

  function notify(msg: string): void {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  if (prefs.hidden) {
    return (
      <button
        type="button"
        class="sp-inspector__pin"
        onClick={() => update({ hidden: false })}
        aria-label="Show test inspector"
        title="Show test inspector (Alt+I)"
      >
        🧪
      </button>
    );
  }

  const state = bridge.state();
  const dump = () => bridge.dumpAll();

  // We re-read these inside render so they reflect the latest tick.
  void tick;

  return (
    <div class={`sp-inspector sp-inspector--${prefs.position}${prefs.collapsed ? ' is-collapsed' : ''}`}>
      <header class="sp-inspector__head">
        <span class="sp-inspector__title">
          🧪 Inspector
          {bridge.testId ? <span class="sp-inspector__id">{bridge.testId}</span> : null}
          {hasRemote ? (
            <span
              class="sp-inspector__id sp-inspector__id--remote"
              title="Popped out — close the popout window to take control here"
            >
              popout
            </span>
          ) : null}
          {bridge.usesStubs ? (
            <span
              class="sp-inspector__id"
              title="Headless stubs — empty reels, instant ticker. Add &stubs=0 to see the real engine."
            >
              stubs
            </span>
          ) : (
            <span
              class="sp-inspector__id"
              title="Real Pixi engine + GSAP ticker. Add &stubs=1 to switch to headless stubs."
            >
              live
            </span>
          )}
        </span>
        <span class="sp-inspector__spacer" />
        <button
          type="button"
          class="sp-inspector__icon"
          title="Open inspector in a new tab"
          onClick={() => {
            const id = bridge.testId ?? '1';
            // Carry the test id so the popout's own bridge sanity-check can
            // verify it's looking at the right page. `inspector=remote` keeps
            // the popout from also building the game.
            window.open(
              `/__inspector.html?test=${encodeURIComponent(id)}`,
              'slotplate-inspector',
              'width=420,height=720',
            );
          }}
        >
          ↗
        </button>
        <button
          type="button"
          class="sp-inspector__icon"
          title="Cycle position"
          onClick={() => {
            const order: SavedPrefs['position'][] = ['top-right', 'top-left', 'bottom-left', 'bottom-right'];
            const next = order[(order.indexOf(prefs.position) + 1) % order.length] ?? 'top-right';
            update({ position: next });
          }}
        >
          ↺
        </button>
        <button
          type="button"
          class="sp-inspector__icon"
          title={prefs.collapsed ? 'Expand' : 'Collapse'}
          onClick={() => update({ collapsed: !prefs.collapsed })}
        >
          {prefs.collapsed ? '▾' : '▴'}
        </button>
        <button type="button" class="sp-inspector__icon" title="Hide (Esc)" onClick={() => update({ hidden: true })}>
          ✕
        </button>
      </header>

      {!prefs.collapsed && (
        <>
          <nav class="sp-inspector__tabs">
            {(['state', 'queue', 'a11y', 'history', 'transitions', 'rec', 'snap'] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                class={`sp-inspector__tab${tab === id ? ' is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                {id}
              </button>
            ))}
          </nav>

          <div class="sp-inspector__body" role="tabpanel">
            {tab === 'state' && (
              <table class="sp-inspector__table">
                <tbody>
                  {Object.entries(state).map(([k, v]) => (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'queue' && (
              <div class="sp-inspector__actions">
                <button
                  type="button"
                  onClick={() => {
                    bridge.queueLoss(NEUTRAL_GRID);
                    notify('queued: loss');
                  }}
                >
                  queue loss
                </button>
                <button
                  type="button"
                  onClick={() => {
                    bridge.queueWin(SEVENS_GRID, 50);
                    notify('queued: win 50');
                  }}
                >
                  queue win 50
                </button>
                <button
                  type="button"
                  onClick={() => {
                    bridge.queueWin(SEVENS_GRID, 250);
                    notify('queued: big win 250');
                  }}
                >
                  queue big win 250
                </button>
                <button
                  type="button"
                  onClick={() => {
                    bridge.queueError('inspector triggered error');
                    notify('queued: error');
                  }}
                >
                  queue error
                </button>
                <hr />
                <button
                  type="button"
                  onClick={() => {
                    void bridge.spin();
                    notify('spinning…');
                  }}
                >
                  spin once
                </button>
                <button
                  type="button"
                  onClick={() => {
                    bridge.startAutospin(10);
                    notify('autospin 10');
                  }}
                >
                  autospin x10
                </button>
                <button
                  type="button"
                  onClick={() => {
                    bridge.stopAutospin();
                    notify('autospin stopped');
                  }}
                >
                  stop autospin
                </button>
                <hr />
                <button
                  type="button"
                  onClick={() => {
                    bridge.simulateOffline();
                    notify('offline');
                  }}
                >
                  offline
                </button>
                <button
                  type="button"
                  onClick={() => {
                    bridge.simulateOnline();
                    notify('online');
                  }}
                >
                  online
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void bridge.recoverFromError();
                    notify('recovered');
                  }}
                >
                  recover
                </button>
                <hr />
                <button
                  type="button"
                  onClick={() => {
                    bridge.simulateLowBalance(0);
                    notify('balance set to 0');
                  }}
                >
                  simulate $0 wallet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    bridge.resetNetwork(100);
                    notify('reset to $100');
                  }}
                >
                  reset wallet $100
                </button>
                <button
                  type="button"
                  onClick={() => {
                    bridge.toggleSound();
                    notify(`sound ${state.soundEnabled ? 'off' : 'on'}`);
                  }}
                >
                  toggle sound
                </button>
                <hr />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(dump(), null, 2));
                      notify('bridge dump copied');
                    } catch {
                      notify('clipboard blocked — see console');
                      console.log('[inspector] dump:', dump());
                    }
                  }}
                >
                  copy bridge dump → clipboard
                </button>
              </div>
            )}

            {tab === 'a11y' && (
              <table class="sp-inspector__table">
                <thead>
                  <tr>
                    <th>label</th>
                    <th>x</th>
                    <th>y</th>
                    <th>w</th>
                    <th>h</th>
                    <th>visible</th>
                  </tr>
                </thead>
                <tbody>
                  {bridge.a11yTree().map((n) => (
                    <tr key={`${n.label}@${n.x},${n.y}`}>
                      <td>
                        <button
                          type="button"
                          class="sp-inspector__link"
                          onClick={() => {
                            try {
                              bridge.clickPixi(n.label);
                              notify(`clicked ${n.label}`);
                            } catch (e) {
                              notify(String(e));
                            }
                          }}
                        >
                          {n.label}
                        </button>
                      </td>
                      <td>{Math.round(n.x)}</td>
                      <td>{Math.round(n.y)}</td>
                      <td>{Math.round(n.width)}</td>
                      <td>{Math.round(n.height)}</td>
                      <td>{n.visible ? '✓' : '·'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'history' && (
              <div class="sp-inspector__list">
                {bridge
                  .networkHistory()
                  .slice(-12)
                  .reverse()
                  .map((h, i) => (
                    <div key={i} class={`sp-inspector__row sp-inspector__row--${h.outcome}`}>
                      <span class="sp-inspector__pill">{h.kind}</span>
                      <span class="sp-inspector__pill">{h.outcome}</span>
                      {h.kind === 'spin' ? (
                        <span>
                          bet={(h.request as { bet?: number }).bet ?? '?'} win=
                          {String((h.response as { totalWin?: number } | undefined)?.totalWin ?? '?')}
                        </span>
                      ) : null}
                      {h.error ? <span class="sp-inspector__err">{h.error.message}</span> : null}
                    </div>
                  ))}
              </div>
            )}

            {tab === 'transitions' && (
              <div class="sp-inspector__list">
                {bridge
                  .fsmTransitions()
                  .slice(-20)
                  .reverse()
                  .map((t, i) => (
                    <div key={i} class="sp-inspector__row">
                      <span class="sp-inspector__pill">{t.to}</span>
                      <span>{t.at}ms</span>
                      {t.prevDurationMs !== null ? (
                        <span class="sp-inspector__muted">+{t.prevDurationMs}ms</span>
                      ) : null}
                    </div>
                  ))}
              </div>
            )}

            {tab === 'rec' && <RecorderPanel bridge={bridge} notify={notify} />}
            {tab === 'snap' && <SnapshotPanel bridge={bridge} notify={notify} />}
          </div>
        </>
      )}

      {toast ? (
        <div class="sp-inspector__toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function RecorderPanel({ bridge, notify }: { bridge: TestBridge; notify: (m: string) => void }): preact.JSX.Element {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, []);

  const recording = bridge.isRecording();
  const buffer = bridge.getRecording();

  async function copySpec(): Promise<void> {
    const spec = bridge.formatAsSpec(`recorded ${new Date().toLocaleTimeString()}`);
    try {
      await navigator.clipboard.writeText(spec);
      notify('spec copied — paste into a .spec.ts');
    } catch {
      notify('clipboard blocked — see console');
      console.log(`[inspector] spec:\n${spec}`);
    }
  }

  return (
    <div class="sp-inspector__rec">
      <div class="sp-inspector__actions">
        {!recording ? (
          <button
            type="button"
            onClick={() => {
              bridge.startRecording();
              notify('recording…');
            }}
          >
            ● start recording
          </button>
        ) : (
          <button
            type="button"
            class="sp-inspector__btn--danger"
            onClick={() => {
              bridge.stopRecording();
              notify(`stopped — ${buffer.length} actions`);
            }}
          >
            ⏹ stop recording
          </button>
        )}
        <button type="button" disabled={buffer.length === 0} onClick={copySpec}>
          copy as .spec.ts → clipboard
        </button>
      </div>
      <hr />
      {buffer.length === 0 ? (
        <div class="sp-inspector__muted" style={{ padding: '8px 0' }}>
          {recording
            ? 'No actions yet — click queue / spin / a11y buttons.'
            : 'Press ● to start. Every queue/spin/click is captured.'}
        </div>
      ) : (
        <table class="sp-inspector__table">
          <thead>
            <tr>
              <th>t</th>
              <th>method</th>
              <th>args</th>
            </tr>
          </thead>
          <tbody>
            {buffer.slice(-30).map((a, i) => (
              <tr key={i}>
                <td class="sp-inspector__muted">+{a.t}ms</td>
                <td>{a.method}</td>
                <td class="sp-inspector__muted">{previewArgs(a.args)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function previewArgs(args: unknown[]): string {
  if (args.length === 0) return '';
  const s = JSON.stringify(args);
  return s.length > 40 ? `${s.slice(0, 37)}…` : s;
}

const SNAP_STORAGE_KEY = '__slotplate_snapshots__';
interface SavedSnap {
  id: string;
  testId: string | null;
  takenAt: number;
  dataUrl: string;
  label: string;
}

function loadSnaps(): SavedSnap[] {
  try {
    return JSON.parse(localStorage.getItem(SNAP_STORAGE_KEY) ?? '[]') as SavedSnap[];
  } catch {
    return [];
  }
}
function saveSnaps(s: SavedSnap[]): void {
  // Keep at most 10 — PNG dataURLs are big, and localStorage is small.
  try {
    localStorage.setItem(SNAP_STORAGE_KEY, JSON.stringify(s.slice(-10)));
  } catch {
    /* quota */
  }
}

function SnapshotPanel({ bridge, notify }: { bridge: TestBridge; notify: (m: string) => void }): preact.JSX.Element {
  const [snaps, setSnaps] = useState<SavedSnap[]>(() => loadSnaps());

  function take(): void {
    const dataUrl = bridge.snapshotCanvas();
    if (!dataUrl) {
      notify('canvas not ready or tainted');
      return;
    }
    const next: SavedSnap[] = [
      ...snaps,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        testId: bridge.testId,
        takenAt: Date.now(),
        dataUrl,
        label: bridge.state().phase ?? 'unknown',
      },
    ].slice(-10);
    setSnaps(next);
    saveSnaps(next);
    notify('snapshot saved');
  }

  function clear(): void {
    setSnaps([]);
    saveSnaps([]);
    notify('snapshots cleared');
  }

  return (
    <div>
      <div class="sp-inspector__actions">
        <button type="button" onClick={take}>
          📸 capture canvas
        </button>
        <button type="button" disabled={snaps.length === 0} onClick={clear}>
          clear all
        </button>
      </div>
      <hr />
      {snaps.length === 0 ? (
        <div class="sp-inspector__muted" style={{ padding: '8px 0' }}>
          Captures stored in localStorage (up to 10). Useful for "did this look right after the spin?" triage.
        </div>
      ) : (
        <div class="sp-inspector__snaps">
          {snaps
            .slice()
            .reverse()
            .map((s) => (
              <a
                key={s.id}
                class="sp-inspector__snap"
                href={s.dataUrl}
                target="_blank"
                rel="noopener"
                title={`${s.label} · ${new Date(s.takenAt).toLocaleTimeString()}`}
              >
                <img src={s.dataUrl} alt="" />
                <span class="sp-inspector__snap-tag">{s.label}</span>
              </a>
            ))}
        </div>
      )}
    </div>
  );
}

let mountedHost: HTMLElement | null = null;

/**
 * Mount the inspector on top of the running app. Idempotent — calling it
 * twice replaces the previous instance. Returns a disposer.
 */
export function mountInspector(bridge: TestBridge, channel: InspectorChannel | null = null): () => void {
  if (typeof document === 'undefined') return () => {};
  if (!mountedHost) {
    mountedHost = document.createElement('div');
    mountedHost.id = 'sp-inspector-root';
    // Above everything — the inspector should never be obscured by a modal,
    // splash, or HUD layer. Pointer events are local to the inspector tree.
    mountedHost.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999';
    document.body.appendChild(mountedHost);
    injectStyles();
  }
  render(<Inspector bridge={bridge} channel={channel} />, mountedHost);
  return () => {
    if (mountedHost) {
      render(null, mountedHost);
      mountedHost.remove();
      mountedHost = null;
    }
  };
}

function injectStyles(): void {
  if (document.getElementById('sp-inspector-styles')) return;
  const style = document.createElement('style');
  style.id = 'sp-inspector-styles';
  style.textContent = INSPECTOR_CSS;
  document.head.appendChild(style);
}

const INSPECTOR_CSS = `
.sp-inspector, .sp-inspector__pin {
  pointer-events: auto;
  font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #e7eef0;
}
.sp-inspector {
  position: fixed;
  width: 320px;
  max-height: 70vh;
  background: rgba(9, 16, 19, 0.95);
  border: 1px solid rgba(231, 238, 240, 0.12);
  border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(6px);
}
.sp-inspector--top-right    { top: 12px; right: 12px; }
.sp-inspector--top-left     { top: 12px; left: 12px; }
.sp-inspector--bottom-right { bottom: 12px; right: 12px; }
.sp-inspector--bottom-left  { bottom: 12px; left: 12px; }
.sp-inspector.is-collapsed { width: auto; }

.sp-inspector__head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(231, 238, 240, 0.04);
  border-bottom: 1px solid rgba(231, 238, 240, 0.08);
}
.sp-inspector__title { font-weight: 600; letter-spacing: 0.04em; }
.sp-inspector__id {
  margin-left: 6px;
  padding: 1px 6px;
  font-size: 10px;
  background: rgba(94, 234, 212, 0.18);
  color: #5eead4;
  border-radius: 4px;
}
.sp-inspector__id--remote {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}
.sp-inspector__spacer { flex: 1; }
.sp-inspector__icon {
  background: transparent;
  color: rgba(231, 238, 240, 0.7);
  border: 1px solid rgba(231, 238, 240, 0.1);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font: inherit;
}
.sp-inspector__icon:hover { color: #fff; background: rgba(231, 238, 240, 0.08); }

.sp-inspector__tabs {
  display: flex;
  gap: 1px;
  background: rgba(231, 238, 240, 0.06);
  padding: 4px 4px 0;
}
.sp-inspector__tab {
  flex: 1;
  background: transparent;
  border: none;
  color: rgba(231, 238, 240, 0.55);
  padding: 5px 6px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font: inherit;
  font-size: 10px;
  border-radius: 4px 4px 0 0;
}
.sp-inspector__tab.is-active { background: rgba(9, 16, 19, 0.95); color: #e7eef0; }

.sp-inspector__body {
  overflow: auto;
  padding: 8px;
  flex: 1;
}
.sp-inspector__table { width: 100%; border-collapse: collapse; }
.sp-inspector__table th, .sp-inspector__table td {
  padding: 3px 6px;
  text-align: left;
  border-bottom: 1px solid rgba(231, 238, 240, 0.06);
  white-space: nowrap;
}
.sp-inspector__table th {
  color: rgba(231, 238, 240, 0.55);
  font-weight: 500;
}
.sp-inspector__actions { display: flex; flex-direction: column; gap: 4px; }
.sp-inspector__actions button {
  background: rgba(56, 189, 248, 0.1);
  color: #5eead4;
  border: 1px solid rgba(94, 234, 212, 0.18);
  border-radius: 4px;
  padding: 5px 8px;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.sp-inspector__actions button:hover { background: rgba(94, 234, 212, 0.18); color: #fff; }
.sp-inspector__actions button:disabled { opacity: 0.4; cursor: not-allowed; }
.sp-inspector__actions hr { border: 0; border-top: 1px solid rgba(231, 238, 240, 0.06); margin: 4px 0; }
.sp-inspector__btn--danger { background: rgba(252, 165, 165, 0.12) !important; color: #fca5a5 !important; border-color: rgba(252, 165, 165, 0.3) !important; }
.sp-inspector__snaps {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.sp-inspector__snap {
  position: relative;
  display: block;
  border: 1px solid rgba(231, 238, 240, 0.1);
  border-radius: 4px;
  overflow: hidden;
  background: #000;
}
.sp-inspector__snap img { display: block; width: 100%; height: auto; }
.sp-inspector__snap-tag {
  position: absolute;
  bottom: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #5eead4;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 2px;
}

.sp-inspector__list { display: flex; flex-direction: column; gap: 3px; }
.sp-inspector__row {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 3px 0;
  border-bottom: 1px solid rgba(231, 238, 240, 0.04);
}
.sp-inspector__row--rejected { color: #fca5a5; }
.sp-inspector__pill {
  background: rgba(231, 238, 240, 0.08);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.sp-inspector__muted { color: rgba(231, 238, 240, 0.5); }
.sp-inspector__err { color: #fca5a5; }
.sp-inspector__link {
  background: none;
  border: none;
  color: #5eead4;
  cursor: pointer;
  font: inherit;
  padding: 0;
  text-decoration: underline dotted;
}

.sp-inspector__pin {
  position: fixed;
  top: 12px;
  right: 12px;
  background: rgba(9, 16, 19, 0.92);
  border: 1px solid rgba(94, 234, 212, 0.35);
  color: #5eead4;
  width: 28px;
  height: 28px;
  border-radius: 14px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.sp-inspector__toast {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  background: #5eead4;
  color: #0e1d21;
  border-radius: 4px;
  padding: 4px 8px;
  font-weight: 600;
  text-align: center;
  animation: sp-inspector-fade 1.4s ease;
}
@keyframes sp-inspector-fade {
  0% { opacity: 0; }
  10% { opacity: 1; }
  85% { opacity: 1; }
  100% { opacity: 0; }
}
`;
