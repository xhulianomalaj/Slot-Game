import type { SpeedMode } from '@/state/UIStore';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';

const CYCLE: SpeedMode[] = ['normal', 'turbo', 'superTurbo'];
const LABEL: Record<SpeedMode, string> = {
  normal: 'Normal',
  turbo: 'Turbo',
  superTurbo: 'Super',
};

export const SpeedPill = observer(() => {
  const { ui } = useStores();
  // CYCLE always contains every SpeedMode value so the index is always valid
  const next = CYCLE[(CYCLE.indexOf(ui.speed) + 1) % CYCLE.length] as SpeedMode;
  return (
    <button
      type="button"
      class={`speed-pill speed-pill--${ui.speed}`}
      aria-label={`Spin speed: ${LABEL[ui.speed]}. Click to change.`}
      data-testid="speed-pill"
      onClick={() => ui.setSpeed(next)}
    >
      {LABEL[ui.speed]}
    </button>
  );
});
