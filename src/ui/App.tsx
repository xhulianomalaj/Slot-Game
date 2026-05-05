import type { JSX } from 'preact';
import { Splash } from './components/Splash';
import { type UIContext, UIContextProvider } from './hooks/useStores';
import { HeaderSlot } from './slots/header';
import { MenuSlot } from './slots/menu';
import { ModalsSlot } from './slots/modals';

export function App({ context }: { context: UIContext }): JSX.Element {
  return (
    <UIContextProvider.Provider value={context}>
      <HeaderSlot />
      <MenuSlot />
      <ModalsSlot />
      {/* Splash sits on top of everything until the player taps. The bridge
          calls `tapToStart()` automatically in tests; pass `keepSplash: true`
          to slot.boot() when a test wants to assert intro-screen content. */}
      <Splash />
    </UIContextProvider.Provider>
  );
}
