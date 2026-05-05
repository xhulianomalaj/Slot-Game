// Minimal inline SVG icons — no icon-font dependency, no bundle cost.
// Each icon is a square 24x24 viewBox; color = currentColor.

import type { JSX } from 'preact';

type IconProps = JSX.SVGAttributes<SVGSVGElement> & { title?: string };

const I =
  (d: string, title = 'Icon') =>
  (p: IconProps) => {
    const { title: t = title, ...rest } = p;
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        role="img"
        aria-label={t}
        {...rest}
      >
        <title>{t}</title>
        <path d={d} />
      </svg>
    );
  };

export const IconPlay = I('M8 5v14l11-7z', 'Play');
export const IconPause = I('M6 4h4v16H6zM14 4h4v16h-4z', 'Pause');
export const IconSkip = I('M5 4l10 8-10 8V4zM17 4h2v16h-2z', 'Skip');
export const IconMinus = I('M5 12h14', 'Decrease');
export const IconPlus = I('M12 5v14M5 12h14', 'Increase');
export const IconSoundOn = I('M3 9v6h4l5 5V4L7 9H3zM16 8a5 5 0 010 8', 'Sound on');
export const IconSoundOff = I('M3 9v6h4l5 5V4L7 9H3zM17 9l6 6M23 9l-6 6', 'Sound off');
export const IconInfo = I('M12 2a10 10 0 100 20 10 10 0 000-20zM12 8v4M12 16h.01', 'Information');
export const IconMenu = I('M4 6h16M4 12h16M4 18h16', 'Menu');
export const IconClose = I('M6 6l12 12M18 6L6 18', 'Close');
export const IconBolt = I('M13 2L3 14h7l-1 8 10-12h-7l1-8z', 'Turbo');
export const IconRocket = I(
  'M5 19c2-2 4-4 7-4s5 2 7 4M14 10a4 4 0 11-8 0 4 4 0 018 0zM18 2l4 4-6 6-4-4 6-6z',
  'Super turbo',
);
export const IconRepeat = I('M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3', 'Autoplay');
