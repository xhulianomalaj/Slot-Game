# CLAUDE.md — Agent Guide

This project is built on [slotplate](https://slotplate.dev) — an opinionated slot-game **client** boilerplate on top of `pixi-reels`.

**Read this before editing anything.** If you break a principle below, the diff should not pass review.

## What this is (and isn't)

**This is a client.** A view-and-flow layer that renders what the server says happened.

**This is NOT a game server.** No paytable lives here. No win evaluator. No RTP harness. No reelstrips drive math. When the user presses Spin, the client:

1. Sends a `SpinRequest` to the server.
2. Receives a `SpinResponse` with `grid`, `totalWin`, `winlines` already computed.
3. Plays the animation. Shows the win the server said happened. Credits the balance the server said to credit.

If you find yourself adding a paytable JSON, writing an `evaluateWin` function, or simulating spins, stop. That belongs on the server.

## The 10 Principles

1. **Client does not evaluate.** The server returns resolved results; the client renders them. No paytable, no `evaluateWin`, no RTP. Enforced by Biome.
2. **No `setTimeout` / `setInterval`.** Use `Ticker.schedule(ms, fn)` from [src/infrastructure/timing.ts](src/infrastructure/timing.ts). `setTimeout` keeps firing in hidden tabs while the Pixi ticker pauses — you get desyncs, double-spins, and leaked callbacks. Enforced by Biome's `noRestrictedGlobals`.
3. **Presenters don't decide when.** They translate state → view. Timing belongs to the FSM.
4. **State mutates via actions only.** No view or presenter writes to a store directly.
5. **Disposable everything.** Any class that allocates a ticker handle, event listener, or Pixi resource implements `Disposable` and is torn down by its parent scene.
6. **Fail loud.** No silent `catch {}`. No `as any` without a one-line comment explaining *why*. Throw with messages that name what's missing and who should have provided it.
7. **One composition root.** All wiring happens in [src/composition.ts](src/composition.ts). Do not `new Service()` elsewhere.
8. **`pixi-reels` lives behind presenters.** Only files in `src/view/` and `src/presenters/` may import it. Enforced by Biome's `noRestrictedImports` (per-layer overrides in [biome.json](biome.json)).
9. **Every phase is a file.** New FSM states go in `src/flow/phases/` and register in `src/flow/fsm.ts`. Phases are unit-testable without a canvas.
10. **Docs are for agents too.** Point your agent at [`https://slotplate.dev/llms-full.txt`](https://slotplate.dev/llms-full.txt) for the full manual.

## Layer Map

```
ui (Preact HUD — src/ui/) ←── mounted into #hud above Pixi canvas
  ↓
scenes (mount pixi-reels, own lifecycle)
  SmartContainer / ReelsFrame adapt reel placement to viewport orientation
  ↓
flow (FSM + phase handlers — owns time)
  ↓
presenters (state → view)         infrastructure (I/O: network, timing, assets)
  ↓                                          ↑
state (MobX stores)                          │
  ↓                                          │
domain (WIRE TYPES ONLY) ────────────────────┘
  ↓
config (client-side config: grid dims, symbol ids)
```

`domain/` holds **types that cross the wire** — `SpinRequest`, `SpinResponse`, `Grid`, `Winline`. Nothing else. No evaluators, no pure math.

## Spin Lifecycle

```
UI click
  → HUDPresenter.requestSpin()
  → FSM.transition('Spin')
      SpinPhase.enter:
        BalanceStore.debitBet()           ← optimistic UI
        reelsPresenter.spin()             ← pixi-reels starts rolling
        network.spin(bet)                 ← parallel
  → response → DataStore.setResponse(result)
  → FSM.transition('StopSpin')
      StopSpinPhase.enter:
        reelsPresenter.setAnticipation(data.teasingReels)  ← server-directed
        reelsPresenter.setResult(grid)                     ← resolves on allLanded
  → FSM.transition('WinShow')
      WinShowPhase.enter:
        reelsPresenter.spotlight(winlines)  ← server-provided positions
        BalanceStore.credit(totalWin)       ← server-provided amount
  → FSM.transition('Idle')
```

## UI (Preact)

The HUD is Preact + MobX observers, rendered via `src/ui/mount.ts` into `#hud`
over the Pixi canvas. Components live in `src/ui/components/` and read state
through [`useStores`](src/ui/hooks/useStores.ts). Wrap stateful components
with `observer` from [`src/ui/hooks/useObserver.ts`](src/ui/hooks/useObserver.ts).

## Adaptive positioning (SmartContainer)

[`SmartContainer`](src/view/smart/SmartContainer.ts) is a Pixi `Container` that
re-positions/fits itself per-orientation using a shared
[`resizeObject`](src/view/smart/ResizeObserver.ts) singleton. Use it for any
top-level placed object (reels frame, HUD-in-Pixi overlays).
[`ReelsFrame`](src/view/smart/ReelsFrame.ts) is the prebuilt subclass for
positioning reels inside HUD safe zones.

Three fit modes:

| Mode          | Behavior                                                             | Use for                              |
| ------------- | -------------------------------------------------------------------- | ------------------------------------ |
| `fitContain`  | Scale uniformly, letterbox if needed. Content always fully visible.  | Reels, HUD — never crop the dial.    |
| `fitCover`    | Scale uniformly, crop if needed. Always fills viewport.              | Full-bleed art with a safe center.   |
| `fitFill`     | Scale axes independently. Always fills viewport, allows distortion.  | Full-bleed gradients/vignettes only. |

For tiled art that must fill any viewport with no distortion, use the
purpose-built [`BackgroundLayer`](src/view/scenes/BackgroundLayer.ts) — it
uses a `TilingSprite` so the texture wraps instead of stretches.

## Background (BackgroundLayer + theme registry)

The background is a separate, swappable layer:

- Tiles are listed in [`src/config/theme.ts`](src/config/theme.ts) (`BACKGROUNDS`).
- `THEME.background` picks the active id at boot.
- Live swap goes through [`BackgroundPresenter`](src/presenters/BackgroundPresenter.ts) — the only UI-facing surface.
- Tile + vignette rendering lives in [`BackgroundLayer`](src/view/scenes/BackgroundLayer.ts).

To add a new background: drop a tileable PNG into `public/assets/bg/`,
register it in `BACKGROUNDS`, point `THEME.background` at it. No other file
changes. To replace the implementation entirely (video, shader, parallax), swap
`BackgroundLayer` in [`MainScene`](src/view/scenes/MainScene.ts) — the
`BackgroundPresenter` contract stays the same.

Tiling best practices baked in:

1. Source textures are power-of-two (1024×1024 Kenney prototype textures).
2. `texture.source.addressMode = 'repeat'` so the GPU wraps without seams.
3. Tile size scales with the SHORTER viewport edge (so portrait & landscape match).
4. Tile width/height rounded to integer pixels (avoids Retina sub-pixel cracks).
5. Vignette stretched (`fitFill`-like) so it always hugs the viewport edges.

## Assets (assetpack)

Raw art lives in `raw-assets/`. `pnpm run assets:pack` compiles it into
`public/assets/`. The bundle manifest is in
[`src/infrastructure/loader/assetManifest.ts`](src/infrastructure/loader/assetManifest.ts)
(boot / main / bonus). The loader shows a progress bar until bundles finish;
errors surface in the loader UI, not silently.

## Tests — three suites

1. **`pnpm test`** — Vitest unit tests in `tests/flow/`. Canvas-free.
   Verify phase/store contracts (e.g. `balance-contract.test.ts`).
2. **`pnpm test:e2e`** — Playwright behavior scenarios in `tests/scenarios/`.
   Uses the in-page **test bridge** (`src/testing/TestBridge.ts`) to script
   every server response, simulate offline, click Pixi-labeled HUD, pause
   Pixi+GSAP for screenshots, and identify the active scenario via
   `?test=<id>`. Full guide: [docs/TESTING.md](docs/TESTING.md).
3. **`pnpm test:screenshots`** — Playwright pixel-diffs in
   `tests/screenshots/` across 16 viewports. `--update-snapshots` rebuilds.

When you add a new HUD control, scene element, or flow phase, add a
scenario to `tests/scenarios/`. Bridge methods you'll likely use:

- `slot.queueWin(grid, totalWin)` / `queueLoss` / `queueError` — script the next spin
- `slot.simulateOffline()` / `simulateOnline()` — connection drop / restore
- `slot.clickPixi('label')` — drive a Pixi `Container.label`-tagged node
- `slot.pixiBounds('label')` — bounds in canvas coords
- `slot.pauseTicker()` / `resumeTicker()` / `tickFrames(n)` — animation control
- `slot.spin()` / `startAutospin(n)` / `recoverFromError()` — actions

## Common Tasks

Use the slash commands when available:

- `/add-symbol <Name>` — adds a symbol class + registers it
- `/add-phase <Name>` — adds an FSM phase stub + registers it

### Add a symbol
1. Create `src/view/symbols/MySymbol.ts` extending `ReelSymbol`.
2. Implement `onActivate`, `onDeactivate`, `playWin`, `stopAnimation`, `resize`.
3. Register in the `SymbolFactory` and include the id in `src/config/gameConfig.ts` `symbolIds`.

### Add a phase
1. Create `src/flow/phases/MyPhase.ts` implementing `Phase`.
2. Implement `enter(ctx)`, optional `skip()`, optional `exit()`.
3. Register in `src/composition.ts`.

## Spine (optional)

Install `@esotericsoftware/spine-pixi-v8` and use [src/view/symbols/SpineReelSymbol.ts](src/view/symbols/SpineReelSymbol.ts) as the wrapper. Pattern mirrors bonbon-hw: a `SymbolAnimationPlayer` drives named tracks on a `Spine` instance.

## Debug

In the browser console:

```js
__PIXI_REELS_DEBUG.log()    // snapshot + grid
__PIXI_REELS_DEBUG.trace()  // log every domain event
```

AI agents can't read the canvas — use this.

## When stuck

Write up: what you tried, what you expected, what happened, what you think is going on. Ask. Better code, shorter loop.

## Links

- Docs: https://slotplate.dev
- `llms.txt` for agents: https://slotplate.dev/llms-full.txt
- `pixi-reels`: https://github.com/schmooky/pixi-reels
