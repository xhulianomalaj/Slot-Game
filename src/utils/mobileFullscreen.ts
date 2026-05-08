// Requests fullscreen on the first user interaction.
//
// Two key design decisions:
//   1. `{ capture: true }` — fires in the capture phase before Pixi's canvas
//      handler can call stopPropagation(), which would silently swallow the event.
//   2. No device check — works on real mobile, DevTools emulation, and desktop.
//      The game benefits from fullscreen on all platforms.
//
// iOS Safari (non-PWA) blocks the Fullscreen API entirely; the silent catch
// handles that gracefully — the game keeps working without fullscreen.

export function enableMobileFullscreen(): void {
  if (typeof document === 'undefined') return;

  // Only activate on touch-primary devices (phones, tablets).
  // `pointer: coarse` is true on real mobile hardware and false on
  // mouse-driven desktops/laptops, so desktop users are never affected.
  if (!window.matchMedia('(pointer: coarse)').matches) return;

  function onFirstInteraction(): void {
    document.removeEventListener('pointerdown', onFirstInteraction, { capture: true });

    const el = document.documentElement;

    if (document.fullscreenEnabled && !document.fullscreenElement) {
      el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
        // Fullscreen can be blocked by browser policy (e.g. iOS Safari,
        // DevTools emulation, cross-origin iframes). Best-effort only.
      });
    } else if (
      'webkitRequestFullscreen' in el &&
      !(document as unknown as Record<string, unknown>)['webkitFullscreenElement']
    ) {
      (el as unknown as { webkitRequestFullscreen(opts?: FullscreenOptions): void }).webkitRequestFullscreen(
        { navigationUI: 'hide' },
      );
    }
  }

  document.addEventListener('pointerdown', onFirstInteraction, { capture: true });
}

