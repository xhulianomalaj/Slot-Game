import { defineConfig, devices } from '@playwright/test';

// Full market-viewport matrix. Every test runs in every projection — we
// maintain screenshot baselines per (viewport × test) so regressions at
// any size surface immediately.

export default defineConfig({
  testDir: './tests/screenshots',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  // Snapshots are per-OS. Set PLAYWRIGHT_SNAPSHOT_SUFFIX= '' to share, or
  // keep OS-scoped if your CI pins a consistent runner.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{projectName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // Allow tiny subpixel diffs (font rendering varies across Chromium builds).
      maxDiffPixelRatio: 0.005,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  projects: [
    // ─── Phones (portrait) ────────────────────────────────────────
    {
      name: 'iphone-se',
      use: { ...devices['iPhone SE'] },
    },
    {
      name: 'iphone-13',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'iphone-15-pro-max',
      use: { ...devices['iPhone 15 Pro Max'] },
    },
    {
      name: 'pixel-7',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'galaxy-s22-portrait',
      use: {
        viewport: { width: 360, height: 780 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
        userAgent: devices['Galaxy S9+'].userAgent,
      },
    },

    // ─── Phones (landscape) ───────────────────────────────────────
    {
      name: 'iphone-13-landscape',
      use: { ...devices['iPhone 13 landscape'] },
    },
    {
      name: 'pixel-7-landscape',
      use: {
        viewport: { width: 915, height: 412 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2.625,
        userAgent: devices['Pixel 7'].userAgent,
      },
    },

    // ─── Tablets ──────────────────────────────────────────────────
    {
      name: 'ipad-mini',
      use: { ...devices['iPad Mini'] },
    },
    {
      name: 'ipad-pro',
      use: { ...devices['iPad Pro 11'] },
    },
    {
      name: 'ipad-landscape',
      use: { ...devices['iPad Pro 11 landscape'] },
    },

    // ─── Desktop ──────────────────────────────────────────────────
    {
      name: 'desktop-1366',
      use: {
        viewport: { width: 1366, height: 768 },
        deviceScaleFactor: 1,
        userAgent: devices['Desktop Chrome'].userAgent,
      },
    },
    {
      name: 'desktop-1920',
      use: {
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        userAgent: devices['Desktop Chrome'].userAgent,
      },
    },
    {
      name: 'desktop-2560',
      use: {
        viewport: { width: 2560, height: 1440 },
        deviceScaleFactor: 1,
        userAgent: devices['Desktop Chrome'].userAgent,
      },
    },

    // ─── RGS iframe emulation ─────────────────────────────────────
    {
      name: 'rgs-iframe-4-3',
      use: {
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 1,
        userAgent: devices['Desktop Chrome'].userAgent,
      },
    },
    {
      name: 'rgs-iframe-16-9',
      use: {
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        userAgent: devices['Desktop Chrome'].userAgent,
      },
    },
  ],
});
