import type { JSX } from 'preact';

const props = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.8,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
};

export const SoundOnIcon = (): JSX.Element => (
  <svg {...props} role="img" aria-label="Sound on">
    <title>Sound on</title>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M16 8a5 5 0 0 1 0 8" />
    <path d="M19 5a9 9 0 0 1 0 14" />
  </svg>
);

export const SoundOffIcon = (): JSX.Element => (
  <svg {...props} role="img" aria-label="Sound off">
    <title>Sound off</title>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M17 9l5 6M22 9l-5 6" />
  </svg>
);

export const InfoIcon = (): JSX.Element => (
  <svg {...props} role="img" aria-label="Information">
    <title>Information</title>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.01" />
  </svg>
);

export const ExitIcon = (): JSX.Element => (
  <svg {...props} role="img" aria-label="Exit">
    <title>Exit</title>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
    <path d="M16 16l4-4-4-4M20 12H10" />
  </svg>
);
