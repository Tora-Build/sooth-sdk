import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('landing page loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sooth/i);
  });

  test('landing page has Launch App button', async ({ page }) => {
    await page.goto('/');
    // Landing page has multiple "Launch App" CTAs - just check at least one exists
    await expect(page.getByRole('link', { name: /Launch App/i }).first()).toBeVisible();
  });

  test('can navigate to trade via Launch App', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Launch App/i }).first().click();
    // Should navigate to /trade (primary trading page)
    await expect(page).toHaveURL(/\/(trade|markets)/);
  });

  test('navbar shows role-based navigation links', async ({ page }) => {
    await page.goto('/trade');
    // Should have brand
    await expect(page.getByText(/SOOTH/i).first()).toBeVisible();
    // Should have role-based nav links
    await expect(page.getByRole('link', { name: /Launchpad/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /AMM/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pro/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Gov/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /About/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Faucet/i })).toBeVisible();
  });

  test('can navigate to Trade page', async ({ page }) => {
    await page.goto('/trade');
    await expect(page).toHaveURL(/\/trade/);
    await expect(page.getByRole('heading', { name: /Trade/i })).toBeVisible();
  });

  test('can navigate to Pro page', async ({ page }) => {
    await page.goto('/pro');
    await expect(page).toHaveURL(/\/pro/);
    // Pro page shows either trading interface or "not graduated" warning
    await expect(
      page.getByText(/Pro|TickBook|Not Graduated|Advanced/i).first()
    ).toBeVisible();
  });

  test('can navigate to Create page', async ({ page }) => {
    await page.goto('/create');
    await expect(page).toHaveURL(/\/create/);
    // Should show connect wallet or create interface
    await expect(
      page.getByText(/Create|Creator|Connect/i).first()
    ).toBeVisible();
  });

  test('can navigate to Gov page', async ({ page }) => {
    await page.goto('/gov');
    await expect(page).toHaveURL(/\/gov/);
    // Should show governance or connect wallet
    await expect(
      page.getByText(/Gov|Guardian|Connect/i).first()
    ).toBeVisible();
  });

  test('can navigate to Faucet page', async ({ page }) => {
    await page.goto('/faucet');
    await expect(page).toHaveURL(/\/faucet/);
    await expect(page.getByRole('heading', { name: /Faucet/i })).toBeVisible();
  });

  test('can navigate to About page', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveURL(/\/about/);
    await expect(page.getByText(/Sooth/i).first()).toBeVisible();
  });
});
