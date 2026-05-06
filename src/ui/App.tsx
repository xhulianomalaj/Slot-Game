import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { observer } from '@/ui/hooks/useObserver';
import { BottomBar } from './components/BottomBar';
import { Splash } from './components/Splash';
import { type UIContext, UIContextProvider, useFSM, useStores } from './hooks/useStores';
import { HeaderSlot } from './slots/header';
import { MenuSlot } from './slots/menu';
import { ModalsSlot } from './slots/modals';

const AppInner = observer(() => {
  const { ui } = useStores();
  const fsm = useFSM();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (!ui.spaceToSpin) return;
      if (ui.menuOpen) return;
      // Don't fire if the focused element is a button/input (they handle Space themselves).
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (ui.spinning) {
        fsm.skip();
      } else if (ui.spinEnabled && !ui.isAutospinning) {
        void fsm.transition('spin');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui, fsm]);

  return (
    <div class="hud">
      <HeaderSlot />
      <MenuSlot />
      <ModalsSlot />
      <BottomBar />
      {/* Splash sits on top of everything until the player taps. The bridge
          calls `tapToStart()` automatically in tests; pass `keepSplash: true`
          to slot.boot() when a test wants to assert intro-screen content. */}
      <Splash />
    </div>
  );
});

export function App({ context }: { context: UIContext }): JSX.Element {
  return (
    <UIContextProvider.Provider value={context}>
      <AppInner />
    </UIContextProvider.Provider>
  );
}
