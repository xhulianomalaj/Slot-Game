# Testing slotplate

slotplate ships **three** independent test suites, all using the same Vite-served app. Pick the right one for the question you're asking.

| Suite              | Tool       | Runs against            | Catches                                     | Cost   |
| ------------------ | ---------- | ----------------------- | ------------------------------------------- | ------ |
| `pnpm test`        | Vitest     | Pure functions / phases | Logic regressions, contract drift           | ms     |
| `pnpm test:e2e`    | Playwright | Live game in Chromium   | Behavior, network mocks, clicks, hotkeys    | secs   |
| `pnpm test:screenshots` | Playwright | Live game in 16 viewports | Visual regressions across devices       | mins   |

This doc focuses on the **`test:e2e` (scenarios)** suite — the one the user asked for. Everything is built on Playwright + a custom in-page test bridge.

---

## TL;DR — write a scenario in 30 seconds

```ts
// tests/scenarios/my-thing.spec.ts
import { expect, test } from './slot-fixture';

test('big win credits the wallet', async ({ slot }) => {
  await slot.boot({ startingBalance: 100, bet: 1 });
  await slot.queueWin(SOME_GRID, 250);
  await slot.spin();
  await slot.expectBalance(349);
  await slot.expectLastWin(250);
});
```

Run: `pnpm test:e2e`. UI mode: `pnpm test:e2e:ui`. Step debugger: `pnpm test:e2e:debug`.

---

## How it works

```
┌────────────────────────────────────────────────────────────────────┐
│ Playwright spec (test runner process, Node)                        │
│                                                                    │
│   const { slot } = test;                                           │
│   await slot.queueWin(grid, 50);   ←── typed wrapper around evaluate
│   await slot.spin();                                               │
│                                                                    │
└──────────────────────────┬─────────────────────────────────────────┘
                           │  page.evaluate(fn) — JSON across the wire
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│ Slotplate page (Chromium, served from `pnpm dev`)                  │
│                                                                    │
│   window.__SLOTPLATE_TEST = TestBridge {                           │
│     queueWin(grid, totalWin)  → ScriptableMockNetwork.queueSpin    │
│     spin()                    → fsm.transition('spin')             │
│     state()                   → reads MobX stores                  │
│     clickPixi('spin')         → emits pointertap on labeled node   │
│     pauseTicker()             → app.ticker.stop() + gsap.sleep()   │
│   }                                                                │
│                                                                    │
│   composition.ts (when test=<id> URL param is present):            │
│     network = ScriptableMockNetwork  (instead of MockNetworkManager)│
│     ticker  = InstantTicker          (instead of GsapTicker)        │
│     reels   = StubReelsEngine        (instead of pixi-reels)        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

Test mode is **opt-in via URL param**: `?test=<scenario-id>` swaps three things in the composition root:

| In production       | In test mode (`?test=...`)         | Why                                    |
| ------------------- | ---------------------------------- | -------------------------------------- |
| `MockNetworkManager`| `ScriptableMockNetwork`            | Tests script every server response.    |
| `GsapTicker`        | `InstantTicker`                    | Win-hold + delays fire on next microtask. |
| pixi-reels engine   | `StubReelsEngine`                  | No 2-3s spin animation per round.      |
| (none)              | `window.__SLOTPLATE_TEST` exposed  | Bridge for the test runner.            |

Production builds **never** instantiate `TestBridge` — even if the URL param were forged, `?test=0` / `off` / `false` explicitly disable it, and you can build with `VITE_TEST_BRIDGE=0` to compile it out.

---

## The fixture: `slot`

`tests/scenarios/slot-fixture.ts` exports a Playwright `test` extended with a single fixture, `slot: SlotDriver`. Every scenario gets a fresh page and a driver.

### Boot

```ts
await slot.boot({
  startingBalance: 100,    // optional; resets the mock wallet + store
  bet: 1,                  // optional; sets the bet store
  testId: 'my-scenario',   // optional; defaults to slugified test title
  keepSplash: false,       // optional; true to assert on intro screen
});
```

The boot sequence — same as production except the network is scripted:

1. Navigate to `/?test=<id>`.
2. Wait for `window.__SLOTPLATE_TEST` to mount.
3. Wait for `bootStage === 'ready'` (assets + session resolved).
4. Auto-dismiss the splash (unless `keepSplash: true`).
5. Reset wallet to `startingBalance` and set the bet.
6. The FSM is in `idle`. The test can now drive.

### State

```ts
const snap = await slot.state();
// {
//   phase: 'idle' | 'spin' | 'stopSpin' | 'winShow',
//   spinning, bet, balance, lastWin, totalWin,
//   bootStage, loadProgress, loadError,
//   autospinRemaining,
//   pendingNetworkRequests, queuedSpins,
// }

await slot.expectPhase('idle');
await slot.expectBalance(99);
await slot.expectLastWin(5);
await slot.expectGrid(grid);
```

### Programming the server

```ts
await slot.queueLoss(grid);                // bet debits, no win
await slot.queueWin(grid, 50);             // bet debits, +50 credited
await slot.queueWin(grid, 50, [winline]);  // explicit winlines for spotlight
await slot.queueError('RGS_TIMEOUT');      // next spin rejects
await slot.queueError('SLOW_DOWN', 1000);  // … after a 1s delay

// Advanced: full SpinResponse shape
await slot.queueSpin({
  kind: 'response',
  response: { grid, totalWin: 5, winlines, balance: 104, teasingReels: [3, 4] },
  delayMs: 200,
});
```

Spins fire FIFO. If a test calls `spin()` without queueing, the mock returns a deterministic no-win response so the happy path "just works".

### Connection state

```ts
await slot.simulateOffline();   // pending + future requests hang
await slot.startSpin();         // FSM enters 'spin', request hangs
expect((await slot.state()).pendingNetworkRequests).toBe(1);
await slot.simulateOnline();    // queued requests now flow
await slot.waitForPhase('idle');
```

Useful for testing reconnection banners, retry UIs, and round-recovery paths.

### Actions

```ts
await slot.spin();              // through the bridge — synchronous transition
await slot.startSpin();         // kick off, don't await
await slot.skipPhase();         // fsm.skip() — for stopSpin/winShow
await slot.recoverFromError();  // force-idle after a network-rejected spin
await slot.setBet(2);
await slot.startAutospin(10);
await slot.stopAutospin();
await slot.pressKey('Space');   // hotkey via Playwright keyboard
```

### Pixi-rendered HUD: `clickPixi(label)`

The HUD in this template is **inside the Pixi canvas** (`view/hud/`), not the DOM. There's no `data-testid="spin"` element to locate. Instead, every interactive Pixi `Container` sets `.label = '<id>'` and tests interact via:

```ts
await slot.clickPixi('spin');                  // emits pointertap on the labeled Container
await slot.clickPixi('autoplay');
await slot.clickPixi('bet:plus');
await slot.clickPixi('bet:minus');

const bounds = await slot.pixiBounds('spin');  // { x, y, width, height, centerX, centerY, visible }
const labels = await slot.pixiLabels();        // every labeled node, for debugging
```

**Built-in labels** (asserted by `tests/scenarios/pixi-coverage.spec.ts`):

| Label          | What                                  |
| -------------- | ------------------------------------- |
| `background`   | The full-viewport tiled BG layer.     |
| `reels-frame`  | The adaptive reel container.          |
| `hud`          | The HUD layer (parent of all controls). |
| `spin`         | Spin / Stop button.                   |
| `autoplay`     | Autoplay toggle.                      |
| `bet`          | Bet stepper container.                |
| `bet:plus`     | Bet + button.                         |
| `bet:minus`    | Bet − button.                         |
| `balance`      | Balance chip.                         |
| `win`          | Win counter chip.                     |

To add a label, set it on the Pixi `Container` constructor:

```ts
constructor(...) {
  super();
  this.label = 'my-control';   // pixi-test-label
  // ...
}
```

> **Pitfall:** Pixi v8's `Container.label: string` collides with anything you also call `label`. Inside HUD controls, the `Text` field is named `labelText` to avoid shadowing. If you see `TypeError: this.label.anchor.set is not a function`, you've shadowed it again — rename your Text field.

### Ticker control (for screenshots)

```ts
await slot.pauseTicker();        // app.ticker.stop() + gsap.ticker.sleep()
const buf = await page.screenshot();
await slot.tickFrames(3);        // step 3 frames forward while paused
await slot.resumeTicker();
```

Pixi rendering and GSAP both freeze. The FSM keeps moving (it's microtask-driven), so you can still wait for phase transitions. Use this to grab tear-free screenshots mid-round.

### Test identification

```ts
await slot.boot({ testId: 'big-win-replay' });
expect(await slot.testId()).toBe('big-win-replay');
```

The id from `?test=<id>` is exposed on the bridge so dev tools, log lines, and CI artifacts can correlate failures back to the scenario.

---

## What's automatically captured

The fixture installs two listeners on every test page:

```ts
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', err => pageErrors.push(`${err.name}: ${err.message}`));
```

Any uncaught error or `console.error` — including TypeScript-runtime errors deep inside Pixi handlers — is **annotated** on the test result and **fails the test loudly** at teardown. Without this, an error in a click handler is swallowed by the canvas and the test fails with a mystery timeout.

What you'd see in the report:

```
Error: page errors during test:
TypeError: this.label.anchor.set is not a function
    at new SpinButton (.../SpinButton.ts:16:23)
```

---

## File layout

```
template/
  src/
    testing/
      TestBridge.ts             ← Window-exposed remote control.
      InstantTicker.ts          ← Microtask-pacing replacement for GsapTicker.
      StubReelsEngine.ts        ← No-op replacement for pixi-reels in test mode.
      index.ts                  ← `isTestModeEnabled()` + barrel.
    infrastructure/network/
      ScriptableMockNetwork.ts  ← FIFO-queue NetworkManager.
    composition.ts              ← Wires the test-mode swaps.
  tests/
    flow/                       ← Vitest unit tests (no canvas).
      balance-contract.test.ts  ← Pins SpinResponse.balance == post-win.
      SpinPhase.test.ts
    scenarios/                  ← Playwright behavior tests.
      slot-fixture.ts           ← The `slot` fixture.
      spin-flow.spec.ts
      network-failure.spec.ts
      input.spec.ts
      autospin.spec.ts
      pixi-coverage.spec.ts
      full-boot.spec.ts
    screenshots/                ← Playwright pixel-diff suite (separate config).
  playwright.config.ts          ← Screenshot matrix (16 viewports).
  playwright.scenarios.config.ts← Scenario suite (single Chromium).
```

---

## Common scenarios

### The full boot flow

```ts
test('full boot — assets → intro → idle → spin', async ({ slot, page }) => {
  await slot.boot({ keepSplash: true });
  await expect(page.locator('[data-testid="splash"]')).toBeVisible();
  await page.evaluate(() => window.__SLOTPLATE_TEST!.tapToStart());
  await slot.expectPhase('idle');
  await slot.queueLoss(GRID);
  await slot.clickSpin();
  await slot.waitForPhase('idle');
});
```

### Network drop mid-spin → reconnect

```ts
test('connection drop leaves the spin pending until online', async ({ slot }) => {
  await slot.boot({ startingBalance: 100, bet: 1 });
  await slot.queueWin(GRID, 7);
  await slot.simulateOffline();
  await slot.startSpin();
  expect((await slot.state()).pendingNetworkRequests).toBe(1);
  await slot.simulateOnline();
  await slot.waitForPhase('idle');
  await slot.expectBalance(106);
});
```

### Server error → recovery

```ts
test('server error rejects, then we recover and play again', async ({ slot }) => {
  await slot.boot({ startingBalance: 100, bet: 1 });
  await slot.queueError('RGS_TIMEOUT');
  await slot.spin().catch(() => { /* expected */ });
  await slot.recoverFromError();
  await slot.queueLoss(GRID);
  await slot.spin();
});
```

### Asserting on the Pixi canvas

```ts
test('Spin button is positioned and clickable', async ({ slot }) => {
  await slot.boot();
  const bounds = await slot.pixiBounds('spin');
  expect(bounds!.visible).toBe(true);
  expect(bounds!.width).toBeGreaterThan(0);
  await slot.clickPixi('spin');
});
```

### Screenshot mid-round

```ts
test('mid-round screenshot is deterministic', async ({ slot, page }) => {
  await slot.boot();
  await slot.queueLoss(GRID);
  await slot.pauseTicker();
  await slot.clickSpin();
  await slot.waitForPhase('idle');
  await expect(page).toHaveScreenshot('mid-round.png');
  await slot.resumeTicker();
});
```

---

## Adding a new test bridge method

1. Method on `TestBridge` in `src/testing/TestBridge.ts`.
2. Add to the `Window['__SLOTPLATE_TEST']` declaration in `slot-fixture.ts`.
3. Wrap it on `SlotDriver` so specs are typed without `page.evaluate`.

That's it — no composition changes needed.

---

## Why **not** Cypress / Puppeteer / etc.

- Playwright trace viewer beats every other tool for "what happened in the browser at second 4.7".
- First-class iframes, multi-context, mobile emulation, and parallel sharding for free.
- The webkit/firefox engines are one config flag away if a customer asks for cross-browser screenshots.

We use Playwright for **both** scenarios and screenshots — same fixture pattern, same trace tooling.

---

## QA cheat sheet

```ts
// Boot
await slot.boot({ startingBalance: 100, bet: 1 });
await slot.boot({ keepSplash: true });             // assert on the intro screen
await slot.boot({ testId: 'my-bug-repro' });       // override URL test id

// Read state
const s = await slot.state();          // phase, balance, lastWin, lastRoundMs, language, ...
await slot.grid();                     // current displayed grid
await slot.history();                  // network call log
await slot.fsmTransitions();           // [{ to, at, prevDurationMs }, ...]
await slot.a11yTree();                 // labeled Pixi nodes with bounds + visibility
await slot.dumpAll();                  // everything in one JSON blob
await slot.testId();                   // the ?test=<id> from the URL

// Script the server (FIFO)
await slot.queueLoss(grid);
await slot.queueWin(grid, totalWin);
await slot.queueError('RGS_TIMEOUT', 1000);
await slot.queueSpin({ kind: 'response', response: full, delayMs: 200 });
await slot.simulateOffline(); /* ... */ await slot.simulateOnline();

// Replay a server log
import log from './fixtures/repro.json';
await slot.replay(log);                // queues + runs the entire tape

// Drive the FSM / wallet
await slot.spin();                     // round complete, await idle
await slot.startSpin();                // kick off, don't wait
await slot.skipPhase();                // fsm.skip()
await slot.recoverFromError();         // bring FSM back to idle after a network reject
await slot.startAutospin(10);
await slot.stopAutospin();
await slot.setBet(2);
await slot.simulateLowBalance(0);

// Pixi-rendered HUD
await slot.clickPixi('spin');
await slot.clickPixi('bet:plus');
await slot.pixiBounds('balance');      // { x, y, w, h, centerX, centerY, visible }
await slot.pixiLabels();

// UI actions
await slot.toggleSound();
await slot.setLanguage('de');
await slot.openMenu('paytable');
await slot.closeMenu();
await slot.pressKey('Space');

// Assertions
await slot.expectPhase('idle');
await slot.expectBalance(99);
await slot.expectLastWin(0);
await slot.expectGrid(grid);
await slot.expectLastRoundFasterThan(100);   // catches real-time-animation leaks
await slot.expectSpinButtonEnabled(true);

// Animation control (deterministic screenshots)
await slot.pauseTicker();
await page.screenshot({ path: 'mid-round.png' });
await slot.tickFrames(3);
await slot.resumeTicker();

// Locale matrix
forEachLocale(['en', 'de', 'fr'], (lang) => {
  test(`spin works in ${lang}`, async ({ slot }) => {
    await slot.boot({ testId: `spin-${lang}` });
    await slot.setLanguage(lang);
    /* ... */
  });
});
```

## Inspector overlay (live diagnostics)

Open the app with `?test=...` and a panel docks to the corner of the
canvas. Tabs:

- **state** — every field of `BridgeStateSnapshot`, refreshed at 5Hz.
- **queue** — buttons to queue loss / win / error / offline / online,
  spin, autospin, recover, simulate $0, toggle sound. One-click bug
  reproduction without writing a spec.
- **a11y** — every labeled Pixi node with bounds. Click a label to
  emit a `pointertap` on it.
- **history** — last 12 network calls with outcome + amounts.
- **transitions** — last 20 FSM transitions with durations.
- **copy bridge dump → clipboard** — the same JSON Playwright attaches on
  failure. Paste into a bug report.

Keyboard:
- `Esc` — hide. `Alt+I` — show. Position cycles via the ↺ button.

Disable for clean canvas screenshots: `?test=foo&inspector=0`.

### Pop out into a separate tab (`↗`)

Click the `↗` button in the inspector header — a new browser tab opens
`/__inspector.html` and connects to the running game tab over a same-origin
[`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel).
Identical UI, all RPC commands tunneled to the in-page TestBridge. Use it
when:

- you want the inspector on a second monitor without crowding the canvas;
- the game canvas is fullscreen / immersive and the inspector would obscure it;
- you're recording a screencast — the inspector is in a separate window for clean composition.

The `popout` pill in the embedded inspector header lights up amber while a
remote tab is connected, so you always know who's driving. Embedded and
popout drive the **same** bridge — actions from either land on the same
state.

> **Protocol:** `src/testing/InspectorChannel.ts` defines the wire format
> (`hello` / `ack` / `cmd` / `reply` / `state`) and the RPC method
> whitelist. Bridge methods not on the allowlist can't be called from the
> popout — keeps the surface intentional.

## Failure artifacts (what's attached on a fail)

The fixture's afterEach inspects `testInfo.status` and on any fail attaches:

- **`bridge-dump.json`** — `BridgeFullDump` with `state`, `networkHistory`,
  `fsmTransitions`, `pixiTree`, `grid`, `consoleAll`. A triage engineer
  pastes this into a bug report.
- **screenshot** (Playwright default).
- **trace** (`retain-on-failure`).
- **annotations** for each `console.error` and `pageerror` so the HTML
  report shows the original stack inline.

```sh
# After a failed run:
pnpm exec playwright show-report playwright-report-scenarios
# Open the failed test → Attachments → bridge-dump.json
```

## Scenario catalog

`pnpm test:catalog` rewrites [`tests/scenarios/CATALOG.md`](../tests/scenarios/CATALOG.md)
from the spec files. Run it after adding/removing tests; CI can verify the
catalog is up-to-date by running it in dry-run and diffing.

## Pre-canned fixtures

Don't hand-roll grids and winlines. Import:

```ts
import { Grids, Winlines, Wins } from './_fixtures';

await slot.queueLoss(Grids.neutralLoss);
await slot.queueWin(Grids.fiveSevens, 250, [Winlines.fiveSevensTop(250)]);
await slot.queueSpin({ kind: 'response', response: { ...Wins.scatter12, balance: 110 } });
```

## Replay from a recorded log

Drop a `SpinResponse[]` JSON next to `tests/scenarios/fixtures/`, then:

```ts
import { readFileSync } from 'node:fs';
const log = JSON.parse(readFileSync('./tests/scenarios/fixtures/my-bug.json', 'utf8'));
await slot.replay(log);
```

The bridge queues every entry and runs each as a spin. Use this to
reproduce a specific player's round in seconds, or to lock down a golden
tape after a major refactor.

## Recorder (zero-code spec authoring)

Click **REC** in the inspector → click `● start recording` → poke the
inspector / play through the scenario you want to capture → click
`⏹ stop recording` → click `copy as .spec.ts → clipboard` → paste into a
new file under `tests/scenarios/`. Done. The exported spec compiles and
runs.

Every action call routes through a `record()` helper inside the bridge,
so anything you can do in the inspector — and anything a Playwright spec
can call — is captured: queue, spin, clickPixi, setBet, autoplay,
language, menu, low-balance, etc.

```ts
// From a spec, the same surface:
await slot.startRecording();
await slot.queueWin(grid, 50);
await slot.clickPixi('spin');
await slot.stopRecording();
const spec = await slot.formatAsSpec('big-win-replay');
// spec is a `.spec.ts` body you can write to disk
```

## Visual snapshots

The **SNAP** tab captures the Pixi canvas to a PNG data URL, stores up
to 10 in `localStorage`, and renders a 2-column thumbnail strip. Click a
thumbnail to open the full image. Use this for "did this look right
after the spin?" triage without reaching for the screenshot suite.

```ts
const dataUrl = await slot.snapshotCanvas();   // any Playwright spec
```

## Custom matchers (`expect(slot)`)

`tests/scenarios/_matchers.ts` extends Playwright's `expect` so specs
read like English and failure messages include relevant state context:

```ts
import { expect, test } from './slot-fixture';
import { expect as expectSlot } from './_matchers';   // re-exports the extended expect

test('big win', async ({ slot }) => {
  await slot.boot({ startingBalance: 100, bet: 1 });
  await slot.queueWin(grid, 50);
  await slot.spin();

  await expectSlot(slot).toBeAtPhase('idle');
  await expectSlot(slot).toShowBalance(149);
  await expectSlot(slot).toShowLastWin(50);
  await expectSlot(slot).toBeSpinning(false);
  await expectSlot(slot).toCompleteRoundFasterThan(100);
  await expectSlot(slot).toHaveLabel('spin');
});
```

Matchers auto-poll the bridge state for ~2s, so a brief race doesn't
fail your test. On failure, the message includes phase, balance, queued
count, etc. — no manual `console.log` needed.

## Server contract suite

`tests/contract/server-contract.test.ts` runs against your real RGS when
`RGS_API_URL` is set. Without it, the suite skips (CI-friendly).

```sh
# Local
RGS_API_URL=https://staging.example.com/api  pnpm test:contract

# CI (in scenarios.yml)
- run: pnpm test:contract
  env:
    RGS_API_URL: ${{ secrets.STAGING_RGS_URL }}
    RGS_TOKEN:   ${{ secrets.STAGING_RGS_TOKEN }}
```

Pins three things:
1. `POST /session` returns the `SessionResponse` shape.
2. `POST /spin` returns the `SpinResponse` shape (and winlines if `totalWin > 0`).
3. The **balance contract** holds: `response.balance == before − bet + totalWin`.

If your server breaks any of these, every spin fails in production —
better to find out here.

## Audio cue assertions

When you ship an audio engine, hook it to the bridge:

```ts
// somewhere in your audio engine
import { notifyAudioCue } from '@/testing/audioBridge';

play(name: string, opts: { volume?: number } = {}) {
  this.howl.play(name);
  notifyAudioCue(name, { volume: opts.volume });
}
```

Then in a spec:

```ts
await slot.spin();
const log = await slot.audioLog();
expect(log.map(e => e.name)).toContain('win-show');
```

`notifyAudioCue` is a no-op when test mode is off — safe to leave in
production code. The bridge buffer is cleared per-test by the fixture
(or call `await slot.clearAudioLog()` to reset mid-test).

## Replay from a server log (production bug repro)

```sh
# Convert any server audit log into the SpinResponse[] format the bridge consumes
pnpm test:import-log path/to/log.json --out tests/scenarios/fixtures/round-17-bug.json

# It auto-detects: bare array, { spins: [...] }, { rounds: [...] }, JSONL.
# Validates each entry has the required fields and fails loud if not.
```

Then a one-line scenario reproduces the bug locally:

```ts
import log from './fixtures/round-17-bug.json';
test('round-17 bug repro', async ({ slot }) => {
  await slot.boot({ startingBalance: log[0].balance });
  await slot.replay(log);
  // Inspect / assert anything afterwards.
});
```

## CI workflow

[`.github/workflows/scenarios.yml`](../.github/workflows/scenarios.yml)
runs typecheck → unit → e2e on every push and PR, uploads the HTML
report + traces + bridge dumps as artifacts (kept for 14 days), and
fails if `tests/scenarios/CATALOG.md` is stale.

What you get on a failed run:
- HTML report with screenshots, traces, console errors, and the
  `bridge-dump.json` attachment per failure.
- Trace viewer (`pnpm exec playwright show-trace <trace.zip>`) with
  every action, network call, and DOM mutation.
- Annotations on the test for each `console.error` / uncaught exception.

## Components catalog

[`docs/COMPONENTS.md`](./COMPONENTS.md) — auto-generated from
`src/view/hud/controls/`, `src/view/scenes/`, and `src/ui/components/`.
Every UI building block listed with its file path, exports, Pixi
`.label` (for `clickPixi`), and DOM `data-testid` (for Playwright
locators). Regenerate with `pnpm test:components`.

## Caveats and known issues

- **Splash z-index**: there's a stacking-context clash between `.splash` and `.sp-header` that occasionally trips Playwright's pointer interception check. The full-boot scenario routes through `bridge.tapToStart()` to avoid it. CSS fix tracked in spawned task "Fix splash z-index — header intercepts pointer events".
- **Double-click double-spend**: real bug pinned by `test.fail()` in `input.spec.ts`. SpinButton's `ui.spinning` gate is set inside `SpinPhase.enter`, AFTER the await chain starts; two clicks in the same microtask both pass the gate. Will be fixed by adding a re-entrancy guard to `FSM.transition`.
- **Vite HMR + class instances**: rebooting the dev server mid-run is sometimes necessary if you change a class definition that's already instantiated by a long-lived page. Scenarios always navigate fresh, so this only bites during interactive `:ui` debugging.
