import { test, expect } from '@playwright/test';

test.describe('P&L Simulator', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('displays Creator tab with LP equation', async ({ page }) => {
    await page.screenshot({ path: 'test-results/01-launchpad-with-simulator.png', fullPage: true });
    
    await expect(page.locator('text=LP Redemption').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Net P&L').first()).toBeVisible();
    await expect(page.locator('text=ROI').first()).toBeVisible();
  });

  test('mobile viewport shows Simulator tab', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(page.getByRole('button', { name: /Create/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Simulator/i })).toBeVisible();
    
    await page.getByRole('button', { name: /Simulator/i }).click();
    await page.waitForTimeout(300);
    
    await page.screenshot({ path: 'test-results/04-mobile-simulator-tab.png', fullPage: true });
    
    await expect(page.locator('text=Creator').first()).toBeVisible({ timeout: 3000 });
  });

  test('Gaming Trader tab shows Trade and LP sections', async ({ page }) => {
    const gamingTab = page.locator('button:has-text("Gaming Trader")');
    await expect(gamingTab).toBeVisible({ timeout: 5000 });
    await gamingTab.click();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: 'test-results/02-gaming-trader.png', fullPage: true });
    
    await expect(page.locator('text=Trade P&L').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Entry Price').first()).toBeVisible();
    await expect(page.locator('text=LP Equation').first()).toBeVisible();
  });

  test('Gaming Trader shows Pre-Grad toggle', async ({ page }) => {
    const gamingTab = page.locator('button:has-text("Gaming Trader")');
    await gamingTab.click();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: 'test-results/03-gaming-pregrad.png', fullPage: true });
    
    await expect(page.getByText('Pre-Grad', { exact: true })).toBeVisible();
    await expect(page.locator('text=LP Equation').first()).toBeVisible();
  });
});
