// MockNetworkManager — offline fake server. Produces plausible responses
// so the client can render something during development. In production,
// swap for HttpNetworkManager / WebSocketNetworkManager / your custom
// adapter — the shapes stay the same; this class goes away.
//
// The mock is NOT the math. Do not extend it with paytable logic — the
// client has no business evaluating wins. For reproducible local math,
// run a real server in dev and point VITE_API_URL at it.
//
// WIN SIMULATION (dev only): ~1-in-3 spins trigger a fake win so you can
// see the win-show flow without a real server. The win is assembled here
// exactly as a real server would return it — grid + winlines + totalWin.

import type { SessionRequest, SessionResponse, SpinRequest, SpinResponse, Winline } from '@/domain/types';
import type { NetworkManager } from './types';

// Mirrors the display paytable — mock server uses these to compute a fake payout.
const MOCK_PAYOUTS: Record<string, Partial<Record<3 | 4 | 5, number>>> = {
  seven:   { 3: 50,  4: 200, 5: 1000 },
  bar:     { 3: 25,  4: 100, 5: 500  },
  bell:    { 3: 15,  4: 60,  5: 250  },
  cherry:  { 3: 10,  4: 40,  5: 150  },
  plum:    { 3: 8,   4: 30,  5: 100  },
  orange:  { 3: 5,   4: 20,  5: 60   },
  lemon:   { 3: 5,   4: 15,  5: 50   },
  wild:    { 3: 100, 4: 500, 5: 2500 },
};

export interface MockNetworkOptions {
  symbolIds: readonly string[];
  columns: number;
  rows: number;
  /** Simulated latency for session/spin, in ms. Defaults to realistic values. */
  latency?: { session?: number; spin?: number };
  /** Simulated starting balance. Server will be authoritative in real adapters. */
  startingBalance?: number;
}

export class MockNetworkManager implements NetworkManager {
  private balance: number;
  private readonly latency: { session: number; spin: number };

  constructor(private readonly opts: MockNetworkOptions) {
    this.balance = opts.startingBalance ?? 100;
    this.latency = {
      session: opts.latency?.session ?? 650,
      spin: opts.latency?.spin ?? 480,
    };
  }

  async session(_req: SessionRequest): Promise<SessionResponse> {
    await wait(this.latency.session + jitter(180));
    return {
      sessionId: `mock-${Math.random().toString(36).slice(2, 10)}`,
      balance: this.balance,
      currency: 'USD',
      availableBets: [0.2, 0.5, 1, 2, 5, 10, 25, 50, 100],
      defaultBet: 1,
      columns: this.opts.columns,
      rows: this.opts.rows,
    };
  }

  async spin(req: SpinRequest): Promise<SpinResponse> {
    await wait(this.latency.spin + jitter(120));
    this.balance = Math.max(0, this.balance - req.bet);

    const pickSymbol = (): string => {
      const ids = this.opts.symbolIds;
      const id = ids[Math.floor(Math.random() * ids.length)];
      if (id === undefined) throw new Error('[MockNetworkManager] symbolIds is empty');
      return id;
    };

    // ~1-in-3 spins produce a win so you can see the win-show flow in dev.
    const isWinSpin = Math.random() < 0.33;

    const grid = Array.from({ length: this.opts.columns }, () =>
      Array.from({ length: this.opts.rows }, pickSymbol),
    );

    let winlines: Winline[] = [];
    let totalWin = 0;

    if (isWinSpin) {
      // Pick a non-scatter winning symbol and how many reels it covers (3–5).
      const winSymbols = this.opts.symbolIds.filter((id) => id !== 'scatter');
      const symbolId = winSymbols[Math.floor(Math.random() * winSymbols.length)] ?? 'cherry';
      const matchCount = (Math.floor(Math.random() * 3) + 3) as 3 | 4 | 5; // 3, 4, or 5
      const winRow = Math.floor(Math.random() * this.opts.rows); // random row for the line

      // Stamp the winning symbol into the grid across the first `matchCount` reels.
      for (let reel = 0; reel < matchCount; reel++) {
        grid[reel]![winRow] = symbolId;
      }

      const multiplier = MOCK_PAYOUTS[symbolId]?.[matchCount] ?? 5;
      const amount = parseFloat((req.bet * multiplier).toFixed(2));
      totalWin = amount;
      this.balance = parseFloat((this.balance + totalWin).toFixed(2));

      const positions = Array.from({ length: matchCount }, (_, reel) => ({ reel, row: winRow }));
      winlines = [{ lineId: 1, symbolId, matchCount, amount, positions }];
    }

    return { grid, totalWin, winlines, balance: this.balance };
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => globalThis.setTimeout(r, ms));
}
function jitter(spread: number): number {
  return (Math.random() - 0.5) * spread * 2;
}
