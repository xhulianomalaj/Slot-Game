// Buy Bonus — round coin badge, a staple of modern slot UI. Shows a
// "coming soon" notice on click. Swap the onClick body for your bonus-buy
// endpoint when ready. Safe to remove if your game doesn't offer bonus-buy.

import { useT } from '@/i18n/useT';
import { useStores } from '@/ui/hooks/useStores';

export function BuyBonus({ onClick }: { onClick?: () => void }) {
  const t = useT();
  const { modals } = useStores();

  function handleClick(): void {
    if (onClick) { onClick(); return; }
    void modals.alert({
      icon: 'info',
      title: 'Buy Bonus',
      description: 'This option is coming soon!',
      ok: 'OK',
    });
  }

  return (
    <button type="button" class="buy-bonus" aria-label={t('hud.buyBonus')} data-testid="buy-bonus" onClick={handleClick}>
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
}
