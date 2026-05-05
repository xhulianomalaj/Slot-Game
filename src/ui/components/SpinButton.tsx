import { observer } from '@/ui/hooks/useObserver';
import { useFSM, useStores } from '@/ui/hooks/useStores';
import { IconPlay, IconSkip } from './Icons';

export const SpinButton = observer(() => {
  const { ui } = useStores();
  const fsm = useFSM();

  const onClick = () => {
    if (ui.spinning) {
      fsm.skip();
    } else {
      void fsm.transition('spin');
    }
  };

  const disabled = !ui.spinning && !ui.spinEnabled && !ui.isAutospinning;
  const isStopState = ui.spinning;

  return (
    <button
      type="button"
      aria-label={isStopState ? 'Stop spin' : 'Spin'}
      class={`spin ${isStopState ? 'stop' : ''}`.trim()}
      disabled={disabled}
      onClick={onClick}
      data-testid="spin"
      data-state={isStopState ? 'stop' : 'spin'}
    >
      {isStopState ? <IconSkip /> : <IconPlay />}
      {ui.isAutospinning && (
        <span class="spin-autospin-badge" data-testid="autospin-remaining">
          {ui.autospinRemaining}
        </span>
      )}
      <span class="spin-hint">{isStopState ? 'Stop' : 'Spin'}</span>
    </button>
  );
});
