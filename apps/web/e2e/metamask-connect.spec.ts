import { expect } from '@playwright/test';
import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';

import basicSetup from '../test/wallet-setup/basic.setup';

const test = testWithSynpress(metaMaskFixtures(basicSetup));

test('MetaMask can connect to Sooth web app', async ({ context, page, metamaskPage, extensionId }) => {
  const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

  await page.goto('/');

  // Open AppKit modal
  await page.getByRole('button', { name: /connect/i }).click();

  // Choose MetaMask inside AppKit modal
  // (selector kept loose to avoid coupling to AppKit internals)
  const optionByRole = page.getByRole('button', { name: /meta\s*mask/i });
  if (await optionByRole.count()) {
    await optionByRole.first().click({ timeout: 30_000 });
  } else {
    await page.getByText(/meta\s*mask/i).first().click({ timeout: 30_000 });
  }

  // Approve the connection in MetaMask
  await metamask.connectToDapp();

  // Navbar should switch from "Connect" → short address (0x1234...abcd)
  await expect(
    page.getByRole('button', { name: /0x[a-f0-9]{4,}\.\.\.[a-f0-9]{4}/i }),
  ).toBeVisible({ timeout: 30_000 });
});

