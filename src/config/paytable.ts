// Paytable config — DISPLAY ONLY.
//
// Principle 1: the client does NOT evaluate. The numbers below are shown in
// the help/paytable tab so players can read what the server already decided.
// Keep them in sync with the server's paytable; the server stays authoritative.

import type { SymbolId } from './gameConfig';

export interface SymbolPayout {
  id: SymbolId;
  /** Multipliers (× line bet) per match length. */
  payouts: Partial<Record<3 | 4 | 5, number>>;
  label?: string;
}

export interface PaytableConfig {
  /** Number of paylines / ways. Display string, e.g. "20" or "243 ways". */
  lines: string;
  /** Certified theoretical Return To Player, expressed as a fraction (0–1). */
  rtp: number;
  /** Theoretical maximum win, expressed as multiple of total bet. */
  theoreticalMaxWin: number;
  /** Platform-imposed cap, in currency units. */
  platformMaxWin: number;
  symbols: SymbolPayout[];
}

export const PAYTABLE: PaytableConfig = {
  lines: '20',
  // "POPULAR-SLOT" LDW profile: RTP ~97.0% (exact-enumeration tuned), hit
  // frequency ~41% and sigma/bet ~4.1 (MEDIUM). Low symbols pay tiny 3-of-a-kinds
  // so most wins are sub-bet ("losses disguised as wins"); the return is
  // back-loaded into a steep, rare top tail.
  rtp: 0.970,
  // Single-payline ceiling: WILD 5x = 7415 line-bet units = 371× total bet
  // (multi-line spins can stack higher).
  theoreticalMaxWin: 371,
  platformMaxWin: 250000,
  symbols: [
    { id: 'wild',    label: 'Wild',                 payouts: { 3: 116, 4: 799, 5: 7415 } },
    { id: 'seven',   label: 'Seven',                payouts: { 3: 52,  4: 328, 5: 4277 } },
    { id: 'bar',     label: 'Bar',                  payouts: { 3: 28,  4: 122, 5: 670  } },
    { id: 'bell',    label: 'Bell',                 payouts: { 3: 17,  4: 67,  5: 309  } },
    { id: 'plum',    label: 'Plum',                 payouts: { 3: 9,   4: 34,  5: 155  } },
    { id: 'cherry',  label: 'Cherry',               payouts: { 3: 6,   4: 26,  5: 135  } },
    { id: 'orange',  label: 'Orange',               payouts: { 3: 5,   4: 22,  5: 113  } },
    { id: 'lemon',   label: 'Lemon',                payouts: { 3: 5,   4: 18,  5: 93   } },
    // Scatter pays no line credits — 3 Scatters anywhere awards 10 Free Spins.
    { id: 'scatter', label: 'Scatter (Free Spins)', payouts: {} },
  ],
};
