import type { SpeedMode } from '@/state/UIStore';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';

const MODES: Array<{ id: SpeedMode; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'turbo', label: 'Turbo' },
  { id: 'superTurbo', label: 'Super' },
];

export const SpeedPill = observer(() => {
  const { ui } = useStores();
  return (
    <div class="speed-pill" role="radiogroup" aria-label="Spin speed" data-testid="speed-pill">
      {MODES.map((m) => (
        <button
          type="button"
          key={m.id}
          class={ui.speed === m.id ? 'active' : ''}
          aria-pressed={ui.speed === m.id}
          data-testid={`speed-${m.id}`}
          onClick={() => ui.setSpeed(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
});
