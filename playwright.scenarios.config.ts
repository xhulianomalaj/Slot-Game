// Playwright config for *behavior* scenarios (clicks, hotkeys, network,
// autospin). Separate from playwright.config.ts (screenshots) so:
//
//   - Scenarios run on a single Chromium project (not the 16-viewport matrix).
//   - The dev server boots in test mode (`?test=1`) — the bridge is wired
//     and visible to the page from the first navigation.
//   - Failures get a trace by default; this is the suite you'll iterate on.
//
//   pnpm test:e2e               # headless
//   pnpm test:e2e -- --ui       # Playwright UI mode
//   pnpm test:e2e -- --debug    # step through

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/scenarios',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-scenarios' }]],
  outputDir: 'test-results-scenarios',
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev --port 5183 --strictPort',
    port: 5183,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'scenarios-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
