import type { ComponentChildren, JSX } from 'preact';

export function Chip({
  label,
  children,
  valueClass = '',
  testId,
}: {
  label: string;
  children: ComponentChildren;
  valueClass?: string;
  testId?: string;
}): JSX.Element {
  return (
    <div class="chip" data-testid={testId}>
      <span class="chip-label">{label}</span>
      <span class={`chip-value ${valueClass}`.trim()}>{children}</span>
    </div>
  );
}
