// Buy Bonus — round coin badge, a staple of modern slot UI. Clicking it
// shows a price confirmation; on confirm it transitions to BuyBonusPhase
// which charges the cost and kicks off a guaranteed free-spins round.

import { BUY_BONUS_MULTIPLIER } from '@/flow/phases/BuyBonusPhase';
import { useT } from '@/i18n/useT';
import { observer } from '@/ui/hooks/useObserver';
import { useFSM, useStores } from '@/ui/hooks/useStores';

export const BuyBonus = observer(function BuyBonus({ onClick }: { onClick?: () => void }) {
  const t = useT();
  const { modals, ui, balance } = useStores();
  const fsm = useFSM();
  const disabled = ui.spinning || ui.isAutospinning || ui.isFreeSpins;

  async function handleClick(): Promise<void> {
    if (onClick) { onClick(); return; }

    const cost = Math.round(balance.bet * BUY_BONUS_MULTIPLIER * 100) / 100;
    const currency = ui.currency;
    const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cost);

    const confirmed = await modals.confirm({
      icon: 'bonus',
      title: 'Buy Bonus',
      description: `Buy 10 guaranteed Free Spins for ${formatted}?`,
      confirm: 'Buy',
      cancel: 'Cancel',
    });

    if (!confirmed) return;

    if (balance.balance < cost) {
      await modals.alert({
        icon: 'warn',
        title: 'Insufficient Balance',
        description: `You need at least ${formatted} to buy the bonus.`,
        ok: 'OK',
      });
      return;
    }

    void fsm.transition('buyBonus');
  }

  return (
    <button type="button" class="buy-bonus" aria-label={t('hud.buyBonus')} data-testid="buy-bonus" disabled={disabled} onClick={() => void handleClick()}>
      <img
        src="/assets/theme/buy-bonus-badge.png"
        alt=""
        class="buy-bonus__img"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
      />
      <span class="buy-bonus__label">
        <span>{t('hud.buyBonusTop')}</span>
        <span>{t('hud.buyBonusBottom')}</span>
      </span>
    </button>
  );
});
