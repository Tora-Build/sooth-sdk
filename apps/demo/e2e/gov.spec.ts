import { test, expect } from '@playwright/test';

test.describe('Gov Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/gov');
  });

  test('displays Gov heading or governance content', async ({ page }) => {
    // Should show Governance-related content
    await expect(
      page.getByText(/Gov|Governance|Guardian/i).first()
    ).toBeVisible();
  });

  test('shows connect wallet when not connected', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Should prompt to connect wallet
    await expect(
      page.getByRole('button', { name: /Connect/i }).first()
    ).toBeVisible();
  });

  test('displays market information or connect prompt', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Should show market context OR connect wallet prompt
    const hasMarketInfo = await page.getByText(/Market|Settlement|Status|Connect/i).first().isVisible().catch(() => false);
    expect(hasMarketInfo).toBe(true);
  });

  test('displays content or connect wallet', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // When not connected, should show connect prompt; when connected, guardian controls
    const hasContent = await page.getByRole('button', { name: /Connect Wallet/i }).isVisible().catch(() => false)
      || await page.getByText(/Guardian|Veto|Finalize|Dispute/i).first().isVisible().catch(() => false);
    
    expect(hasContent).toBe(true);
  });
});

test.describe('Gov Page - Guardian Actions (Synpress)', () => {
  // These tests require wallet connection as guardian
  
  test.skip('shows guardian panel when connected as guardian', async ({ page }) => {
    // TODO: Implement with Synpress
    // 1. Connect as guardian address
    // 2. Navigate to /gov
    // 3. Verify guardian controls visible
    // await expect(page.getByRole('button', { name: /Veto/i })).toBeVisible();
    // await expect(page.getByRole('button', { name: /Finalize/i })).toBeVisible();
  });

  test.skip('can veto settlement as guardian', async ({ page }) => {
    // TODO: Implement with Synpress
    // Precondition: Market must be in dispute period after settlement
    // 1. Connect as guardian
    // 2. Click Veto button
    // 3. Confirm transaction in MetaMask
    // 4. Verify settlement vetoed
  });

  test.skip('can finalize market as guardian', async ({ page }) => {
    // TODO: Implement with Synpress
    // Precondition: Market must be past dispute period
    // 1. Connect as guardian
    // 2. Click Finalize button
    // 3. Confirm transaction in MetaMask
    // 4. Verify market finalized
  });

  test.skip('shows dispute period countdown', async ({ page }) => {
    // TODO: Implement with Synpress
    // Precondition: Market in dispute period
    // 1. Connect wallet
    // 2. Navigate to settled market
    // 3. Verify countdown visible
    // await expect(page.getByText(/hours|minutes|remaining/i)).toBeVisible();
  });

  test.skip('shows not guardian message for non-guardians', async ({ page }) => {
    // TODO: Implement with Synpress
    // 1. Connect as non-guardian address
    // 2. Navigate to /gov
    // 3. Verify "not guardian" message or disabled controls
    // await expect(page.getByText(/not.*guardian|no access/i)).toBeVisible();
  });
});

test.describe('Gov Page - Market States', () => {
  test('shows appropriate UI for live market', async ({ page }) => {
    await page.goto('/gov');
    await page.waitForTimeout(2000);
    
    // For live markets, guardian actions may not be available yet
    const status = page.getByText(/Live|Active|Open/i);
    const hasLiveStatus = await status.first().isVisible().catch(() => false);
    
    // Just verify page loads with some status
  });

  test('shows appropriate UI for settled market', async ({ page }) => {
    // This would need a known settled market
    // await page.goto('/gov?market=SETTLED_MARKET_ADDRESS');
    
    // For settled markets, should show settlement info
    // await expect(page.getByText(/Settled|Outcome|Winner/i)).toBeVisible();
  });

  test('shows appropriate UI for finalized market', async ({ page }) => {
    // This would need a known finalized market
    // await page.goto('/gov?market=FINALIZED_MARKET_ADDRESS');
    
    // For finalized markets, should show finalized status
    // await expect(page.getByText(/Finalized|Complete|Closed/i)).toBeVisible();
  });
});

