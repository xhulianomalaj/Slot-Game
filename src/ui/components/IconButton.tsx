import type { ComponentChildren, JSX } from 'preact';

export function IconButton({
  ariaLabel,
  children,
  onClick,
  active,
  disabled,
  testId,
}: {
  ariaLabel: string;
  children: ComponentChildren;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  testId?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`icon-btn ${active ? 'active' : ''}`.trim()}
      aria-label={ariaLabel}
      aria-pressed={active ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
