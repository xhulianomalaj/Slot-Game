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
// Multipliers × line bet. "POPULAR-SLOT" LDW profile (experiment/high-volatility):
// every symbol pays 3-/4-/5-of-a-kind, but low symbols pay TINY 3x (a sub-bet
// "win" — bet 20 line-units, win ~6), so most wins are losses-disguised-as-wins.
// The return is back-loaded into a steep top tail (rare Wild/Seven 4x/5x). Net:
// ~97.0% RTP (exact-enumeration tuned), ~41% hit frequency, sigma/bet ~4.1
// (MEDIUM). ~53% of all wins pay LESS than the bet. Scatter pays no line
// credits; it only triggers Free Spins.
const PAYOUTS: Record<string, Partial<Record<3 | 4 | 5, number>>> = {
  wild:    { 3: 116, 4: 799, 5: 7415 },
  seven:   { 3: 52,  4: 328, 5: 4277 },
  bar:     { 3: 28,  4: 122, 5: 670  },
  bell:    { 3: 17,  4: 67,  5: 309  },
  plum:    { 3: 9,   4: 34,  5: 155  },
  cherry:  { 3: 6,   4: 26,  5: 135  },
  orange:  { 3: 5,   4: 22,  5: 113  },
  lemon:   { 3: 5,   4: 18,  5: 93   },
};

const WILD    = 'wild';
const SCATTER = 'scatter';
const LINE_COUNT = 20;

// Free-spins mechanics — mirror engine/evaluator.py.
// Exactly 3 scatters trigger 10 free spins; 4th/5th scatter is replaced with
// CHERRY in-place so the response never shows more than 3 scatter symbols.
const FREE_SPINS_COUNT = 10;
const SCATTER_TRIGGER  = 3;
const SCATTER_FILL     = 'cherry';

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

// ─── Reel strips (certified fixed reelset) ────────────────────────────────────
// The reel ORDER is FIXED and certified — it is NOT reshuffled per session — so
// the RTP is a single deterministic number: 96.98% (exact). Each strip is 33
// stops with exactly 1 scatter and 1–2 wilds; the symbol composition matches the
// backend exactly. This array MUST stay byte-identical to the backend's
// REEL_STRIPS (slot-backend/engine/reel_strips.py) so the mock and the server
// evaluate the same reels. The tiny low-symbol 3x payouts (see PAYOUTS) keep
// ~54% of wins sub-bet (losses-disguised-as-wins); hit frequency ~42%, MEDIUM
// volatility (sigma/bet ~4.3).
const REEL_STRIPS: readonly (readonly string[])[] = [
  ['lemon', 'bar', 'orange', 'bell', 'seven', 'seven', 'bell', 'cherry', 'lemon', 'plum', 'scatter', 'orange', 'lemon', 'bar', 'cherry', 'wild', 'cherry', 'cherry', 'bell', 'orange', 'lemon', 'lemon', 'plum', 'bar', 'plum', 'cherry', 'bell', 'orange', 'orange', 'lemon', 'plum', 'cherry', 'cherry'],
  ['lemon', 'bell', 'bell', 'bell', 'cherry', 'orange', 'bar', 'plum', 'orange', 'lemon', 'cherry', 'orange', 'scatter', 'orange', 'seven', 'lemon', 'plum', 'bar', 'cherry', 'seven', 'bar', 'lemon', 'wild', 'lemon', 'plum', 'bell', 'cherry', 'lemon', 'orange', 'plum', 'wild', 'cherry', 'cherry'],
  ['cherry', 'cherry', 'bar', 'orange', 'bell', 'orange', 'lemon', 'plum', 'orange', 'bell', 'plum', 'bell', 'lemon', 'cherry', 'plum', 'bar', 'bell', 'lemon', 'lemon', 'cherry', 'seven', 'cherry', 'lemon', 'bar', 'lemon', 'cherry', 'plum', 'scatter', 'wild', 'seven', 'orange', 'cherry', 'orange'],
  ['bar', 'plum', 'orange', 'plum', 'lemon', 'orange', 'lemon', 'seven', 'cherry', 'bell', 'wild', 'bell', 'orange', 'bar', 'lemon', 'seven', 'lemon', 'cherry', 'bar', 'cherry', 'scatter', 'lemon', 'cherry', 'bell', 'plum', 'orange', 'plum', 'wild', 'cherry', 'bell', 'cherry', 'orange', 'lemon'],
  ['cherry', 'plum', 'scatter', 'plum', 'orange', 'orange', 'cherry', 'bar', 'seven', 'bar', 'wild', 'cherry', 'cherry', 'orange', 'lemon', 'cherry', 'lemon', 'lemon', 'cherry', 'lemon', 'bell', 'bell', 'bell', 'orange', 'orange', 'lemon', 'cherry', 'plum', 'lemon', 'bar', 'plum', 'lemon', 'cherry'],
];

// ─── Win evaluation ───────────────────────────────────────────────────────────
function evaluatePayline(
  grid: string[][],
  payline: readonly number[],
  lineBet: number,
  lineId: number,
): Winline | null {
  // Read the symbol at each reel for this payline
  const symbols = payline.map((row, reel) => grid[reel]![row]!);

  // A line pays the BETTER of two candidate combinations (standard slot rule,
  // mirrors slot-backend/engine/evaluator.py):
  //   1. Substituted win — first non-wild/scatter symbol, wilds extend the run.
  //   2. Pure-wild prefix — leading wilds paying as WILD in their own right.
  let bestSymbol: string | null = null;
  let bestCount = 0;
  let bestMultiplier = 0;

  // Candidate 1 — substituted symbol.
  const base = symbols.find((s) => s !== WILD && s !== SCATTER);
  if (base) {
    let count = 0;
    for (const s of symbols) {
      if (s === base || s === WILD) count++;
      else break;
    }
    if (count >= 3) {
      const m = PAYOUTS[base]?.[Math.min(count, 5) as 3 | 4 | 5];
      if (m && m > bestMultiplier) {
        bestSymbol = base;
        bestCount = Math.min(count, 5);
        bestMultiplier = m;
      }
    }
  }

  // Candidate 2 — pure-wild prefix (also covers an all-wild line).
  let wildCount = 0;
  for (const s of symbols) {
    if (s === WILD) wildCount++;
    else break;
  }
  if (wildCount >= 3) {
    const m = PAYOUTS[WILD]?.[Math.min(wildCount, 5) as 3 | 4 | 5];
    if (m && m > bestMultiplier) {
      bestSymbol = WILD;
      bestCount = Math.min(wildCount, 5);
      bestMultiplier = m;
    }
  }

  if (!bestSymbol || bestCount < 3) return null;

  const matchCount = bestCount as 3 | 4 | 5;
  const amount = r2(lineBet * bestMultiplier);
  const positions = Array.from({ length: matchCount }, (_, reel) => ({
    reel,
    row: payline[reel]!,
  }));

  return { lineId, symbolId: bestSymbol, matchCount, amount, positions };
}

function findScatterPositions(grid: string[][]): Array<{ reel: number; row: number }> {
  const positions: Array<{ reel: number; row: number }> = [];
  for (let reel = 0; reel < grid.length; reel++) {
    for (let row = 0; row < grid[reel]!.length; row++) {
      if (grid[reel]![row] === SCATTER) positions.push({ reel, row });
    }
  }
  return positions;
}

/**
 * Cap visible scatters at SCATTER_TRIGGER. Any extras are replaced in-place
 * with SCATTER_FILL (cherry) so the response never shows more than 3 scatters.
 * Returns the (possibly trimmed) list of scatter positions.
 */
function capScatters(grid: string[][]): Array<{ reel: number; row: number }> {
  const positions = findScatterPositions(grid);
  for (let i = SCATTER_TRIGGER; i < positions.length; i++) {
    const { reel, row } = positions[i]!;
    grid[reel]![row] = SCATTER_FILL;
  }
  return positions.slice(0, SCATTER_TRIGGER);
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

    // Use the fixed certified reelset (fresh copies), cycling if columns > 5
    this.reelStrips = Array.from(
      { length: opts.columns },
      (_, i) => [...REEL_STRIPS[i % REEL_STRIPS.length]!],
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
    if (!req.isFreeSpins && req.bet > this.balance) {
      throw new Error('[MockServer] Insufficient balance');
    }

    // Debit the bet only for paid spins; free spins are already paid for.
    if (!req.isFreeSpins) {
      this.balance      = r2(this.balance - req.bet);
      this.totalWagered = r2(this.totalWagered + req.bet);
    }
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

    // ── Cap scatters at 3, then evaluate ──────────────────────────────────
    // The engine guarantees the response never carries 4 or 5 scatters — any
    // extras are replaced with cherry in-place. Trigger fires at exactly 3.
    const scatterPositions = capScatters(grid);
    const scatterCount = scatterPositions.length;

    const winlines: Winline[] = [];
    let freeSpinsAwarded = 0;

    if (scatterCount >= SCATTER_TRIGGER) {
      // ── Scatter trigger: award free spins, discard all payline wins ────
      // A zero-amount scatter winline is returned so the frontend can glow
      // the scatter symbols without showing a monetary value.
      winlines.push({
        lineId: 0,
        symbolId: SCATTER,
        matchCount: scatterCount as 3,
        amount: 0,
        positions: scatterPositions,
      });
      freeSpinsAwarded = FREE_SPINS_COUNT;
    } else {
      // ── No trigger: evaluate paylines normally ────────────────────────
      const lineBet = r2(req.bet / LINE_COUNT);
      for (let i = 0; i < PAYLINES.length; i++) {
        const wl = evaluatePayline(grid, PAYLINES[i]!, lineBet, i + 1);
        if (wl) winlines.push(wl);
      }
    }

    // ── Teasing reels: exactly 2 scatters = anticipation signal ──────────
    const teasingReels: number[] = scatterCount === 2
      ? [0, 1, 2, 3, 4].filter((r) => !scatterPositions.some((p) => p.reel === r))
      : [];

    // ── Tally and credit ──────────────────────────────────────────────────
    const totalWin = r2(winlines.reduce((sum, wl) => sum + wl.amount, 0));
    this.balance   = r2(this.balance + totalWin);
    this.totalWon  = r2(this.totalWon + totalWin);

    // Auto-refill: keep mock play going when balance is nearly empty.
    if (this.balance < 0.20) this.balance = 1000;

    await wait(this.spinBase + jitter(120));

    const resp: SpinResponse = {
      grid,
      totalWin,
      winlines,
      teasingReels,
      balance: this.balance,
    };
    if (freeSpinsAwarded > 0) resp.freeSpinsAwarded = freeSpinsAwarded;
    return resp;
  }

  async buyBonus(req: SpinRequest): Promise<SpinResponse> {
    // Debit the buy cost from the server's authoritative balance, then build
    // a guaranteed 3-scatter grid by forcing scatter on reels 0, 2, 4.
    this.balance = r2(this.balance - r2(req.bet * 10)); // 10 = BUY_BONUS_MULTIPLIER (fair value)
    const grid: string[][] = this.reelStrips.map((strip, reel) => {
      if (reel === 0 || reel === 2 || reel === 4) {
        // Force scatter into row 1 (middle) for this reel
        return [
          strip[Math.floor(Math.random() * strip.length)]!,
          SCATTER,
          strip[Math.floor(Math.random() * strip.length)]!,
        ];
      }
      const stop = Math.floor(Math.random() * strip.length);
      return [
        strip[stop]!,
        strip[(stop + 1) % strip.length]!,
        strip[(stop + 2) % strip.length]!,
      ];
    });

    // No scatter payout on a bonus buy — the cost IS the price for the free
    // spins. Crediting a scatter win on top would cause a net deduction smaller
    // than the advertised cost and make the balance visibly jump back up.
    this.roundsPlayed++;

    await wait(this.spinBase + jitter(120));

    return {
      grid,
      totalWin: 0,
      winlines: [],
      teasingReels: [],
      freeSpinsAwarded: 10,
      balance: this.balance,
    };
  }
}
