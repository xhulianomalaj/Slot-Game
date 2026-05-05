import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { Modal } from './Modal';
import './modals.css';

export const ModalsSlot = observer((): JSX.Element | null => {
  const { modals } = useStores();
  const stack = modals.stack;
  const top = stack[stack.length - 1];

  useEffect(() => {
    if (!top) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && top.dismissible !== false) {
        modals.dismiss(top.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [top, modals]);

  if (stack.length === 0) return null;

  const onBackdrop = () => {
    if (top && top.dismissible !== false) modals.dismiss(top.id);
  };

  return (
    <div class="sp-modal-host" data-testid="modals">
      <button type="button" class="sp-modal-backdrop" aria-label="Dismiss modal" onClick={onBackdrop} />
      {stack.map((spec, i) => (
        <Modal
          key={spec.id}
          spec={spec}
          stacked={i !== stack.length - 1}
          onResolve={(id, v) => modals.resolve(id, v)}
          onDismiss={(id) => modals.dismiss(id)}
        />
      ))}
    </div>
  );
});
