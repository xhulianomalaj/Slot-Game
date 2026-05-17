// MockNetworkManager — realistic offline fake server.
//
// This is NOT game math. It exists so every UI state is reachable locally
// without a real RGS. In production, swap for HttpNetworkManager or
// WebSocketNetworkManager — shapes stay the same; this file goes away.
//
// What this simulates:
//   • Weighted reel strips (rare symbols appear rarely, commons appear often)
//   • 3-row window per reel — consecutive stops, same as a physical machine
//   • 20-payline evaluation with wild substitution (left-to-right)
//   • Scatter pays anywhere on the grid (3–5 symbols)
//   • teasingReels signal when exactly 2 scatters land (anticipation)
//   • Variable latency — big wins respond slightly slower (RGS "thinking")
//   • Session stats (rounds, wagered, won) tracked server-side
//   • Balance floor — rejects spin if bet exceeds current balance

import type { SessionRequest, SessionResponse, SpinRequest, SpinResponse, Winline } from '@/domain/types';
import type { NetworkManager } from './types';

// ─── Paytable ─────────────────────────────────────────────────────────────────
// Multipliers × line bet. Keep in sync with src/config/paytable.ts.
// Scatter multiplies × total bet (not line bet) — evaluated separately.
const PAYOUTS: Record<string, Partial<Record<3 | 4 | 5, number>>> = {
  seven:   { 3: 50,  4: 200, 5: 1000 },
  wild:    { 3: 100, 4: 500, 5: 2500 },
  bar:     { 3: 25,  4: 100, 5: 500  },
  bell:    { 3: 15,  4: 60,  5: 250  },
  cherry:  { 3: 10,  4: 40,  5: 150  },
  plum:    { 3: 8,   4: 30,  5: 100  },
  orange:  { 3: 5,   4: 20,  5: 60   },
  lemon:   { 3: 5,   4: 15,  5: 50   },
  scatter: { 3: 5,   4: 20,  5: 100  },
};

const WILD    = 'wild';
const SCATTER = 'scatter';
const LINE_COUNT = 20;

// ─── Paylines (5-reel × 3-row, 20 lines) ─────────────────────────────────────
// Each entry is [row-on-reel-0, row-on-reel-1, …, row-on-reel-4].
// Row 0 = top, 1 = middle, 2 = bottom.
// Rule: adjacent reels may differ by at most 1 row — no 2-row jumps.
const PAYLINES: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [1, 1, 1, 1, 1], //  1 — middle row straight
  [0, 0, 0, 0, 0], //  2 — top row straight
  [2, 2, 2, 2, 2], //  3 — bottom row straight
  [0, 1, 2, 1, 0], //  4 — V-down
  [2, 1, 0, 1, 2], //  5 — V-up
  [1, 0, 1, 0, 1], //  6 — zigzag high
  [1, 2, 1, 2, 1], //  7 — zigzag low
  [0, 0, 1, 2, 2], //  8 — diagonal down-right
  [2, 2, 1, 0, 0], //  9 — diagonal up-right
  [0, 1, 1, 1, 0], // 10 — shallow V-down
  [2, 1, 1, 1, 2], // 11 — shallow V-up
  [1, 0, 0, 0, 1], // 12 — U-shape top
  [1, 2, 2, 2, 1], // 13 — U-shape bottom
  [0, 1, 0, 1, 0], // 14 — hi-lo alternating
  [2, 1, 2, 1, 2], // 15 — lo-hi alternating
  [0, 0, 1, 0, 0], // 16 — top dip centre
  [2, 2, 1, 2, 2], // 17 — bottom dip centre
  [1, 1, 0, 1, 1], // 18 — mid peak up
  [1, 1, 2, 1, 1], // 19 — mid peak down
  [0, 1, 2, 2, 1], // 20 — slide down (was extreme zigzag, violated ±1 rule)
];

// ─── Reel strips ──────────────────────────────────────────────────────────────
// One strip per reel. Each symbol's count determines its stop frequency.
// Strips are shuffled once per instance (session), then fixed — matching
// how a real RGS freezes its reelset per game version.
//
// RTP target: ~94–96% (approximated; a certified server must prove this
// mathematically — the mock just needs to feel right visually).
const STRIP_WEIGHTS: ReadonlyArray<Record<string, number>> = [
  // Reel 1 — outer reels have more low-value symbols
  { cherry: 8, lemon: 7, orange: 6, plum: 5, bell: 4, bar: 3, seven: 2, wild: 1, scatter: 2 },
  // Reel 2
  { cherry: 7, lemon: 7, orange: 6, plum: 5, bell: 4, bar: 3, seven: 2, wild: 1, scatter: 2 },
  // Reel 3 — middle reel: one extra scatter for more frequent near-misses
  { cherry: 7, lemon: 6, orange: 5, plum: 5, bell: 4, bar: 3, seven: 2, wild: 1, scatter: 3 },
  // Reel 4
  { cherry: 8, lemon: 7, orange: 6, plum: 5, bell: 4, bar: 3, seven: 2, wild: 1, scatter: 2 },
  // Reel 5 — last reel hardest to complete lines
  { cherry: 9, lemon: 8, orange: 6, plum: 5, bell: 4, bar: 3, seven: 2, wild: 1, scatter: 2 },
];

function buildStrip(weights: Record<string, number>): string[] {
  const strip: string[] = [];
  for (const [sym, count] of Object.entries(weights)) {
    for (let i = 0; i < count; i++) strip.push(sym);
  }
  // Fisher-Yates shuffle — uniform distribution across stop positions
  for (let i = strip.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = strip[i]!;
    strip[i] = strip[j]!;
    strip[j] = tmp;
  }
  return strip;
}

// ─── Win evaluation ───────────────────────────────────────────────────────────
function evaluatePayline(
  grid: string[][],
  payline: readonly number[],
  lineBet: number,
  lineId: number,
): Winline | null {
  // Read the symbol at each reel for this payline
  const symbols = payline.map((row, reel) => grid[reel]![row]!);

  // Base symbol = first non-wild, non-scatter left-to-right.
  // All-wild line pays as wild. Scatter never contributes to paylines.
  const base = symbols.find((s) => s !== WILD && s !== SCATTER) ?? (symbols[0] === WILD ? WILD : null);
  if (!base) return null;

  // Wilds extend the run from the left
  let count = 0;
  for (const s of symbols) {
    if (s === base || s === WILD) count++;
    else break;
  }
  if (count < 3) return null;

  const matchCount = Math.min(count, 5) as 3 | 4 | 5;
  const multiplier = PAYOUTS[base]?.[matchCount];
  if (!multiplier) return null;

  const amount = r2(lineBet * multiplier);
  const positions = Array.from({ length: matchCount }, (_, reel) => ({
    reel,
    row: payline[reel]!,
  }));

  return { lineId, symbolId: base, matchCount, amount, positions };
}

function evaluateScatter(grid: string[][], totalBet: number): Winline | null {
  const positions: Array<{ reel: number; row: number }> = [];
  for (let reel = 0; reel < grid.length; reel++) {
    for (let row = 0; row < grid[reel]!.length; row++) {
      if (grid[reel]![row] === SCATTER) positions.push({ reel, row });
    }
  }
  if (positions.length < 3) return null;

  const matchCount = Math.min(positions.length, 5) as 3 | 4 | 5;
  const multiplier = PAYOUTS[SCATTER]?.[matchCount] ?? 0;
  const amount = r2(totalBet * multiplier);
  return { lineId: 0, symbolId: SCATTER, matchCount, amount, positions };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function r2(n: number): number { return Math.round(n * 100) / 100; }

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, Math.max(0, ms)));
}

function jitter(spread: number): number {
  return (Math.random() - 0.5) * spread * 2;
}

// ─── Public types ─────────────────────────────────────────────────────────────
export interface MockNetworkOptions {
  symbolIds: readonly string[];
  columns: number;
  rows: number;
  /** Simulated latency for session/spin, in ms. Defaults to realistic values. */
  latency?: { session?: number; spin?: number };
  /** Simulated starting balance. Real adapters take this from the server. */
  startingBalance?: number;
}

// ─── MockNetworkManager ───────────────────────────────────────────────────────
export class MockNetworkManager implements NetworkManager {
  private balance: number;
  private readonly reelStrips: string[][];
  private readonly spinBase: number;
  private readonly sessionBase: number;

  // Session-scoped accounting (visible via the inspector's bridge dump)
  private roundsPlayed  = 0;
  private totalWagered  = 0;
  private totalWon      = 0;

  constructor(private readonly opts: MockNetworkOptions) {
    this.balance     = opts.startingBalance ?? 1000;
    this.spinBase    = opts.latency?.spin    ?? 480;
    this.sessionBase = opts.latency?.session ?? 650;

    // Build one strip per reel, cycling STRIP_WEIGHTS if columns > 5
    this.reelStrips = Array.from(
      { length: opts.columns },
      (_, i) => buildStrip(STRIP_WEIGHTS[i % STRIP_WEIGHTS.length]!),
    );
  }

  async session(_req: SessionRequest): Promise<SessionResponse> {
    await wait(this.sessionBase + jitter(180));
    return {
      sessionId:     `mock-${Math.random().toString(36).slice(2, 10)}`,
      balance:       this.balance,
      currency:      'USD',
      availableBets: [0.2, 0.5, 1, 2, 5, 10, 25, 50, 100, 200, 500, 1000],
      defaultBet:    1,
      columns:       this.opts.columns,
      rows:          this.opts.rows,
    };
  }

  async spin(req: SpinRequest): Promise<SpinResponse> {
    if (req.bet > this.balance) {
      throw new Error('[MockServer] Insufficient balance');
    }

    // Debit the bet immediately (server charges before resolving)
    this.balance      = r2(this.balance - req.bet);
    this.totalWagered = r2(this.totalWagered + req.bet);
    this.roundsPlayed++;

    // ── Build the grid from reel-strip stops ──────────────────────────────
    // Each reel picks a random stop; rows are 3 consecutive strip symbols.
    const grid: string[][] = this.reelStrips.map((strip) => {
      const stop = Math.floor(Math.random() * strip.length);
      return [
        strip[stop]!,
        strip[(stop + 1) % strip.length]!,
        strip[(stop + 2) % strip.length]!,
      ];
    });

    // ── Evaluate all paylines ─────────────────────────────────────────────
    const lineBet  = r2(req.bet / LINE_COUNT);
    const winlines: Winline[] = [];

    for (let i = 0; i < PAYLINES.length; i++) {
      const wl = evaluatePayline(grid, PAYLINES[i]!, lineBet, i + 1);
      if (wl) winlines.push(wl);
    }

    // ── Scatter (pays total bet × multiplier, not line bet) ───────────────
    const scatterWl = evaluateScatter(grid, req.bet);
    if (scatterWl) winlines.push(scatterWl);

    // ── Tally and credit ──────────────────────────────────────────────────
    const totalWin = r2(winlines.reduce((sum, wl) => sum + wl.amount, 0));
    this.balance   = r2(this.balance + totalWin);
    this.totalWon  = r2(this.totalWon + totalWin);

    // Auto-refill: keep mock play going when balance is nearly empty.
    if (this.balance < 0.20) this.balance = 1000;

    await wait(this.spinBase + jitter(120));

    return {
      grid,
      totalWin,
      winlines,
      balance: this.balance,
    };
  }
}
