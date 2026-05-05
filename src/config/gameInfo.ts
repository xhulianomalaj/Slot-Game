// Game info blocks shown in the menu's "Game info" tab.
// Each game owner edits this file to describe its mechanics.

export interface InfoBlock {
  title: string;
  body: string;
}

export const GAME_INFO: InfoBlock[] = [
  {
    title: 'How to play',
    body: 'Set your bet and press Spin. Wins are paid for matching symbols on active paylines from left to right.',
  },
  {
    title: 'Wild symbol',
    body: 'Wild substitutes for any symbol except Scatter to complete winning combinations.',
  },
  {
    title: 'Scatter symbol',
    body: 'Three or more Scatters anywhere on the reels trigger Free Spins.',
  },
  {
    title: 'Free Spins',
    body: 'During Free Spins, all wins are awarded with the same triggering bet. Free Spins cannot be retriggered.',
  },
  {
    title: 'Disconnection policy',
    body: 'In the event of a disconnection, the current round is preserved by the server and resumes when you return.',
  },
];

export const TURBO_THREE_WAY = true; // false → only Normal/Turbo in settings
