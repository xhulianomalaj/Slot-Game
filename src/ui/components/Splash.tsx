import { useT } from '@/i18n/useT';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';

// Splash / multifeature gate. Renders after assets finish loading and before
// the player has tapped. Mirrors the Relax/Nexus boot sequence:
//   loader (studio spinner) → splash (multifeature panel + tap-to-start) → game.
//
// Art slots:
//   public/intro/multifeature.png  — feature roundup panel (drop in your art)
//   public/intro/logo.png          — game logo above panel
// Both fall back to text/CSS placeholders if missing.
export const Splash = observer(() => {
  const { ui } = useStores();
  const t = useT();
  const ready = ui.bootStage === 'ready' && !ui.loadError;
  const open = ready && !ui.tappedToStart;
  if (!open) return null;
  return (
    <button
      type="button"
      class="splash"
      data-testid="splash"
      aria-label={t('splash.tapToStart')}
      onClick={() => ui.tapToStart()}
    >
      <div class="splash-inner">
        <img
          class="splash-logo"
          src="/intro/logo.png"
          alt=""
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
        />
        <div class="splash-multifeature">
          <img
            src="/intro/multifeature.png"
            alt=""
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
          />
        </div>
        <div class="splash-cta" data-testid="splash-cta">
          {t('splash.tapToStart')}
        </div>
      </div>
    </button>
  );
});
