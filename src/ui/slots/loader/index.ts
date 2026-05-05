import { autorun } from 'mobx';
import type { UIStore } from '@/state/UIStore';
import type { Disposable } from '@/utils/Disposable';

const FADE_MS = 360;

/**
 * Loader slot — controls the inline #sp-loader element from index.html.
 *
 * The element is rendered statically by index.html so it's visible the moment
 * the document parses (before any JS or font loads). This controller only
 * updates progress / error state and removes the element when boot completes.
 *
 * Removal: delete this file, the `mountLoader` call in composition.ts, and
 * the `<div id="sp-loader">` block in index.html.
 */
export function mountLoader(ui: UIStore): Disposable {
  const root = document.getElementById('sp-loader');
  if (!root) return { dispose() {} };

  const fill = root.querySelector<HTMLElement>('.sp-loader__fill');
  const error = root.querySelector<HTMLElement>('.sp-loader__error');
  const version = root.querySelector<HTMLElement>('[data-sp-version]');

  if (version) version.textContent = `v${__APP_VERSION__}`;

  let removed = false;

  const stop = autorun(() => {
    const pct = Math.max(0, Math.min(1, ui.loadProgress)) * 100;
    if (fill) fill.style.width = `${pct}%`;

    if (error) {
      if (ui.loadError) {
        error.textContent = ui.loadError;
        error.hidden = false;
      } else {
        error.hidden = true;
      }
    }

    if (ui.bootStage === 'ready' && !ui.loadError && !removed) {
      removed = true;
      root.dataset.done = '1';
      window.setTimeout(() => root.remove(), FADE_MS + 40);
    }
  });

  return {
    dispose() {
      stop();
      if (!removed) root.remove();
    },
  };
}
