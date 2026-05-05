// Buy Bonus — round coin badge, a staple of modern slot UI. Purely visual
// for now (no action wired); swap the onClick for your bonus-buy endpoint
// when ready. Safe to remove if your game doesn't offer bonus-buy.

import { useT } from '@/i18n/useT';

export function BuyBonus({ onClick }: { onClick?: () => void }) {
  const t = useT();
  return (
    <button type="button" class="buy-bonus" aria-label={t('hud.buyBonus')} data-testid="buy-bonus" onClick={onClick}>
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
