// Requests fullscreen on the first touch interaction.
//
// Mobile browsers require a user gesture to enter fullscreen — we can't do it
// at boot. So we listen for the first pointerdown with pointerType "touch",
// which fires on phones and tablets but NOT on mouse-driven desktop events.
//
// iOS Safari (non-PWA) blocks the Fullscreen API entirely; the silent catch
// below handles that gracefully — the game keeps working without fullscreen.

export function enableMobileFullscreen(): void {
  if (typeof document === 'undefined') return;

  function onFirstTouch(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return;

    // Remove before the async work so a rapid second tap doesn't retry.
    document.removeEventListener('pointerdown', onFirstTouch);

    const el = document.documentElement;

    if (document.fullscreenEnabled && !document.fullscreenElement) {
      el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
        // Fullscreen can be blocked by browser policy (e.g. iOS Safari,
        // cross-origin iframes). Best-effort only — game remains functional.
      });
    } else if (
      // Older WebKit (Android 4.x, Samsung Internet < 6) needs the prefix.
      'webkitRequestFullscreen' in el &&
      !(document as unknown as Record<string, unknown>)['webkitFullscreenElement']
    ) {
      (el as unknown as { webkitRequestFullscreen(opts?: FullscreenOptions): void }).webkitRequestFullscreen(
        { navigationUI: 'hide' },
      );
    }
  }

  document.addEventListener('pointerdown', onFirstTouch);
}
