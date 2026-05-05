# my-slot

Scaffolded with [`create-slotplate`](https://slotplate.dev). An opinionated slot game client on [`pixi-reels`](https://github.com/schmooky/pixi-reels).

## Quickstart

```bash
pnpm install
pnpm dev                       # http://localhost:5173
pnpm typecheck
pnpm test                      # unit + flow tests (vitest)
pnpm test:e2e                  # behavior scenarios (Playwright + bridge)
pnpm test:e2e:ui               # Playwright UI mode for scenarios
pnpm test:screenshots          # Playwright screenshot matrix
pnpm lint                      # biome check
pnpm format                    # biome format --write
pnpm run assets:pack           # build asset bundles into public/
```

## Testing

Three suites cover three layers — see [docs/TESTING.md](docs/TESTING.md) for the full guide.

| Suite              | Tool       | Catches                                     |
| ------------------ | ---------- | ------------------------------------------- |
| `pnpm test`        | Vitest     | Logic, contract drift, phase behavior       |
| `pnpm test:e2e`    | Playwright | Behavior — clicks, network mocks, hotkeys, autoplay, recovery |
| `pnpm test:screenshots` | Playwright | Pixel diffs across 16 viewports         |

The behavior suite uses an **in-page test bridge** that lets specs script every server response, simulate connection loss, click Pixi-rendered HUD buttons by label (`clickPixi('spin')`), pause Pixi+GSAP for tear-free screenshots, and identify the active scenario via `?test=<id>`. See the doc for full API.

**For QA**: load any `?test=...` URL — a live **inspector overlay** appears in the corner. Seven tabs:

- **state** — every store value, refreshed at 5Hz
- **queue** — buttons to script wins/losses/errors, simulate offline, run autospin, copy a JSON repro file
- **a11y** — every labeled Pixi node with bounds; click to emit a `pointertap`
- **history** / **transitions** — last network calls + FSM phase log
- **rec** — start/stop recording, copy as `.spec.ts` (zero-code authoring!)
- **snap** — capture canvas thumbnails to localStorage for visual triage

Press `Esc` to hide, `Alt+I` to show, `↗` to pop out into a separate tab. Add `&inspector=0` for a clean screenshot.

**Real reels vs headless stubs.** When a human opens `?test=...` in a normal browser the full Pixi pipeline boots — reels, animations, GSAP — same as production. When Playwright drives the page (`navigator.webdriver === true`) the composition swaps in `InstantTicker` + `StubReelsEngine` so the suite finishes in seconds. Override either way:

- `&stubs=0` — force the real engine even under automation (great for debugging a flaky scenario in headed mode).
- `&stubs=1` — force stubs in a normal browser (instant rounds, empty reels — useful when you only care about the FSM/HUD).

The inspector header shows a `live` or `stubs` pill so you always know which mode you're in.

**Browse what's covered**:
- [`tests/scenarios/CATALOG.md`](tests/scenarios/CATALOG.md) — every scenario, auto-generated (`pnpm test:catalog`)
- [`docs/COMPONENTS.md`](docs/COMPONENTS.md) — every UI building block + its label/testid (`pnpm test:components`)
- [`docs/TESTING.md`](docs/TESTING.md) — full bridge API + cheat sheet

**For repro from production**: `pnpm test:import-log <log.json> --out tests/scenarios/fixtures/repro.json`, then a one-line spec replays it locally.

**For your real RGS**: `RGS_API_URL=https://staging.example.com/api pnpm test:contract` runs a contract suite against the live endpoint. CI: see [`.github/workflows/scenarios.yml`](.github/workflows/scenarios.yml).

## What's here

```
src/
  composition.ts        Composition root — the one place that wires everything.
  container/            Tiny DI container.
  state/                MobX stores (Balance, Data, UI).
  domain/               Wire types only. No evaluators, no math.
  infrastructure/       Network, timing (GsapTicker), assets, analytics.
  flow/                 FSM + phase handlers. Owns game time.
  presenters/           State → view adapters (ReelsPresenter).
  view/                 Pixi scenes, symbol classes, overlays.
  view/smart/           SmartContainer + ReelsFrame — adaptive positioning.
  ui/                   Preact HUD (components, hooks, styles).
  config/               Grid dims, symbol ids (client-side only).
tests/
  flow/                 Canvas-free phase + store tests.
  screenshots/          Playwright viewport matrix.
raw-assets/             Source art. Compile with `pnpm run assets:pack`.
.assetpack.mjs          AssetPack pipeline config.
biome.json              Lint + format + enforced boundaries.
playwright.config.ts    16+ viewport projections for screenshot tests.
CLAUDE.md / AGENTS.md   Agent rules — read these before editing.
.claude/commands/       Slash commands for scaffolding.
```

## The HUD

The HUD is Preact mounted into `#hud` over the Pixi canvas. Components observe
MobX stores via `observer` from `@/ui/hooks/useObserver`. Ships with:

- Bet stepper (±, snaps to the configured denominations)
- Spin / Stop / Skip button with state-aware visuals
- Speed pill (Normal / Turbo / Super)
- Balance + Win chips with tabular numerals
- Sound toggle, Menu, Info modals
- Autospin with visible remaining counter

All components respect safe-area insets (`env(safe-area-inset-*)`) and have
portrait-specific tuning. Replace or extend as needed — the presenter
contract (read MobX, drive FSM) stays the same.

## Adaptive positioning

`SmartContainer` auto-positions with per-orientation config
(`portraitData` / `landscapeData`, fit/align/offset). `ReelsFrame` uses it to
place reels inside HUD safe zones on every viewport from iPhone SE to
2560×1440 desktop. A singleton `resizeObject` listens to `window.resize` +
`orientationchange` and notifies all smart containers. Three fit modes:
`fitContain` (letterbox-safe — for reels & HUD), `fitCover` (crop-safe — for
full-bleed art), `fitFill` (axes scale independently — for gradients only).

## Background (swappable theme)

The background is a `TilingSprite`-backed layer that always covers the
viewport — never letterboxed, never stretched.

- **Tile catalog** lives in `src/config/theme.ts` (`BACKGROUNDS`).
- **Active background** is one line: `THEME.background = 'proto-dark-05'`.
- **Live swap** at runtime: `container.get(Tokens.Background).setBackground(id)`.
- **Add a tile**: drop a tileable PNG in `public/assets/bg/`, register it in
  `BACKGROUNDS`. Done.
- **Replace the implementation** (video, parallax, shader): swap the
  `BackgroundLayer` import in `src/view/scenes/MainScene.ts`. The
  `BackgroundPresenter` contract stays the same so settings UIs don't break.

Ships with six Kenney prototype textures (dark / light / purple / green) so
you can validate scaling and theme-swap before you have final art. The
default is `proto-dark-05` — the grey grid you see on first boot.

### Why `TilingSprite` (and not a stretched Sprite or fitContain)

Stretched sprites distort. `fitContain` letterboxes — a thin slice of black
at the screen edge is unacceptable for a casino product. `TilingSprite`
samples the texture across the viewport at any aspect ratio with **no
distortion and no letterboxing**. The tile size is scaled by the **shorter
viewport edge / 1080** so the same texture looks proportionate on a phone
and a 4K monitor.

### Tiling rules baked into BackgroundLayer

1. Source PNGs must be power-of-two (Kenney's are 1024×1024 — keep yours that way).
2. `texture.source.addressMode = 'repeat'` so the GPU wraps without seams.
3. Tile size scales with the **shorter viewport edge** so portrait & landscape match.
4. Width/height rounded to integer pixels — sub-pixel widths produce visible cracks on Retina.
5. Vignette is a separate `Sprite` stretched to the viewport — independent of the tile.

## Assets

`raw-assets/` holds source files. `@assetpack/core` compiles them into
`public/assets/` with WebP/PNG compression and cache-busting. Bundle
definitions live in `src/infrastructure/loader/assetManifest.ts` (boot /
main / bonus). The loader UI shows progress until every bundle lands; any
error surfaces in the loader, never silently.

## Principles

1. Client does not evaluate — server is authoritative.
2. No `setTimeout` — use `Ticker.schedule`.
3. Presenters translate state → view. Timing is the FSM's job.
4. State mutates via actions only.
5. Disposable everything.
6. Fail loud.
7. One composition root.
8. `pixi-reels` lives behind `ReelsPresenter`.
9. Every phase is a file.
10. Docs are for agents too.

Full list with rationale: https://slotplate.dev/docs/principles/

## Connect your server

The client speaks one tiny contract: `session()` and `spin()`. Three adapters
ship in `src/infrastructure/network/`:

| Adapter                    | Use it when                                               |
| -------------------------- | --------------------------------------------------------- |
| `MockNetworkManager`       | Local dev, asset previews, screenshot tests. Default.     |
| `HttpNetworkManager`       | POST /session and /spin against a REST endpoint.          |
| `WebSocketNetworkManager`  | Request/response over a single WS connection.             |

### Option A — flip an env var (zero code)

`cp .env.example .env.local` and set:

```bash
VITE_NETWORK=http
VITE_API_URL=https://rgs.example.com/api
# or:
# VITE_NETWORK=ws
# VITE_WS_URL=wss://rgs.example.com/ws
```

Restart `pnpm dev`. The factory in
`src/infrastructure/network/createNetwork.ts` picks the adapter at boot.
Auth tokens are read from `?token=` / `?sessionToken=` URL params (the way
lobbies pass them) or from `VITE_AUTH_TOKEN`.

### Option B — write a custom adapter (any wire protocol)

```ts
// src/infrastructure/network/MyAdapter.ts
import { defineNetworkAdapter } from '@/infrastructure/network';

export const createMyAdapter = defineNetworkAdapter((opts: { url: string }) => ({
  async session(req) {
    /* talk to your server, return SessionResponse */
  },
  async spin(req) {
    /* talk to your server, return SpinResponse */
  },
}));
```

Then either pass it to `compose()` directly:

```ts
// src/main.ts
const app = await compose({ host, hudHost, network: createMyAdapter({ url }) });
```

…or register a new branch in `createNetwork.ts`. The wire types are in
`src/domain/types.ts` and *that* is the contract — everything else
(transport, auth, retries, multiplexing) is up to your adapter.

## Extending the game

| Want to add…   | Where it goes                                            | How                                                              |
| -------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| A phase        | `src/flow/phases/MyPhase.ts`                             | Implement `Phase`, append to `src/flow/phases/index.ts`.         |
| A symbol       | `src/view/symbols/MySymbol.ts`                           | Extend `ReelSymbol`, register in `SymbolFactory` + `gameConfig`. |
| A service      | wherever it belongs                                      | Add a `Token<T>` to `src/container/tokens.ts`, register in composition. |
| A modal        | `stores.modals.alert(...)` / `confirm(...)` / `show(...)`| Imperative API, awaitable.                                       |
| A locale       | `src/locales/<lang>.json`                                | Add to `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`.             |
| A background   | `public/assets/bg/<id>.png` + entry in `BACKGROUNDS`     | Power-of-two PNG, register in `src/config/theme.ts`.             |

Slash commands shipped with the template scaffold the boilerplate:
`/add-symbol <Name>`, `/add-phase <Name>`.

## Next steps

1. Drop art into `raw-assets/`, run `pnpm run assets:pack`, add aliases to `src/infrastructure/loader/assetManifest.ts`.
2. Replace the stub engine in `src/view/scenes/MainScene.ts` with a real `ReelSetBuilder` call (set as child of `ReelsFrame` so positioning stays adaptive).
3. Point `VITE_NETWORK` at your RGS (see "Connect your server" above).
4. Run `pnpm test:screenshots:update` to seed your screenshot baselines.
5. Add symbols with `/add-symbol <Name>`; add phases with `/add-phase <Name>`.
