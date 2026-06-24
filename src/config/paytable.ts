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
  // Certified ~96.9% by 5M-spin Monte Carlo against the production engine
  // (per-session reel shuffle gives ~±0.1% spread; see slot-backend/MATH_MODEL.md).
  rtp: 0.969,
  // Realistic max win. The paytable's combinatorial ceiling is 2580× total bet
  // (all 15 cells WILD → 20 lines × WILD 5x), but it is UNREACHABLE: reels 0/2/4
  // carry only one WILD each, so a 3-cell window can never show three wilds.
  // Observed ceiling across multi-million-spin certification runs is ~175–220×.
  theoreticalMaxWin: 220,
  platformMaxWin: 250000,
  symbols: [
    { id: 'wild',    label: 'Wild',                 payouts: { 3: 103, 4: 516, 5: 2580 } },
    { id: 'seven',   label: 'Seven',                payouts: { 3: 52,  4: 218, 5: 1032 } },
    { id: 'bar',     label: 'Bar',                  payouts: { 3: 26,  4: 103, 5: 516  } },
    { id: 'bell',    label: 'Bell',                 payouts: { 3: 17,  4: 65,  5: 258  } },
    { id: 'cherry',  label: 'Cherry',               payouts: { 3: 10,  4: 44,  5: 159  } },
    { id: 'plum',    label: 'Plum',                 payouts: { 3: 9,   4: 30,  5: 103  } },
    { id: 'orange',  label: 'Orange',               payouts: { 3: 5,   4: 21,  5: 65   } },
    { id: 'lemon',   label: 'Lemon',                payouts: { 3: 5,   4: 16,  5: 52   } },
    // Scatter pays no line credits — 3+ Scatters anywhere awards 10 Free Spins.
    { id: 'scatter', label: 'Scatter (Free Spins)', payouts: {} },
  ],
};
