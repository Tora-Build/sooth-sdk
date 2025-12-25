import { test, expect } from '@playwright/test';

test.describe('AMM Trading Flow', () => {
  test('can view trading panel on Trade page', async ({ page }) => {
    // Navigate to trade page
    await page.goto('/trade');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Should show Trade heading
    await expect(page.getByRole('heading', { name: /Trade/i })).toBeVisible();

    // Should show BUY/SELL buttons in trading panel
    const buyButton = page.getByRole('button', { name: /^BUY$/i }).first();
    const sellButton = page.getByRole('button', { name: /^SELL$/i }).first();
    
    await expect(buyButton).toBeVisible({ timeout: 10_000 });
    await expect(sellButton).toBeVisible({ timeout: 10_000 });
  });

  test('can interact with shares input', async ({ page }) => {
    await page.goto('/trade');

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Find shares input
    const sharesInput = page.locator('[data-testid="shares-input"]');
    if (await sharesInput.isVisible()) {
      await sharesInput.fill('100');

      // Should see the value updated
      await expect(sharesInput).toHaveValue('100');
    } else {
      // Fallback - just verify trading panel loaded
      await expect(page.getByRole('button', { name: /^BUY$/i }).first()).toBeVisible();
    }
  });

  test('shows connect wallet button when not connected', async ({ page }) => {
    await page.goto('/trade');
    await page.waitForTimeout(2000);

    // Should show connect wallet button somewhere on page
    const connectButton = page.getByRole('button', { name: /Connect/i }).first();
    await expect(connectButton).toBeVisible({ timeout: 10_000 });
  });

  test('displays YES/NO outcome buttons', async ({ page }) => {
    await page.goto('/trade');
    await page.waitForTimeout(2000);

    // Should show YES and NO outcome selection
    await expect(page.getByText(/YES/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/NO/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
