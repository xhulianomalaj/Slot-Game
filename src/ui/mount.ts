import { h, render } from 'preact';
import type { Disposable } from '@/utils/Disposable';
import { App } from './App';
import type { UIContext } from './hooks/useStores';

/**
 * Mounts the Preact HUD into the given DOM node and returns a Disposable.
 *
 * The HUD reads the RootStore via MobX and drives the FSM via the context.
 * Pixi renders underneath on its own canvas — the HUD is DOM on top.
 */
export function mountHUD(host: HTMLElement, context: UIContext): Disposable {
  render(h(App, { context }), host);
  return {
    dispose() {
      render(null, host);
    },
  };
}
