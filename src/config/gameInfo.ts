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
    body: 'The highest-paying symbol is the Wild (116×–7415× line bet) followed by Seven (52×–4277× line bet). Mid-range symbols are Bar and Bell. Lower-value symbols are Plum, Cherry, Orange, and Lemon — their 3-of-a-kind pays only a little, so many wins are smaller than your bet. Higher match counts (4 or 5 of a kind) pay dramatically more than 3 of a kind. All multipliers in the paytable are expressed in units of line bet (= total bet ÷ 20).',
  },
  {
    title: 'Wild symbol',
    body: 'The Wild substitutes for any symbol except Scatter to complete a winning payline. For example, two Sevens followed by a Wild counts as three Sevens. Wilds only extend a run from the left — they cannot fill a gap in the middle of a sequence.',
  },
  {
    title: 'Scatter symbol',
    body: 'Scatters do not pay line credits and do not need to land on a payline. Their only role is to trigger the Free Spins bonus: 3 Scatters anywhere on the grid awards 10 Free Spins. When 2 Scatters have landed, the remaining reels are highlighted to build anticipation.',
  },
  {
    title: 'Free Spins bonus',
    body: 'Landing 3 Scatters anywhere awards 10 Free Spins. During Free Spins your balance is never deducted — every spin is free. All wins accumulate in a Free Spins win total shown in the corner of the screen. Landing 3 Scatters again during a Free Spin re-triggers the feature and adds 10 extra spins to your remaining count. When all spins are used, the total winnings are credited to your balance.',
  },
  {
    title: 'Return to player (RTP)',
    body: 'The theoretical Return to Player (RTP) is ~97.0%. Volatility is MEDIUM (the standard deviation of per-spin payout is approximately 4.1× the bet). Wins land fairly often (hit frequency ≈ 41%), but most are small — over half pay less than your bet — so the balance tends to drift down between occasional larger wins. From time to time a 5×–20× win lands, and more rarely a big 100×+ win. The largest single-payline win is Wild 5-of-a-kind = 371× total bet; multi-line spins can stack higher.',
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
