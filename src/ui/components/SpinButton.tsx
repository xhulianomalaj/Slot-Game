import { observer } from '@/ui/hooks/useObserver';
import { useFSM, useSound, useStores } from '@/ui/hooks/useStores';
import { IconPlay, IconStop } from './Icons';

export const SpinButton = observer(() => {
  const { ui, balance, modals } = useStores();
  const fsm = useFSM();
  const sound = useSound();

  // ── Free spins "Start" mode ──────────────────────────────────────────────
  // The player must click once to begin the free-spins round.
  if (ui.freeSpinsAwaitingStart) {
    return (
      <button
        type="button"
        aria-label="Start free spins"
        class="spin"
        onClick={() => {
          sound.play('click');
          ui.setFreeSpinsAwaitingStart(false);
          void fsm.transition('spin');
        }}
        data-testid="spin"
        data-pixi-label="spin"
        data-state="start"
      >
        <IconPlay />
        <span class="spin-hint">Start</span>
      </button>
    );
  }

  // ── Free spins in-progress: fully locked ────────────────────────────────
  // Button stays disabled for the entire free-spins round; speed pill
  // is the only way to accelerate.
  if (ui.isFreeSpins) {
    return (
      <button
        type="button"
        aria-label="Free spins in progress"
        class="spin"
        disabled
        data-testid="spin"
        data-pixi-label="spin"
        data-state="spin"
      >
        <IconPlay />
        <span class="spin-hint">Spin</span>
      </button>
    );
  }

  // ── Normal play ──────────────────────────────────────────────────────────
  const onClick = () => {
    if (ui.isAutospinning && ui.spinning) {
      ui.stopAutospin();
      return;
    }
    if (ui.spinning) {
      if (ui.stopEnabled) {
        ui.setStopEnabled(false);
        fsm.skip();
      }
    } else {
      if (modals.stack.length > 0) return;
      sound.play('click');
      void fsm.transition('spin');
    }
  };

  const disabled =
    (!ui.spinning && !ui.spinEnabled && !ui.isAutospinning) ||
    ui.autospinStopping ||
    (ui.spinning && !ui.stopEnabled && !ui.isAutospinning) ||
    (!ui.spinning && !ui.isAutospinning && balance.balance < balance.bet);

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
