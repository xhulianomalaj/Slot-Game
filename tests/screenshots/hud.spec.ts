// HUD screenshot tests — cover the full market viewport matrix.
//
// Each test hides the Pixi canvas (which is nondeterministic — random mock
// grid + GPU sampling) and snapshots the HUD-only layers. Baselines live per
// project under __screenshots__/<file>/<project>/<arg>.png.
//
// To refresh: pnpm test:screenshots:update

import { expect, test } from '@playwright/test';

async function waitForHUD(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?e2e=1');
  // Hide Pixi canvas — it's non-deterministic.
  await page.addStyleTag({
    content: `
      #pixi canvas, #pixi { background: #0a0a0a !important; }
      #pixi canvas { visibility: hidden !important; }
      .loader { display: none !important; }
      * { animation-duration: 0s !important; transition-duration: 0s !important; }
    `,
  });
  await page.waitForSelector('[data-testid="hud"]', { state: 'visible' });
  await page.waitForSelector('[data-testid="spin"]', { state: 'visible' });
}

test.describe('HUD', () => {
  test('idle state', async ({ page }) => {
    await waitForHUD(page);
    await expect(page).toHaveScreenshot('idle.png', { fullPage: true });
  });

  test('menu modal open', async ({ page }) => {
    await waitForHUD(page);
    await page.click('[data-testid="btn-menu"]');
    await page.waitForSelector('[data-testid="modal-menu"]');
    await expect(page).toHaveScreenshot('menu-open.png', { fullPage: true });
  });

  test('info modal open', async ({ page }) => {
    await waitForHUD(page);
    await page.click('[data-testid="btn-info"]');
    await page.waitForSelector('[data-testid="modal-info"]');
    await expect(page).toHaveScreenshot('info-open.png', { fullPage: true });
  });

  test('turbo speed selected', async ({ page }) => {
    await waitForHUD(page);
    await page.click('[data-testid="speed-turbo"]');
    await expect(page).toHaveScreenshot('speed-turbo.png', { fullPage: true });
  });

  test('bet at maximum', async ({ page }) => {
    await waitForHUD(page);
    // Step bet to max.
    for (let i = 0; i < 12; i++) {
      const plus = page.locator('[data-testid="bet-plus"]');
      if (await plus.isDisabled()) break;
      await plus.click();
    }
    await expect(page).toHaveScreenshot('bet-max.png', { fullPage: true });
  });
});
