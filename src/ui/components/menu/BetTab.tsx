import { useT } from '@/i18n/useT';
import { AVAILABLE_BETS } from '@/state/UIStore';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';

function formatMoney(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

export const BetTab = observer(() => {
  const { balance, ui } = useStores();
  const t = useT();
  return (
    <div class="menu-pane" data-testid="menu-pane-bet">
      <div class="menu-pane__intro">
        <div class="menu-pane__kicker">{t('menu.bet.current')}</div>
        <div class="menu-pane__big">{formatMoney(balance.bet, ui.currency)}</div>
        <p class="menu-pane__hint">{t('menu.bet.intro')}</p>
      </div>

      <div class="bet-grid">
        {AVAILABLE_BETS.map((amount) => {
          const active = amount === balance.bet;
          return (
            <button
              key={amount}
              type="button"
              class={`bet-chip ${active ? 'bet-chip--active' : ''}`.trim()}
              aria-pressed={active}
              data-testid={`bet-chip-${amount}`}
              disabled={balance.balance < amount}
              onClick={() => {
                balance.setBet(amount);
                ui.closeMenu();
              }}
            >
              {formatMoney(amount, ui.currency)}
            </button>
          );
        })}
      </div>
    </div>
  );
});
