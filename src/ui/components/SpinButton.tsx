import { observer } from '@/ui/hooks/useObserver';
import { useFSM, useSound, useStores } from '@/ui/hooks/useStores';
import { IconPlay, IconStop } from './Icons';

export const SpinButton = observer(() => {
  const { ui, balance, modals } = useStores();
  const fsm = useFSM();
  const sound = useSound();

  const onClick = () => {
    if (ui.isAutospinning && ui.spinning) {
      // Cancel autoplay while a spin round is in progress.
      ui.stopAutospin();
      return;
    }
    if (ui.spinning) {
      if (ui.stopEnabled) {
        // Disable button immediately - win animations must play out fully.
        ui.setStopEnabled(false);
        fsm.skip();
      }
    } else {
      if (modals.stack.length > 0) return;
      sound.play('click');
      void fsm.transition('spin');
    }
  };

  // Disabled when:
  //  • not spinning and spin isn’t allowed (balance / FSM guard)
  //  • stop was clicked — waiting for win animations to finish
  //  • autoplay is in the process of stopping
  const disabled =
    (!ui.spinning && !ui.spinEnabled && !ui.isAutospinning) ||
    ui.autospinStopping ||
    (ui.spinning && !ui.stopEnabled && !ui.isAutospinning) ||
    (!ui.spinning && !ui.isAutospinning && balance.balance < balance.bet);

  // Show stop icon only while a spin is in progress (autoplay or manual stop-enabled).
  const isStopState = ui.spinning && (ui.isAutospinning || ui.stopEnabled);

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
      {isStopState ? <IconStop /> : <IconPlay />}
      {ui.isAutospinning && (
        <span class="spin-autospin-badge" data-testid="autospin-remaining">
          {ui.autospinRemaining}
        </span>
      )}
      <span class="spin-hint">{isStopState ? 'Stop' : 'Spin'}</span>
    </button>
  );
});
