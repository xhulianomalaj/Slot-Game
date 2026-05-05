// Testing surface — barrel for the in-process test bridge.
//
// External callers (Playwright, Vitest) import from `@/testing`. The
// composition root wires these into the running app when test mode is on.

export { InstantTicker } from './InstantTicker';
export { StubReelsEngine } from './StubReelsEngine';
export { type BridgeStateSnapshot, TestBridge, type TestBridgeOptions } from './TestBridge';

/**
 * Global handle for the test bridge. Set by composition when test mode is
 * enabled; `undefined` in production / non-test builds.
 *
 * Playwright reads this via `page.evaluate(() => window.__SLOTPLATE_TEST)`.
 */
export const TEST_BRIDGE_GLOBAL = '__SLOTPLATE_TEST' as const;

/** True when the URL or env says we should boot in test mode. */
export function isTestModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  // ANY non-empty `test` value enables test mode. This lets each scenario
  // pass its slugified name in the URL (`?test=happy-path-loss-debits-bet`)
  // so dev tools / CI / screenshots can correlate to a scenario name.
  // Use `?test=0` or `?test=off` to explicitly disable.
  const test = params.get('test');
  if (test !== null && test !== '0' && test !== 'off' && test !== 'false') return true;
  // Vite injects `import.meta.env.VITE_TEST_BRIDGE` at build; honor it too
  // so Playwright can flip the flag at the build level if it doesn't want
  // the URL param visible in screenshots.
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
  return env.VITE_TEST_BRIDGE === '1' || env.VITE_TEST_BRIDGE === 'true';
}

/**
 * Should the composition swap in headless stubs (`InstantTicker`,
 * `StubReelsEngine`) instead of the real Pixi pipeline?
 *
 * The bridge is always wired in test mode — but when a human opens
 * `?test=qa-inspector-demo` in a normal browser they want to see real
 * reels and animations, not an empty stage. Playwright, on the other
 * hand, needs the stubs so the full suite finishes in seconds.
 *
 * Heuristic:
 *   1. `?stubs=0/off` → force real engine even under automation.
 *   2. `?stubs=1/on`  → force stubs even in a human browser.
 *   3. otherwise → stubs only when `navigator.webdriver === true`.
 *      Playwright/Selenium/Puppeteer all set this; humans don't.
 */
export function shouldUseHeadlessStubs(testEnabled: boolean): boolean {
  if (!testEnabled) return false;
  if (typeof window === 'undefined') return true; // SSR / vitest — stubs are fine.
  const params = new URLSearchParams(window.location.search);
  const stubs = params.get('stubs');
  if (stubs === '0' || stubs === 'off' || stubs === 'false') return false;
  if (stubs === '1' || stubs === 'on' || stubs === 'true') return true;
  return Boolean((navigator as { webdriver?: boolean }).webdriver);
}
