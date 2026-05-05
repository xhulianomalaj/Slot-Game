---
description: Scaffold a new FSM phase handler and register it.
argument-hint: <PhaseName>
---

Create a new FSM phase.

Name: `$ARGUMENTS`

Steps:

1. Create `src/flow/phases/$ARGUMENTS.ts` exporting a class that implements the `Phase` interface from `src/flow/Phase.ts`.
2. Implement `enter(ctx)` — this is where the phase does its work. Use the context's `ticker`, `stores`, `network`, and `presenters`.
3. Implement `skip()` if the user should be able to skip this phase (Turbo / SuperTurbo speed).
4. Implement `exit()` if the phase holds timers, event listeners, or transient state to tear down.
5. Register the phase in `src/flow/fsm.ts`: add a name, transition rules, and instantiate.
6. Add transitions from/to this phase in `src/flow/transitions.ts` or the FSM config.
7. Add a unit test in `tests/flow/$ARGUMENTS.test.ts` — phases must be testable without a canvas. Mock the presenters and assert the state/FSM transitions that happen.
8. Run `pnpm typecheck && pnpm test && pnpm lint`.

Do not:
- Call `setTimeout` inside the phase — use `ctx.ticker.schedule`.
- Import pixi-reels in the phase. Talk to presenters.
- Call presenters and stores in the same line without thinking about order — state mutations happen first, presenter calls second.
