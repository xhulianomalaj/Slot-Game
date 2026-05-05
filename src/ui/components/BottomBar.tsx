import { useT } from '@/i18n/useT';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { BuyBonus } from './BuyBonus';
import { IconButton } from './IconButton';
import { IconMinus, IconPlus, IconRepeat } from './Icons';
import { SpinButton } from './SpinButton';

// Hacksaw-style control cluster:
//
//   portrait   [BuyBonus]   [−  (SPIN)  +]   [Autospin]
//   landscape  stacked vertically on the right:  +
//                                              (SPIN)
//                                                −
//
// CSS owns the axis flip via .spin-cluster orientation rules.

export const BottomBar = observer(() => {
  const { balance, ui } = useStores();
  const t = useT();
  const canStep = !ui.spinning && !ui.isAutospinning;

  return (
    <div class="hud-bottom" data-testid="hud-bottom">
      <div class="bottom-col-left">
        <BuyBonus />
      </div>

      <div class="bottom-col-center">
        <div class="spin-cluster" data-testid="spin-cluster">
          <IconButton
            ariaLabel="Decrease bet"
            testId="bet-minus"
            disabled={!canStep || balance.bet <= 0.2}
            onClick={() => balance.stepBet(-1)}
          >
            <IconMinus />
          </IconButton>
          <SpinButton />
          <IconButton
            ariaLabel="Increase bet"
            testId="bet-plus"
            disabled={!canStep || balance.bet >= 100}
            onClick={() => balance.stepBet(1)}
          >
            <IconPlus />
          </IconButton>
        </div>
      </div>

      <div class="bottom-col-right">
        <IconButton
          ariaLabel={ui.isAutospinning ? t('hud.autospin.cancel') : t('hud.autospin.start')}
          active={ui.isAutospinning}
          disabled={ui.spinning && !ui.isAutospinning}
          testId="btn-autospin"
          onClick={() => (ui.isAutospinning ? ui.stopAutospin() : ui.startAutospin(10))}
        >
          <IconRepeat />
        </IconButton>
      </div>
    </div>
  );
});
