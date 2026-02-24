import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Check if Synpress cache exists - if not, skip wallet connection tests
const cacheDir = path.join(__dirname, '../.cache-synpress');
const hasSynpressCache = fs.existsSync(cacheDir) && fs.readdirSync(cacheDir).length > 0;

test.describe('Wallet Connection', () => {
  test.skip(!hasSynpressCache, 'Synpress wallet cache not available - run `npm run test:e2e:cache` first');

  test('shows connect button on landing page', async ({ page }) => {
    await page.goto('/');

    // Should have a connect button (in the Launch App area or navbar)
    const connectButton = page.getByRole('button', { name: /connect/i });
    const launchAppLink = page.getByRole('link', { name: /Launch App/i });

    await expect(connectButton.or(launchAppLink).first()).toBeVisible();
  });

  test('shows wallet options when clicking connect', async ({ page }) => {
    await page.goto('/trade');

    // Click connect button
    const connectButton = page.getByRole('button', { name: /connect/i });
    if (await connectButton.isVisible()) {
      await connectButton.click();

      // Should show wallet options modal (AppKit)
      await expect(
        page.getByText(/wallet|metamask|connect/i).first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});
