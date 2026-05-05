import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { ModalSpec } from '@/state/ModalsStore';
import { iconKindClass, ModalIconView } from './icons';

export interface ModalProps {
  spec: ModalSpec;
  stacked: boolean;
  onResolve: (id: string, value: unknown) => void;
  onDismiss: (id: string) => void;
}

export function Modal({ spec, stacked, onResolve, onDismiss }: ModalProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (stacked) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusTarget = panel?.querySelector<HTMLElement>('.sp-modal__btn--primary, .sp-modal__btn');
    focusTarget?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [stacked]);

  const buttons = spec.buttons ?? [{ label: 'OK', kind: 'primary' as const }];

  return (
    <div
      class="sp-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={spec.title ? `${spec.id}-title` : undefined}
      data-stacked={stacked ? '1' : undefined}
      ref={panelRef}
    >
      {spec.icon && (
        <div class={`sp-modal__icon ${iconKindClass(spec.icon)}`}>
          <ModalIconView icon={spec.icon} />
        </div>
      )}
      {spec.title && (
        <h2 id={`${spec.id}-title`} class="sp-modal__title">
          {spec.title}
        </h2>
      )}
      {spec.description && <div class="sp-modal__desc">{spec.description}</div>}
      <div class="sp-modal__buttons">
        {buttons.map((b, i) => (
          <button
            key={`${spec.id}-${i}`}
            type="button"
            class={`sp-modal__btn ${b.kind ? `sp-modal__btn--${b.kind}` : ''}`}
            onClick={() => (b.dismiss ? onDismiss(spec.id) : onResolve(spec.id, b.value))}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
