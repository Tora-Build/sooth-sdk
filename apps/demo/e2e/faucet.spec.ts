import { test, expect } from '@playwright/test';

test.describe('Faucet Page', () => {
  test('shows faucet page content', async ({ page }) => {
    await page.goto('/faucet');

    // Should show faucet heading
    await expect(page.getByRole('heading', { name: /Protocol Faucet/i })).toBeVisible();

    // Should show Mock USDC card
    await expect(page.getByRole('heading', { name: /Mock USDC/i })).toBeVisible();

    // Should show Native ETH info card
    await expect(page.getByRole('heading', { name: /Native ETH/i })).toBeVisible();
  });

  test('shows connect wallet message when not connected', async ({ page }) => {
    await page.goto('/faucet');

    // Request button should ask to connect
    await expect(
      page.getByRole('button', { name: /Connect Wallet to Mint/i }),
    ).toBeVisible();
  });

  test('shows contract address', async ({ page }) => {
    await page.goto('/faucet');

    // Should show the MockUSDC contract address or "Not deployed"
    await expect(
      page.getByText(/0x|Not deployed/i).first()
    ).toBeVisible();
  });
});
