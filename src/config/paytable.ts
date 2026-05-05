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
  /** Theoretical maximum win, expressed as multiple of total bet. */
  theoreticalMaxWin: number;
  /** Platform-imposed cap, in currency units. */
  platformMaxWin: number;
  symbols: SymbolPayout[];
}

export const PAYTABLE: PaytableConfig = {
  lines: '20',
  theoreticalMaxWin: 5000,
  platformMaxWin: 250000,
  symbols: [
    { id: 'seven', label: 'Seven', payouts: { 3: 50, 4: 200, 5: 1000 } },
    { id: 'bar', label: 'Bar', payouts: { 3: 25, 4: 100, 5: 500 } },
    { id: 'bell', label: 'Bell', payouts: { 3: 15, 4: 60, 5: 250 } },
    { id: 'cherry', label: 'Cherry', payouts: { 3: 10, 4: 40, 5: 150 } },
    { id: 'plum', label: 'Plum', payouts: { 3: 8, 4: 30, 5: 100 } },
    { id: 'orange', label: 'Orange', payouts: { 3: 5, 4: 20, 5: 60 } },
    { id: 'lemon', label: 'Lemon', payouts: { 3: 5, 4: 15, 5: 50 } },
    { id: 'wild', label: 'Wild', payouts: { 3: 100, 4: 500, 5: 2500 } },
    { id: 'scatter', label: 'Scatter', payouts: { 3: 5, 4: 20, 5: 100 } },
  ],
};
