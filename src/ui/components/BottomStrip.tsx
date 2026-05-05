// Thin info strip at the very bottom of the HUD — the Hacksaw Mayan
// Stackways pattern. Menu hamburger on the left, DEMO BALANCE and DEMO BET
// key-value pairs stretched across.

// Thin info strip pinned to the very bottom: BALANCE / BET / WIN key-values.
// Menu, info and sound buttons live in the top Header now (Relax/Nexus pattern).

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

export const BottomStrip = observer(() => {
  const { balance, ui } = useStores();
  const t = useT();
  return (
    <div class="hud-strip" data-testid="hud-strip">
      <div class="hud-strip__info">
        <div class="kv" data-testid="kv-balance">
          <span class="kv__label">{t('hud.demoBalance')}</span>
          <span class="kv__value">{formatMoney(balance.balance, ui.currency)}</span>
        </div>
        <div class="kv" data-testid="kv-bet">
          <span class="kv__label">{t('hud.demoBet')}</span>
          <span class="kv__value">{formatMoney(balance.bet, ui.currency)}</span>
        </div>
        {balance.lastWin > 0 && (
          <div class="kv kv--win" data-testid="kv-win">
            <span class="kv__label">{t('hud.win')}</span>
            <span class="kv__value">{formatMoney(balance.lastWin, ui.currency)}</span>
          </div>
        )}
      </div>
    </div>
  );
});
