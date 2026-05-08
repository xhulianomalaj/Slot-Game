// Requests fullscreen on the first tap on a touch-primary device.
// Uses `click` (not `pointerdown`) as it is more universally recognised
// as a completed user gesture by mobile browsers.

export function enableMobileFullscreen(): void {
  if (typeof document === 'undefined') return;

  // Don't guard at setup time — check on every click so toggling DevTools
  // between mobile/desktop doesn't leave a stale listener active.

  function onFirstInteraction(): void {
    // Re-evaluate on every click: pointer:coarse = touch device or DevTools
    // mobile emulation; pointer:fine = real desktop/laptop → skip.
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    const el = document.documentElement;

    if (document.fullscreenElement) return; // already fullscreen, nothing to do

    if (document.fullscreenEnabled && !document.fullscreenElement) {
      el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
        // Blocked by browser policy (e.g. iOS Safari, cross-origin iframes).
      });
    } else if ('webkitRequestFullscreen' in el) {
      (el as unknown as { webkitRequestFullscreen(opts?: FullscreenOptions): void }).webkitRequestFullscreen(
        { navigationUI: 'hide' },
      );
    }
  }

  document.body.addEventListener('click', onFirstInteraction, { capture: true });
}

