import { useT } from '@/i18n/useT';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';

function formatMoney(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

export const HistoryTab = observer(() => {
  const { ui } = useStores();
  const t = useT();
  const net = ui.net;
  return (
    <div class="menu-pane" data-testid="menu-pane-history">
      <div class="stats-grid">
        <div class="stats-cell">
          <div class="stats-cell__label">{t('menu.history.rounds')}</div>
          <div class="stats-cell__value">{ui.roundsPlayed}</div>
        </div>
        <div class="stats-cell">
          <div class="stats-cell__label">{t('menu.history.totalStaked')}</div>
          <div class="stats-cell__value">{formatMoney(ui.totalStaked, ui.currency)}</div>
        </div>
        <div class="stats-cell">
          <div class="stats-cell__label">{t('menu.history.totalWon')}</div>
          <div class="stats-cell__value">{formatMoney(ui.totalWon, ui.currency)}</div>
        </div>
        <div class={`stats-cell ${net >= 0 ? 'stats-cell--pos' : 'stats-cell--neg'}`}>
          <div class="stats-cell__label">{t('menu.history.net')}</div>
          <div class="stats-cell__value">{formatMoney(net, ui.currency)}</div>
        </div>
      </div>

      <div class="menu-pane__empty" data-testid="history-empty">
        {t('menu.history.empty')}
      </div>
    </div>
  );
});
