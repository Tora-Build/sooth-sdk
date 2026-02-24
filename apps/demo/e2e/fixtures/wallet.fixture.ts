import { test as base, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Extension path - downloaded MetaMask
const EXTENSION_PATH = path.join(__dirname, '../../.metamask/extension');

// Check if extension exists
const hasExtension = fs.existsSync(EXTENSION_PATH) && fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json'));

export type WalletFixtures = {
  walletContext: BrowserContext;
  walletPage: Page;
  extensionPage: Page;
  extensionId: string;
};

/**
 * Custom wallet test fixture that loads MetaMask extension directly
 * without needing the Synpress cache.
 */
export const test = base.extend<WalletFixtures>({
  walletContext: async ({}, use) => {
    if (!hasExtension) {
      throw new Error(
        'MetaMask extension not found. Run: curl -L https://github.com/MetaMask/metamask-extension/releases/download/v11.9.1/metamask-chrome-11.9.1.zip -o .metamask/metamask.zip && unzip -o .metamask/metamask.zip -d .metamask/extension'
      );
    }

    // Use empty path for temp directory - extensions load properly this way
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      slowMo: 150, // Slow down actions for stability
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        // Position window off-screen to avoid focus stealing
        '--window-position=-2400,-2400',
        '--window-size=1280,800',
      ],
      viewport: { width: 1280, height: 800 },
    });

    await use(context);
    await context.close();
  },

  walletPage: async ({ walletContext }, use) => {
    // Reuse existing page if available, or create new one
    let page = walletContext.pages().find(p => !p.url().includes('chrome-extension://'));
    if (!page) {
      page = await walletContext.newPage();
    }
    await use(page);
  },

  extensionPage: async ({ walletContext }, use) => {
    // Wait for extension to initialize
    await new Promise(r => setTimeout(r, 2000));
    
    // Find extension page
    let extensionPage: Page | undefined;
    for (let i = 0; i < 30; i++) {
      const pages = walletContext.pages();
      extensionPage = pages.find(p => 
        p.url().includes('chrome-extension://') && 
        (p.url().includes('home.html') || p.url().includes('onboarding'))
      );
      if (extensionPage) break;
      await new Promise(r => setTimeout(r, 500));
    }

    if (!extensionPage) {
      throw new Error('MetaMask extension page not found');
    }

    await use(extensionPage);
  },

  extensionId: async ({ extensionPage }, use) => {
    const url = extensionPage.url();
    const match = url.match(/chrome-extension:\/\/([^/]+)/);
    const extensionId = match ? match[1] : '';
    await use(extensionId);
  },
});

export { expect } from '@playwright/test';
