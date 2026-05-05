# AGENTS.md

Agent-facing contributor guide. Mirrors [CLAUDE.md](CLAUDE.md) for non-Claude agents.

## TL;DR

- This is a **client**. It renders what the server returned. It does not compute wins.
- Read [CLAUDE.md](CLAUDE.md) first — the principles are hard rules.
- Architecture docs: https://slotplate.dev.
- Full manual for agents: https://slotplate.dev/llms-full.txt.
- Biome will reject boundary violations and `setTimeout` calls in game code.

## Running locally

```bash
pnpm install
pnpm dev          # vite on :5173
pnpm typecheck
pnpm test
pnpm lint         # biome check — enforces boundary rules
pnpm format       # biome format --write
```

## File-map quick reference

| Folder | What lives here |
|---|---|
| `src/composition.ts` | Composition root — all wiring |
| `src/container/` | Tiny DI container |
| `src/state/` | MobX stores |
| `src/domain/` | Wire types only (SpinRequest, SpinResponse, Grid, Winline) |
| `src/infrastructure/` | I/O: network, timing (ticker), assets, analytics |
| `src/flow/` | FSM and phase handlers |
| `src/presenters/` | State → view adapters |
| `src/view/` | Pixi scenes, symbol classes, overlays |
| `src/view/smart/` | SmartContainer + ReelsFrame — adaptive viewport positioning |
| `src/ui/` | Preact HUD — components, hooks, styles |
| `src/config/` | Grid dimensions, symbol ids (client-side only) |
| `raw-assets/` | Source art; compile with `pnpm run assets:pack` |
| `tests/screenshots/` | Playwright tests across the market viewport matrix |
| `.claude/commands/` | Slash commands for scaffolding |

## What belongs here vs on the server

| Concern | Lives on... |
|---|---|
| Paytable, payouts, win evaluation | **Server** |
| Reelstrips, RNG, stop positions | **Server** |
| RTP, variance, certification | **Server** |
| Anticipation rule (when to tease) | **Server** (sends `teasingReels`) |
| Grid rendering, animation, HUD | **Client** (this repo) |
| Speed modes, skip logic, turbo | **Client** |
| Sound, particles, spotlight | **Client** |
| Bet input, balance display | **Client** (server is authoritative) |
