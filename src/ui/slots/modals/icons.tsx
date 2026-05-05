import type { JSX } from 'preact';
import type { ModalIcon } from '@/state/ModalsStore';

const base = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.8,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
};

export function ModalIconView({ icon }: { icon: ModalIcon }): JSX.Element {
  if (typeof icon === 'object' && 'src' in icon) {
    return <img class="sp-modal__icon-img" src={icon.src} alt="" />;
  }
  switch (icon) {
    case 'warning':
      return (
        <svg {...base} role="img" aria-label="Warning">
          <title>Warning</title>
          <path d="M12 3l10 18H2L12 3z" />
          <path d="M12 10v5M12 18v.01" />
        </svg>
      );
    case 'error':
      return (
        <svg {...base} role="img" aria-label="Error">
          <title>Error</title>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </svg>
      );
    case 'success':
      return (
        <svg {...base} role="img" aria-label="Success">
          <title>Success</title>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l3 3 5-6" />
        </svg>
      );
    default:
      return (
        <svg {...base} role="img" aria-label="Information">
          <title>Information</title>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8v.01" />
        </svg>
      );
  }
}

export function iconKindClass(icon: ModalIcon | undefined): string {
  if (!icon || typeof icon === 'object') return 'sp-modal__icon--info';
  return `sp-modal__icon--${icon}`;
}
