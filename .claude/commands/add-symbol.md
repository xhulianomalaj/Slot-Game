---
description: Scaffold a new reel symbol class and register it.
argument-hint: <SymbolName>
---

Create a new sprite-based reel symbol.

Name: `$ARGUMENTS`

Steps:

1. Create `src/view/symbols/$ARGUMENTS.ts` extending `SpriteReelSymbol` (or `ReelSymbol` directly if it needs custom logic).
2. Implement `onActivate`, `onDeactivate`, `playWin`, `stopAnimation`, `resize`.
3. `resize()` MUST store cell dimensions and reposition internals — it is called on every symbol swap.
4. Anchor at `(0, 0)` for sprite symbols (top-left). If you center, do it in `resize()`, not the constructor.
5. Register the symbol in the `SymbolFactory` config.
6. Add the id to `src/config/gameConfig.ts` `symbolIds` so the server is allowed to send it.
7. Add a unit test in `tests/view/$ARGUMENTS.test.ts`.
8. Run `pnpm typecheck && pnpm test && pnpm lint`.

Do not:
- Import pixi-reels or pixi.js outside `src/view/` or `src/presenters/`.
- Call `setTimeout` — use `Ticker.schedule` if you need delays.
- Put payout information on the symbol. The client does not know payouts.
- Do network or state work from the symbol class. Symbols are dumb containers.
