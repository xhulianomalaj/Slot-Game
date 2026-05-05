// Singleton that tracks viewport size and orientation, and notifies all
// SmartContainers on change. One source of truth — do not recompute
// window size in components.
//
// Patterned after @gcp/renderer's `resizeObject` used in bonbon-hw.

type Listener = () => void;

export class ViewportObserver {
  width = 0;
  height = 0;
  isPortrait = false;
  isLandscape = true;

  private listeners = new Set<Listener>();
  private pending = false;

  constructor() {
    if (typeof window === 'undefined') return;
    this.measure();
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('orientationchange', this.onResize, { passive: true });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Force a re-measure and notify — call once after mounting the Pixi canvas. */
  remeasure(): void {
    this.measure();
    this.notify();
  }

  private onResize = (): void => {
    if (this.pending) return;
    this.pending = true;
    // Coalesce to the next frame to avoid thrashing on resize drag.
    requestAnimationFrame(() => {
      this.pending = false;
      this.measure();
      this.notify();
    });
  };

  private measure(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.isPortrait = h > w;
    this.isLandscape = !this.isPortrait;
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}

export const resizeObject = new ViewportObserver();
