import type { ComponentChildren, JSX } from 'preact';

export function IconButton({
  ariaLabel,
  children,
  onClick,
  active,
  disabled,
  testId,
  extraProps,
}: {
  ariaLabel: string;
  children: ComponentChildren;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  testId?: string;
  extraProps?: Record<string, string>;
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
      {...extraProps}
    >
      {children}
    </button>
  );
}
