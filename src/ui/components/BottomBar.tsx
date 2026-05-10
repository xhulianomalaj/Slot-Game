import { useT } from '@/i18n/useT';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { BuyBonus } from './BuyBonus';
import { IconButton } from './IconButton';
import { IconMenu, IconMinus, IconPlus, IconRepeat } from './Icons';
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

  const hasWin = balance.lastWin > 0;

  return (
    <div class="bet-board-wrap" data-pixi-label="hud">
    <div class="bet-board" data-testid="hud-bottom">
      {/* Mobile-only hamburger — hidden on desktop via CSS */}
      <button
        type="button"
        class="icon-btn bet-board__menu-btn"
        aria-label="Open menu"
        onClick={() => ui.openMenu()}
      >
        <IconMenu />
      </button>

      {/* LEFT — BuyBonus + Balance */}
      <div class="bet-board__side bet-board__side--left">
        <BuyBonus />
        <div class="kv" data-testid="kv-balance" data-pixi-label="balance">
          <span class="kv__label">{t('hud.demoBalance')}</span>
          <span class="kv__value">{formatMoney(balance.balance, ui.currency)}</span>
        </div>
      </div>

      {/* CENTER — [± stacked] SPIN [Autospin] */}
      <div class="bet-board__center">
        <div class="bet-board__stepper">
          <IconButton
            ariaLabel="Increase bet"
            testId="bet-plus"
            extraProps={{ 'data-pixi-label': 'bet:plus' }}
            disabled={!canStep || balance.bet >= 100}
            onClick={() => { balance.resetLastWin(); balance.stepBet(1); }}
          >
            <IconPlus />
          </IconButton>
          <IconButton
            ariaLabel="Decrease bet"
            testId="bet-minus"
            extraProps={{ 'data-pixi-label': 'bet:minus' }}
            disabled={!canStep || balance.bet <= 0.2}
            onClick={() => { balance.resetLastWin(); balance.stepBet(-1); }}
          >
            <IconMinus />
          </IconButton>
        </div>
        <SpinButton />
        <IconButton
          ariaLabel={ui.isAutospinning ? t('hud.autospin.cancel') : t('hud.autospin.start')}
          active={ui.isAutospinning}
          disabled={ui.spinning && !ui.isAutospinning}
          testId="btn-autospin"
          extraProps={{ 'data-pixi-label': 'autoplay' }}
          onClick={() => (ui.isAutospinning ? ui.stopAutospin() : ui.startAutospin(10))}
        >
          <IconRepeat />
        </IconButton>
      </div>

      {/* RIGHT — Bet + Win always rendered; opacity toggle keeps both in DOM for tests */}
      <div class="bet-board__side bet-board__side--right">
        <div class="bet-board__kv-slot">
          <div
            class="kv"
            data-testid="kv-bet"
            data-pixi-label="bet"
            style={{ opacity: hasWin ? 0 : 1, pointerEvents: hasWin ? 'none' : 'auto' }}
          >
            <span class="kv__label">{t('hud.demoBet')}</span>
            <span class="kv__value">{formatMoney(balance.bet, ui.currency)}</span>
          </div>
          <div
            class="kv kv--win"
            data-testid="kv-win"
            data-pixi-label="win"
            style={{ opacity: hasWin ? 1 : 0, pointerEvents: hasWin ? 'auto' : 'none' }}
          >
            <span class="kv__label">{t('hud.win')}</span>
            <span class="kv__value">{formatMoney(balance.lastWin, ui.currency)}</span>
          </div>
        </div>
        <SpeedPill />
      </div>
    </div>
    </div>
  );
});
