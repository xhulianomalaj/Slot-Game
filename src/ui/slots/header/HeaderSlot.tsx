import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { GAME } from '@/config/gameConfig';
import { requestExit } from '@/infrastructure/host';
import { GsapTicker } from '@/infrastructure/timing';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { ExitIcon, InfoIcon, SoundOffIcon, SoundOnIcon } from './icons';
import './header.css';

function formatHHMM(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function useClock(): string {
  const [now, setNow] = useState(() => formatHHMM(new Date()));
  useEffect(() => {
    const ticker = new GsapTicker();
    let handle = { dispose() {} };
    const tick = () => {
      const d = new Date();
      setNow(formatHHMM(d));
      const msToNextMinute = (60 - d.getSeconds()) * 1000 - d.getMilliseconds();
      handle = ticker.schedule(msToNextMinute, tick);
    };
    tick();
    return () => handle.dispose();
  }, []);
  return now;
}

export const HeaderSlot = observer((): JSX.Element | null => {
  const { ui, modals } = useStores();
  const time = useClock();
  if (ui.bootStage !== 'ready') return null;

  const soundOn = ui.soundEnabled;

  const onExit = async () => {
    const ok = await modals.confirm({
      icon: 'warning',
      title: 'Leave game?',
      description: 'Your current round will end. Are you sure you want to exit?',
      confirm: 'Leave',
      cancel: 'Stay',
      danger: true,
    });
    if (ok) requestExit();
  };

  return (
    <header class="sp-header" data-testid="header">
      <span class="sp-header__title">{GAME.title}</span>
      <span class="sp-header__spacer" />
      <button
        type="button"
        class="sp-header__btn"
        aria-label={soundOn ? 'Mute audio' : 'Unmute audio'}
        aria-pressed={!soundOn}
        data-off={soundOn ? undefined : '1'}
        onClick={() => ui.toggleSound()}
      >
        {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
      </button>
      <button type="button" class="sp-header__btn" aria-label="Game info" onClick={() => ui.openMenu('info')}>
        <InfoIcon />
      </button>
      <button type="button" class="sp-header__btn" aria-label="Exit game" onClick={onExit}>
        <ExitIcon />
      </button>
      <time class="sp-header__clock" dateTime={new Date().toISOString()}>
        {time}
      </time>
    </header>
  );
});
