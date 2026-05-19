// Wire types — shapes that cross the network and layer boundaries.
//
// Rule: the client does NOT compute wins, does NOT know the paytable, does
// NOT evaluate anything. The server returns a fully resolved SpinResponse;
// the client plays it back. Anything the view needs to render the round
// must come over the wire.

export type SymbolId = string;
export type Grid = SymbolId[][]; // [reel][row]

export interface SpinRequest {
  bet: number;
  sessionId?: string;
  /** True during free spins — the server should not charge the bet. */
  isFreeSpins?: boolean;
}

export interface Winline {
  lineId: number;
  symbolId: SymbolId;
  matchCount: number;
  amount: number;
  // Server-provided cell positions — client renders, does not compute.
  positions: Array<{ reel: number; row: number }>;
}

export interface SpinResponse {
  /** Final grid of symbols to show. */
  grid: Grid;
  /** Total credit to the player this round. */
  totalWin: number;
  /** Winning lines as the server resolved them. */
  winlines: Winline[];
  /** Optional: reels the view should visually tease. Server-directed. */
  teasingReels?: number[];
  /** Optional: the round triggered a bonus game. */
  bonus?: { id: string; payload: unknown };
  /**
   * Number of free spins awarded this round (scatter trigger or bonus buy).
   * Absent / 0 means no free spins were triggered.
   */
  freeSpinsAwarded?: number;
  /**
   * Authoritative POST-WIN balance — the wallet figure the player will see
   * once the round resolves, with the bet already debited and the win
   * already credited. The client does NOT add `totalWin` on top of this.
   *
   * If your server returns a pre-win figure, wrap it in your custom
   * NetworkManager so it returns post-win to the client.
   */
  balance: number;
}

export interface SessionRequest {
  /** Opaque token from the lobby (query param, postMessage, etc.). Optional for dev. */
  token?: string;
}

export interface SessionResponse {
  sessionId: string;
  /** Authoritative opening balance. */
  balance: number;
  /** ISO currency code — shown in the HUD. */
  currency: string;
  /** Bets the player is allowed to set. */
  availableBets: number[];
  /** Default bet for this session. */
  defaultBet: number;
  /** Grid dimensions — server may override client config. */
  columns: number;
  rows: number;
}
