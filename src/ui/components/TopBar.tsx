import { useT } from '@/i18n/useT';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { Chip } from './Chip';
import { IconButton } from './IconButton';
import { IconInfo, IconMenu, IconSoundOff, IconSoundOn } from './Icons';

function formatMoney(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

export const TopBar = observer(() => {
  const { balance, ui } = useStores();
  const t = useT();
  return (
    <div class="hud-top" data-testid="hud-top">
      <div class="top-left">
        <IconButton ariaLabel={t('hud.menu')} testId="btn-menu" onClick={() => ui.openMenu()}>
          <IconMenu />
        </IconButton>
        <IconButton ariaLabel={t('hud.info')} testId="btn-info" onClick={() => ui.openRules()}>
          <IconInfo />
        </IconButton>
      </div>
      <div class="top-right">
        <Chip label={`${t('hud.balance')} · ${ui.currency}`} testId="chip-balance">
          {formatMoney(balance.balance, ui.currency)}
        </Chip>
        {balance.lastWin > 0 && (
          <Chip label={t('hud.win')} valueClass="win-value" testId="chip-win">
            {formatMoney(balance.lastWin, ui.currency)}
          </Chip>
        )}
        <IconButton
          ariaLabel={ui.soundEnabled ? t('hud.sound.on') : t('hud.sound.off')}
          active={ui.soundEnabled}
          testId="btn-sound"
          onClick={() => ui.toggleSound()}
        >
          {ui.soundEnabled ? <IconSoundOn /> : <IconSoundOff />}
        </IconButton>
      </div>
    </div>
  );
});
