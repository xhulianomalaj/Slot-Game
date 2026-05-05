import { AVAILABLE_BETS } from '@/state/UIStore';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { IconMinus, IconPlus } from './Icons';

export const BetStepper = observer(() => {
  const { balance, ui } = useStores();
  const canStep = !ui.spinning && !ui.isAutospinning;
  const minBet = AVAILABLE_BETS[0] ?? 0;
  const maxBet = AVAILABLE_BETS[AVAILABLE_BETS.length - 1] ?? Number.POSITIVE_INFINITY;
  const atMin = balance.bet <= minBet;
  const atMax = balance.bet >= maxBet;

  return (
    <fieldset class="bet" data-testid="bet-stepper">
      <legend class="visually-hidden">Bet</legend>
      <button
        type="button"
        aria-label="Decrease bet"
        data-testid="bet-minus"
        disabled={!canStep || atMin}
        onClick={() => balance.stepBet(-1)}
      >
        <IconMinus />
      </button>
      <div class="bet-value">
        <div class="bet-label">Bet</div>
        <div class="bet-amount" data-testid="bet-value">
          ${balance.bet.toFixed(2)}
        </div>
      </div>
      <button
        type="button"
        aria-label="Increase bet"
        data-testid="bet-plus"
        disabled={!canStep || atMax}
        onClick={() => balance.stepBet(1)}
      >
        <IconPlus />
      </button>
    </fieldset>
  );
});
