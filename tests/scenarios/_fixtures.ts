// Test data fixtures — reusable grids, winlines, and pre-built scripts.
//
// QA writes scenarios faster when they're not hand-rolling 5×3 arrays. Drop
// new shapes here as you need them; keep names descriptive ("fiveSevens",
// "scatterTriple") so specs read like English.
//
// Convention: all grids are [reel][row] to match the wire shape of `Grid`.

import type { Winline } from '@/domain/types';

const grid = (rows: string[][]): string[][] => rows;
const sym = (id: string): string => id;

// ─── Grids ──────────────────────────────────────────────────────────

// Each grid is built through `grid()` so the inferred type is mutable
// `string[][]` — what `slot.queueLoss(...)` expects. Using `as const` would
// give a `readonly` literal that won't pass through page.evaluate.
export const Grids = {
  /** Garden-variety losing grid — no three-of-a-kind, no scatters. */
  neutralLoss: grid([
    ['cherry', 'lemon', 'orange'],
    ['lemon', 'orange', 'plum'],
    ['orange', 'plum', 'bell'],
    ['plum', 'bell', 'bar'],
    ['bell', 'bar', 'cherry'],
  ]),
  /** All five reels show seven-seven-seven across every row — biggest paytable hit. */
  fiveSevens: grid([
    [sym('seven'), sym('seven'), sym('seven')],
    [sym('seven'), sym('seven'), sym('seven')],
    [sym('seven'), sym('seven'), sym('seven')],
    [sym('seven'), sym('seven'), sym('seven')],
    [sym('seven'), sym('seven'), sym('seven')],
  ]),
  /** Three sevens on the top row of reels 0..2, anything else elsewhere. */
  threeSevensTopLine: grid([
    [sym('seven'), sym('lemon'), sym('orange')],
    [sym('seven'), sym('orange'), sym('plum')],
    [sym('seven'), sym('plum'), sym('bell')],
    [sym('plum'), sym('bell'), sym('bar')],
    [sym('bell'), sym('bar'), sym('cherry')],
  ]),
  /** Three scatters in reels 0, 2, 4 — the canonical "trigger" shape. */
  scatterTrigger: grid([
    [sym('scatter'), sym('lemon'), sym('orange')],
    [sym('cherry'), sym('lemon'), sym('plum')],
    [sym('orange'), sym('scatter'), sym('bell')],
    [sym('plum'), sym('bell'), sym('bar')],
    [sym('scatter'), sym('bar'), sym('cherry')],
  ]),
  /** Wild on every reel — useful for win-show layout testing. */
  fiveWilds: grid([
    [sym('wild'), sym('wild'), sym('wild')],
    [sym('wild'), sym('wild'), sym('wild')],
    [sym('wild'), sym('wild'), sym('wild')],
    [sym('wild'), sym('wild'), sym('wild')],
    [sym('wild'), sym('wild'), sym('wild')],
  ]),
};

// ─── Winlines ───────────────────────────────────────────────────────

export const Winlines = {
  /** A 5-of-a-kind seven across the top row. */
  fiveSevensTop: (amount: number): Winline => ({
    lineId: 1,
    symbolId: 'seven',
    matchCount: 5,
    amount,
    positions: [
      { reel: 0, row: 0 },
      { reel: 1, row: 0 },
      { reel: 2, row: 0 },
      { reel: 3, row: 0 },
      { reel: 4, row: 0 },
    ],
  }),
  /** A 3-of-a-kind seven on the leftmost reels. */
  threeSevensTop: (amount: number): Winline => ({
    lineId: 1,
    symbolId: 'seven',
    matchCount: 3,
    amount,
    positions: [
      { reel: 0, row: 0 },
      { reel: 1, row: 0 },
      { reel: 2, row: 0 },
    ],
  }),
  scatterPay: (amount: number): Winline => ({
    lineId: 99,
    symbolId: 'scatter',
    matchCount: 3,
    amount,
    positions: [
      { reel: 0, row: 0 },
      { reel: 2, row: 1 },
      { reel: 4, row: 0 },
    ],
  }),
} as const;

// ─── Spin response shorthands ───────────────────────────────────────

export const Wins = {
  /** Big-win shape: 5×7 across the top row, 250 credits. */
  big250: { grid: Grids.fiveSevens, totalWin: 250, winlines: [Winlines.fiveSevensTop(250)] },
  /** Modest 3-of-a-kind, 5 credits. */
  three5: { grid: Grids.threeSevensTopLine, totalWin: 5, winlines: [Winlines.threeSevensTop(5)] },
  /** Scatter trigger awarding 12 credits and a `bonus` payload (no FSM bonus phase yet). */
  scatter12: {
    grid: Grids.scatterTrigger,
    totalWin: 12,
    winlines: [Winlines.scatterPay(12)],
  },
} as const;
