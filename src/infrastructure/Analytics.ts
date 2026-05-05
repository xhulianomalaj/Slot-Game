export interface Analytics {
  track(event: string, payload?: Record<string, unknown>): void;
}

export class ConsoleAnalytics implements Analytics {
  track(event: string, payload?: Record<string, unknown>): void {
    console.debug('[analytics]', event, payload ?? {});
  }
}
