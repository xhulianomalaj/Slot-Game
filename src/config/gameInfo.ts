// Game info blocks shown in the menu's "Game info" tab.
// Each game owner edits this file to describe its mechanics.

export interface InfoBlock {
  title: string;
  body: string;
}

export const GAME_INFO: InfoBlock[] = [
  {
    title: 'How to play',
    body: 'Choose your bet using the + and − buttons, then press SPIN. The reels spin and stop to reveal a 5×3 grid of symbols. Any matching combinations on the 20 active paylines are paid automatically and added to your balance.',
  },
  {
    title: 'Paylines',
    body: 'This game has 20 fixed paylines. Wins are awarded for 3, 4, or 5 matching symbols appearing consecutively from the leftmost reel. Paylines run in various patterns across the 3 rows — straight lines, V-shapes, zigzags, and more. All 20 lines are always active.',
  },
  {
    title: 'Symbol values',
    body: 'The highest-paying symbols are Seven (50×–1000× line bet) and Wild (100×–2500× line bet). Mid-range symbols are Bar, Bell, and Cherry. Lower-value symbols are Plum, Orange, and Lemon. Higher match counts (4 or 5 of a kind) pay significantly more than 3 of a kind.',
  },
  {
    title: 'Wild symbol',
    body: 'The Wild substitutes for any symbol except Scatter to complete a winning payline. For example, two Sevens followed by a Wild counts as three Sevens. Wilds only extend a run from the left — they cannot fill a gap in the middle of a sequence.',
  },
  {
    title: 'Scatter symbol',
    body: 'Scatters pay regardless of position on the reels — they do not need to be on a payline. Land 3 Scatters anywhere for 5× your total bet, 4 Scatters for 20×, or 5 Scatters for 100× your total bet. When 2 Scatters have landed, the remaining reels are highlighted to build anticipation.',
  },
  {
    title: 'Spin speed',
    body: 'Use the speed button on the bottom right to cycle between Normal, Turbo, and Super speed. Turbo and Super shorten the reel spin and stop animations so rounds resolve faster. Your winnings are identical at any speed.',
  },
  {
    title: 'Autospin',
    body: 'Press the Autospin button (↻) to spin automatically. Autospin stops after 10 rounds or when your balance runs out. You can cancel at any time by pressing the button again.',
  },
  {
    title: 'Disconnection policy',
    body: 'If your connection drops during a spin, the round is preserved by the server. When you reconnect and reload the game, your spin result and any winnings will be waiting for you.',
  },
];

export const TURBO_THREE_WAY = true; // false → only Normal/Turbo in settings
