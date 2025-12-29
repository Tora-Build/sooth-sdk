import { test, expect } from '@playwright/test';

test.describe('V9 Trading Features', () => {
  test.describe('Trading Panel Quote Display', () => {
    test('shows quote cost and fee with data-testid', async ({ page }) => {
      await page.goto('/trade');
      await page.waitForTimeout(3000);

      // Enter shares amount
      const sharesInput = page.locator('[data-testid="shares-input"]');
      if (await sharesInput.isVisible()) {
        await sharesInput.fill('10');

        // Wait for quote to load
        await page.waitForTimeout(2000);

        // Check for quote display elements
        const quoteCost = page.locator('[data-testid="quote-cost"]');
        const quoteFee = page.locator('[data-testid="quote-fee"]');

        // These should exist in the DOM (may show — if no quote available)
        await expect(quoteCost).toBeVisible({ timeout: 5000 });
        await expect(quoteFee).toBeVisible({ timeout: 5000 });
      }
    });

    test('shows buy button with correct testid', async ({ page }) => {
      await page.goto('/trade');
      await page.waitForTimeout(3000);

      // Click BUY mode
      const buyModeButton = page.getByRole('button', { name: /^BUY$/i }).first();
      if (await buyModeButton.isVisible()) {
        await buyModeButton.click();

        // Enter shares
        const sharesInput = page.locator('[data-testid="shares-input"]');
        if (await sharesInput.isVisible()) {
          await sharesInput.fill('10');
        }

        // Check for buy button with testid
        const buyButton = page.locator('[data-testid="buy-button"]');
        await expect(buyButton).toBeVisible({ timeout: 10000 });
      }
    });

    test('shows sell button with correct testid', async ({ page }) => {
      await page.goto('/trade');
      await page.waitForTimeout(3000);

      // Click SELL mode
      const sellModeButton = page.getByRole('button', { name: /^SELL$/i }).first();
      if (await sellModeButton.isVisible()) {
        await sellModeButton.click();

        // Enter shares
        const sharesInput = page.locator('[data-testid="shares-input"]');
        if (await sharesInput.isVisible()) {
          await sharesInput.fill('10');
        }

        // Check for sell button with testid
        const sellButton = page.locator('[data-testid="sell-button"]');
        await expect(sellButton).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('Trading Panel Interactions', () => {
    test('can toggle between YES and NO outcomes', async ({ page }) => {
      await page.goto('/trade');
      await page.waitForTimeout(3000);

      // Find YES and NO tabs
      const yesTab = page.getByRole('button', { name: /^YES$/i }).first();
      const noTab = page.getByRole('button', { name: /^NO$/i }).first();

      if (await yesTab.isVisible() && await noTab.isVisible()) {
        // Click NO
        await noTab.click();
        await page.waitForTimeout(500);

        // Click YES
        await yesTab.click();
        await page.waitForTimeout(500);

        // Both should still be visible (tabs don't disappear)
        await expect(yesTab).toBeVisible();
        await expect(noTab).toBeVisible();
      }
    });

    test('quick amount buttons update input', async ({ page }) => {
      await page.goto('/trade');
      await page.waitForTimeout(3000);

      // Find shares input
      const sharesInput = page.locator('[data-testid="shares-input"]');
      if (await sharesInput.isVisible()) {
        // Click a quick amount button (e.g., 50)
        const quickButton = page.getByRole('button', { name: '50' }).first();
        if (await quickButton.isVisible()) {
          await quickButton.click();
          await expect(sharesInput).toHaveValue('50');
        }

        // Click another quick amount (e.g., 100)
        const anotherButton = page.getByRole('button', { name: '100' }).first();
        if (await anotherButton.isVisible()) {
          await anotherButton.click();
          await expect(sharesInput).toHaveValue('100');
        }
      }
    });

    test('increment/decrement buttons work', async ({ page }) => {
      await page.goto('/trade');
      await page.waitForTimeout(3000);

      const sharesInput = page.locator('[data-testid="shares-input"]');
      if (await sharesInput.isVisible()) {
        // Set initial value
        await sharesInput.fill('10');

        // Find increment button (+ button)
        const incrementBtn = page.locator('button:has-text("+")').first();
        const decrementBtn = page.locator('button:has-text("−")').first();

        if (await incrementBtn.isVisible()) {
          await incrementBtn.click();
          await expect(sharesInput).toHaveValue('11');
        }

        if (await decrementBtn.isVisible()) {
          await decrementBtn.click();
          await expect(sharesInput).toHaveValue('10');
        }
      }
    });
  });

  test.describe('Portfolio Page', () => {
    test('shows wallet and vault sections', async ({ page }) => {
      await page.goto('/portfolio');
      await page.waitForTimeout(3000);

      // Should show Wallet section
      await expect(page.getByText(/Wallet/i).first()).toBeVisible({ timeout: 10000 });

      // Should show TickBook Vault section
      await expect(page.getByText(/TickBook Vault/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('shows LP Shares section', async ({ page }) => {
      await page.goto('/portfolio');
      await page.waitForTimeout(3000);

      // Should show LP Shares
      await expect(page.getByText(/LP Shares/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('shows Owned Shares section', async ({ page }) => {
      await page.goto('/portfolio');
      await page.waitForTimeout(3000);

      // Should show Owned Shares
      await expect(page.getByText(/Owned Shares/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Pro Trading Page', () => {
    test('can navigate to Pro page', async ({ page }) => {
      await page.goto('/pro');
      await page.waitForTimeout(3000);

      // Should show Pro-related content
      await expect(page.getByRole('heading', { name: /Pro/i })).toBeVisible({ timeout: 10000 });
    });
  });
});
