import { useT } from '@/i18n/useT';
import type { MenuTab } from '@/state/UIStore';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { IconClose } from './Icons';
import { AutoplayTab } from './menu/AutoplayTab';
import { BetTab } from './menu/BetTab';
import { HelpTab } from './menu/HelpTab';
import { HistoryTab } from './menu/HistoryTab';
import { ResponsibleTab } from './menu/ResponsibleTab';
import { SettingsTab } from './menu/SettingsTab';

const TABS: Array<{ id: MenuTab; labelKey: string }> = [
  { id: 'settings', labelKey: 'menu.tabs.settings' },
  { id: 'autoplay', labelKey: 'menu.tabs.autoplay' },
  { id: 'bet', labelKey: 'menu.tabs.bet' },
  { id: 'history', labelKey: 'menu.tabs.history' },
  { id: 'responsible', labelKey: 'menu.tabs.responsible' },
  { id: 'help', labelKey: 'menu.tabs.help' },
];

export const MenuFull = observer(() => {
  const { ui } = useStores();
  const t = useT();
  if (!ui.menuOpen) return null;

  const tab = ui.menuTab;

  return (
    <div class="fullscreen menu" data-testid="menu-full" role="dialog" aria-label={t('menu.title')}>
      <div class="fullscreen__header">
        <div class="fullscreen__title">{t('menu.title')}</div>
        <button
          type="button"
          class="icon-btn"
          aria-label={t('menu.close')}
          data-testid="menu-close"
          onClick={() => ui.closeMenu()}
        >
          <IconClose />
        </button>
      </div>

      <div class="menu-tabs" role="tablist" aria-label={t('menu.title')}>
        {TABS.map((ti) => (
          <button
            key={ti.id}
            type="button"
            role="tab"
            aria-selected={ui.menuTab === ti.id}
            class={`menu-tab ${ui.menuTab === ti.id ? 'menu-tab--active' : ''}`.trim()}
            data-testid={`menu-tab-${ti.id}`}
            onClick={() => ui.setMenuTab(ti.id)}
          >
            {t(ti.labelKey)}
          </button>
        ))}
      </div>

      <div class="menu-body" role="tabpanel" data-testid={`menu-panel-${tab}`}>
        {tab === 'settings' && <SettingsTab />}
        {tab === 'autoplay' && <AutoplayTab />}
        {tab === 'bet' && <BetTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'responsible' && <ResponsibleTab />}
        {tab === 'help' && <HelpTab />}
      </div>
    </div>
  );
});
