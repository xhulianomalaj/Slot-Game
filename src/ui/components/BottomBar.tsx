import { useT } from '@/i18n/useT';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { BuyBonus } from './BuyBonus';
import { IconButton } from './IconButton';
import { IconMinus, IconPlus, IconRepeat } from './Icons';
import { SpeedPill } from './SpeedPill';
import { SpinButton } from './SpinButton';

// Unified "bet board" — one horizontal panel that always sits centered under
// the reels. Layout uses CSS grid-template-columns: 1fr auto 1fr so the SPIN
// column is mathematically dead-centered regardless of side widths.
//
//   [ BuyBonus | Balance ]   [ −  SPIN  + ]   [ Bet | Speed | Auto ]
//        flex 1 (left)            auto                flex 1 (right)
//
// Width is capped via max-width on .bet-board so on large desktops the panel
// hugs the reels area instead of stretching across the viewport.

function formatMoney(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

export const BottomBar = observer(() => {
  const { balance, ui } = useStores();
  const t = useT();
  const canStep = !ui.spinning && !ui.isAutospinning;

  return (
    <div class="bet-board-wrap">
    <div class="bet-board" data-testid="hud-bottom">
      {/* LEFT — BuyBonus + Balance */}
      <div class="bet-board__side bet-board__side--left">
        <BuyBonus />
        <div class="kv" data-testid="kv-balance">
          <span class="kv__label">{t('hud.demoBalance')}</span>
          <span class="kv__value">{formatMoney(balance.balance, ui.currency)}</span>
        </div>
      </div>

      {/* CENTER — [± stacked] SPIN (dead-centered under reels) */}
      <div class="bet-board__center">
        <div class="bet-board__stepper">
          <IconButton
            ariaLabel="Increase bet"
            testId="bet-plus"
            disabled={!canStep || balance.bet >= 100}
            onClick={() => { balance.resetLastWin(); balance.stepBet(1); }}
          >
            <IconPlus />
          </IconButton>
          <IconButton
            ariaLabel="Decrease bet"
            testId="bet-minus"
            disabled={!canStep || balance.bet <= 0.2}
            onClick={() => { balance.resetLastWin(); balance.stepBet(-1); }}
          >
            <IconMinus />
          </IconButton>
        </div>
        <SpinButton />
      </div>

      {/* RIGHT — Bet OR Win (never both), Speed + Autoplay */}
      <div class="bet-board__side bet-board__side--right">
        {balance.lastWin > 0 ? (
          <div class="kv kv--win" data-testid="kv-win">
            <span class="kv__label">{t('hud.win')}</span>
            <span class="kv__value">{formatMoney(balance.lastWin, ui.currency)}</span>
          </div>
        ) : (
          <div class="kv" data-testid="kv-bet">
            <span class="kv__label">{t('hud.demoBet')}</span>
            <span class="kv__value">{formatMoney(balance.bet, ui.currency)}</span>
          </div>
        )}
        <SpeedPill />
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
    </div>
  );
});
