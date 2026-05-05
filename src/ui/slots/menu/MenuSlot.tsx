import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import type { MenuTab } from '@/state/UIStore';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { CloseIcon } from './icons';
import { findTab, renderTabContent, TAB_REGISTRY } from './tabRegistry';
import './menu.css';

export const MenuSlot = observer((): JSX.Element | null => {
  const { ui } = useStores();

  useEffect(() => {
    if (!ui.menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ui.closeMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.menuOpen, ui]);

  if (!ui.menuOpen) return null;

  const active = findTab(ui.menuTab);

  return (
    <div class="sp-menu-host" data-testid="menu">
      <button type="button" class="sp-menu-backdrop" aria-label="Close menu" onClick={() => ui.closeMenu()} />
      <div class="sp-menu" role="dialog" aria-modal="true" aria-label="Game menu">
        <div class="sp-menu__header">
          <span class="sp-menu__title">{active.label}</span>
          <button type="button" class="sp-menu__close" aria-label="Close menu" onClick={() => ui.closeMenu()}>
            <CloseIcon />
          </button>
        </div>
        <nav class="sp-menu__tabs" aria-label="Menu sections">
          {TAB_REGISTRY.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === ui.menuTab}
              class="sp-menu__tab"
              data-active={t.id === ui.menuTab ? '1' : undefined}
              onClick={() => ui.setMenuTab(t.id as MenuTab)}
            >
              <t.Icon />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div class="sp-menu__content" role="tabpanel">
          {renderTabContent(ui.menuTab)}
        </div>
      </div>
    </div>
  );
});
