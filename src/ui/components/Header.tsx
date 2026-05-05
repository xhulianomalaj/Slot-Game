import { useEffect, useState } from 'preact/hooks';
import { useT } from '@/i18n/useT';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { IconButton } from './IconButton';
import { IconInfo, IconMenu, IconSoundOff, IconSoundOn } from './Icons';

// Top header — Relax/Nexus pattern: hamburger left, logo center, sound + clock right.
// Logo art slot: public/intro/logo-small.png (falls back to text title).
//
// Clock uses rAF (not setInterval — Principle #2) to detect minute boundaries.
function useClock(): string {
  const [tick, setTick] = useState(() => fmt(new Date()));
  useEffect(() => {
    let raf = 0;
    let last = tick;
    const loop = () => {
      const t = fmt(new Date());
      if (t !== last) {
        last = t;
        setTick(t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return tick;
}
function fmt(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const Header = observer(() => {
  const { ui } = useStores();
  const t = useT();
  const time = useClock();
  return (
    <div class="hud-header" data-testid="hud-header">
      <div class="hud-header__left">
        <IconButton ariaLabel={t('hud.menu')} testId="btn-menu" onClick={() => ui.openMenu()}>
          <IconMenu />
        </IconButton>
        <IconButton ariaLabel={t('hud.info')} testId="btn-info" onClick={() => ui.openRules()}>
          <IconInfo />
        </IconButton>
      </div>
      <div class="hud-header__center">
        <img
          class="hud-header__logo"
          src="/intro/logo-small.png"
          alt=""
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
        />
        <span class="hud-header__title">{t('header.title')}</span>
      </div>
      <div class="hud-header__right">
        <span class="hud-header__clock" data-testid="hud-clock">
          {time}
        </span>
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
