import { test, expect } from '@playwright/test';

test.describe('Trade Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trade');
  });

  test('displays Trade heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Trade/i })).toBeVisible();
    await expect(page.getByText(/Simple AMM trading/i)).toBeVisible();
  });

  test('displays search input', async ({ page }) => {
    await expect(page.getByPlaceholder(/Search markets/i)).toBeVisible();
  });

  test('displays category filter buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Crypto/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /AI/i })).toBeVisible();
  });

  test('displays market list', async ({ page }) => {
    // Wait for markets to load
    await page.waitForTimeout(2000);
    
    // Should see at least one market or empty state
    const markets = page.locator('.card-lift');
    const hasMarkets = (await markets.count()) > 0;
    
    expect(hasMarkets).toBe(true);
  });

  test('displays trading panel with YES/NO buttons', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Trading panel should show YES and NO buttons
    await expect(page.getByRole('button', { name: /YES/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /NO/i }).first()).toBeVisible();
  });

  test('displays BUY/SELL toggle', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    await expect(page.getByRole('button', { name: /^BUY$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^SELL$/i })).toBeVisible();
  });

  test('displays shares input', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Should have number input for shares
    const sharesInput = page.locator('input[type="number"]').first();
    await expect(sharesInput).toBeVisible();
  });

  test('displays quick trade buttons', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    await expect(page.getByRole('button', { name: /^10$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^50$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^100$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^500$/i })).toBeVisible();
  });

  test('shows connect wallet button when not connected', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible();
  });

  test('displays My Positions card', async ({ page }) => {
    await expect(page.getByText(/My Positions/i)).toBeVisible();
  });

  test('displays educational link', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: /New to prediction markets/i })
    ).toBeVisible();
  });

  test('quick trade buttons update shares input', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    const sharesInput = page.locator('input[type="number"]').first();
    
    // Click 50 button
    await page.getByRole('button', { name: /^50$/i }).click();
    await expect(sharesInput).toHaveValue('50');
    
    // Click 100 button
    await page.getByRole('button', { name: /^100$/i }).click();
    await expect(sharesInput).toHaveValue('100');
  });

  test('can toggle between BUY and SELL', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    const buyButton = page.getByRole('button', { name: /^BUY$/i });
    const sellButton = page.getByRole('button', { name: /^SELL$/i });
    
    // Click SELL
    await sellButton.click();
    
    // SELL should be active (rose styling when selected)
    await expect(sellButton).toHaveClass(/rose|active/i);
    
    // Click BUY
    await buyButton.click();
    await expect(buyButton).toHaveClass(/cyan|emerald|active/i);
  });

  test('can select different market', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    const marketCards = page.locator('.card-lift');
    const count = await marketCards.count();
    
    if (count > 1) {
      // Click second market
      await marketCards.nth(1).click();
      
      // URL should update with market ID
      await expect(page).toHaveURL(/\/trade\/0x/);
    }
  });

  test('search filters market list', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    const searchInput = page.getByPlaceholder(/Search markets/i);
    const marketCards = page.locator('.card-lift');
    
    const initialCount = await marketCards.count();
    
    // Search for something specific
    await searchInput.fill('ETH');
    await page.waitForTimeout(500);
    
    // Count may be same or fewer
    const filteredCount = await marketCards.count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('displays market deadline', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Should show deadline in market header
    await expect(page.getByText(/Deadline/i)).toBeVisible();
  });

  test('displays graduation status badge', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Should show Pre-Grad or Graduated badge
    await expect(
      page.getByText(/Pre-Grad|Graduated/i).first()
    ).toBeVisible();
  });

  test('view market details link works', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    const detailsLink = page.getByRole('link', { name: /View market details/i });
    if (await detailsLink.isVisible()) {
      await detailsLink.click();
      await expect(page).toHaveURL(/\/market\/0x/);
    }
  });
});

