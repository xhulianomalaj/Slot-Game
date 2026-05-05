# `tests/scenarios/` — start here

This is where every Playwright behavior scenario lives. Each `.spec.ts` covers one slice of the game's behavior. The HTML index — auto-generated from the actual test titles — is in [`CATALOG.md`](./CATALOG.md). Regenerate it with `pnpm test:catalog`.

## Conventions

- **`?test=<spec-id>` in every navigation.** The fixture's `slot.boot()` derives the id from the spec title; you can override with `boot({ testId: 'foo' })`. CI artifacts and the inspector overlay show this id.
- **Real reels for humans, stubs for Playwright.** The composition checks `navigator.webdriver` — automated drivers get `InstantTicker` + `StubReelsEngine` (instant rounds, empty stage); humans opening the same URL see the full Pixi pipeline. Override via `&stubs=0` (force real) or `&stubs=1` (force stubs). Inspector header shows `live` or `stubs`.
- **Files prefixed `_` are not specs.** `_fixtures.ts` for grids/wins, `_README.md` for this guide. The catalog generator skips them.
- **Pre-canned data** is in `_fixtures.ts` (`Grids.fiveSevens`, `Wins.big250`, `Winlines.threeSevensTop(5)`). Add to it instead of inlining 5×3 arrays.
- **Recorded server logs** live in `fixtures/`. Drop a JSON array of `SpinResponse` objects there and feed it via `slot.replay(...)` — see `replay.spec.ts`.
- **`test.fail` for known bugs.** Pin them with a comment that links to the issue. The suite tells you when the bug is fixed (the test will start passing and fail the run).

## What each spec covers

| File                       | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `spin-flow.spec.ts`        | Happy path · big wins · multi-round composition.                      |
| `network-failure.spec.ts`  | Server errors · offline / online · history correctness.               |
| `input.spec.ts`            | Pixi `clickPixi`, double-click guards (incl. `test.fail` for known bug). |
| `autospin.spec.ts`         | Autospin chain · stop behavior.                                       |
| `pixi-coverage.spec.ts`    | Required `.label`s exist · ticker pause/resume · test-id exposure.     |
| `full-boot.spec.ts`        | Assets → intro → tap-to-start → idle → spin — the production sequence. |
| `replay.spec.ts`           | Replay a recorded `SpinResponse[]` log; survive a mid-tape error.     |
| `perf.spec.ts`             | Round wall-clock under 100ms; 100 rounds under 5s.                    |
| `a11y.spec.ts`             | Every interactive Pixi node has a label, bounds, fits the viewport.   |
| `locale.spec.ts`           | Locale matrix — same scenario in every supported language.            |
| `recorder.spec.ts`         | Recorder captures actions, exports as runnable `.spec.ts`. Custom matchers. Audio + canvas snapshot APIs. |

## Anatomy of a scenario

```ts
import { Grids, Wins } from './_fixtures';
import { expect, test } from './slot-fixture';

test.describe('my new feature', () => {
  test('does the thing', async ({ slot }) => {
    await slot.boot({ startingBalance: 100, bet: 1 });   // assets → splash → idle
    await slot.queueWin(Wins.big250.grid, Wins.big250.totalWin); // script the server
    await slot.spin();                                    // drive a round
    await slot.expectBalance(349);
    await slot.expectLastWin(250);
    await slot.expectLastRoundFasterThan(100);            // catch real-time leaks
  });
});
```

That's it. No mocks to wire up, no bridge installation, no canvas-coordinate arithmetic. The fixture handles everything; the bridge handles the page side.

## Adding a new file

1. Drop `my-feature.spec.ts` next to the existing ones.
2. Lead with a `//` comment block — the first non-empty line shows up in the catalog as the file's purpose.
3. Use `slot` fixture from `./slot-fixture`. Don't import Playwright's `test` directly.
4. Run `pnpm test:catalog` to refresh the catalog index.

## Failure artifacts

Every failing scenario auto-attaches a `bridge-dump.json` with state, network history, FSM transitions, the Pixi a11y tree, the displayed grid, and the console buffer. Open the Playwright HTML report → the failed test → the attachment, and you have everything a triage engineer needs.

## Don't write specs by hand if you don't want to

QA can record interactively — open `?test=demo`, click the **REC** tab,
press `● start recording`, poke the inspector to play through your
scenario, press `⏹ stop`, click `copy as .spec.ts → clipboard`, paste
into a new file here. The exported spec runs as-is.

For repro from a server log:

```sh
pnpm test:import-log path/to/server-log.json --out tests/scenarios/fixtures/bug.json
```

Then write 4 lines:

```ts
import log from './fixtures/bug.json';
test('repro', async ({ slot }) => {
  await slot.boot({ startingBalance: log[0].balance });
  await slot.replay(log);
});
```

> If you're a QA engineer reading this: the [TESTING guide](../../docs/TESTING.md) is your friend. Live debugging via the inspector overlay (top-right corner of `?test=...` builds) is faster than writing a one-off spec — and the recorder is faster still.
