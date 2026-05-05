// Client game config — view shape and bet defaults.
//
// There is NO paytable and NO paylines here. That is server-owned math.
// The client only knows:
//   - how many reels/rows to render
//   - what symbol ids can appear (for the asset factory)
//   - what the starting balance / default bet are (UI display only; the
//     server is authoritative on balance)

export const GAME = {
  /** Display name shown in the header. */
  title: 'Slotplate',
  columns: 5,
  rows: 3,
  defaultBet: 1,
  startingBalance: 100,

  /** Symbol ids the server may send. Used to wire textures + factory. */
  symbolIds: ['cherry', 'lemon', 'orange', 'plum', 'bell', 'bar', 'seven', 'wild', 'scatter'] as const,
} as const;

export type SymbolId = (typeof GAME.symbolIds)[number];
