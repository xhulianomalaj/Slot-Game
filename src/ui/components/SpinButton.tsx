import { observer } from '@/ui/hooks/useObserver';
import { useFSM, useStores } from '@/ui/hooks/useStores';
import { IconPlay, IconSkip } from './Icons';

export const SpinButton = observer(() => {
  const { ui, balance } = useStores();
  const fsm = useFSM();

  const onClick = () => {
    if (ui.spinning) {
      if (ui.isAutospinning) {
        // Stop autoplay after this spin; animation finishes naturally.
        ui.stopAutospin();
      } else {
        // Manual spin: skip/fast-forward the animation.
        fsm.skip();
      }
    } else {
      void fsm.transition('spin');
    }
  };

  // Disabled when: no spin is possible at all, OR stop was already requested
  // and we're waiting for the current animation to finish.
  const disabled =
    (!ui.spinning && !ui.spinEnabled && !ui.isAutospinning) ||
    ui.autospinStopping ||
    (!ui.spinning && balance.balance < balance.bet);

  const isStopState = ui.spinning;

  return (
    <button
      type="button"
      aria-label={isStopState ? 'Stop spin' : 'Spin'}
      class={`spin ${isStopState ? 'stop' : ''}`.trim()}
      disabled={disabled}
      onClick={onClick}
      data-testid="spin"
      data-pixi-label="spin"
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
