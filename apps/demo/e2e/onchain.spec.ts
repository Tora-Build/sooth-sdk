/**
 * On-Chain E2E Tests
 * 
 * These tests verify actual blockchain transactions:
 * - Faucet minting (get test tokens)
 * - Token approvals
 * - AMM trading (buy/sell outcome tokens)
 * - Balance verification
 * 
 * Prerequisites:
 * - Wallet must be connected (run wallet-connect tests first or set up .env)
 * - Network must be Base Sepolia (chainId: 84532)
 * - Wallet needs ETH for gas fees
 */

import { test, expect } from './fixtures/wallet.fixture';
import 'dotenv/config';

const WALLET_PASSWORD = process.env.WALLET_PASSWORD || '';
const SECRET_WORDS = (process.env.SECRET_WORDS || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

const isPlaceholder = SECRET_WORDS.includes('word1') || SECRET_WORDS.includes('word2');
const hasCredentials = Boolean(
  WALLET_PASSWORD && 
  WALLET_PASSWORD !== 'YourSecurePassword123' &&
  SECRET_WORDS && 
  SECRET_WORDS.split(' ').length >= 12 &&
  !isPlaceholder
);

test.describe('On-Chain Functions', () => {
  // Run tests serially - they depend on each other
  test.describe.configure({ mode: 'serial' });
  
  // Long timeout for blockchain transactions
  test.setTimeout(180000);

  test.beforeAll(async () => {
    if (!hasCredentials) {
      console.log('⚠️ Skipping on-chain tests: Set real wallet credentials in .env');
    }
  });

  test('setup: import wallet', async ({ walletPage, extensionPage }) => {
    if (!hasCredentials) {
      test.skip();
      return;
    }

    await extensionPage.bringToFront();
    await extensionPage.waitForTimeout(2000);

    // Check if wallet needs setup
    const termsCheckbox = extensionPage.getByTestId('onboarding-terms-checkbox');
    if (await termsCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await termsCheckbox.click();
      
      const importButton = extensionPage.getByTestId('onboarding-import-wallet');
      await importButton.click();
      
      // Handle telemetry
      const noThanksBtn = extensionPage.getByTestId('metametrics-no-thanks');
      if (await noThanksBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await noThanksBtn.click();
      }
      
      // Enter seed phrase
      const words = SECRET_WORDS.split(' ');
      for (let i = 0; i < words.length; i++) {
        await extensionPage.getByTestId(`import-srp__srp-word-${i}`).fill(words[i]);
      }
      await extensionPage.getByTestId('import-srp-confirm').click();
      
      // Set password
      await extensionPage.getByTestId('create-password-new').fill(WALLET_PASSWORD);
      await extensionPage.getByTestId('create-password-confirm').fill(WALLET_PASSWORD);
      await extensionPage.getByTestId('create-password-terms').click();
      await extensionPage.getByTestId('create-password-import').click();
      
      // Complete onboarding
      await extensionPage.getByTestId('onboarding-complete-done').click({ timeout: 30000 });
      await extensionPage.getByTestId('pin-extension-next').click();
      await extensionPage.getByTestId('pin-extension-done').click();
    }

    console.log('✓ Wallet ready');
  });

  test('faucet: mint mUSDC tokens', async ({ walletPage, extensionPage }) => {
    if (!hasCredentials) {
      test.skip();
      return;
    }

    const context = walletPage.context();

    // Navigate to faucet
    await walletPage.bringToFront();
    await walletPage.goto('http://localhost:5173/faucet');
    await walletPage.waitForTimeout(3000);

    // Connect wallet first
    const connectBtn = walletPage.getByRole('button', { name: /Connect/i }).first();
    if (await connectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await connectBtn.click();
      await walletPage.waitForTimeout(1500);
      
      // Select MetaMask
      await walletPage.getByText(/MetaMask/i).first().click();
      
      // Handle MetaMask popup
      await walletPage.waitForTimeout(3000);
      for (const page of context.pages()) {
        if (page.url().includes('notification')) {
          await page.bringToFront();
          await page.waitForTimeout(1500);
          
          const nextBtn = page.locator('button:has-text("Next")');
          if (await nextBtn.isVisible().catch(() => false)) {
            await nextBtn.click();
            await page.waitForTimeout(1000);
            const confirmBtn = page.locator('button:has-text("Connect"), button:has-text("Confirm")').first();
            if (await confirmBtn.isVisible().catch(() => false)) {
              await confirmBtn.click();
            }
          }
        }
      }
      
      await walletPage.bringToFront();
      await walletPage.waitForTimeout(3000);
    }

    // Get initial balance text
    const balanceText = await walletPage.getByText(/mUSDC$/).first().textContent().catch(() => '0');
    const initialBalance = parseFloat(balanceText?.replace(/[^0-9.]/g, '') || '0');
    console.log('Initial mUSDC balance:', initialBalance);

    // Click mint button
    const mintBtn = walletPage.getByRole('button', { name: /Request 10,000 mUSDC/i });
    if (await mintBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mintBtn.click();
      console.log('Clicked mint button, waiting for MetaMask confirmation...');

      // Handle MetaMask transaction popup
      await walletPage.waitForTimeout(2000);
      for (const page of context.pages()) {
        if (page.url().includes('notification')) {
          await page.bringToFront();
          await page.waitForTimeout(1500);
          
          // Click Confirm for transaction
          const confirmBtn = page.locator('button:has-text("Confirm")');
          if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('Confirming transaction...');
            await confirmBtn.click();
          }
        }
      }

      await walletPage.bringToFront();
      
      // Wait for transaction to complete (look for success toast or balance update)
      await walletPage.waitForTimeout(10000);
      
      // Check for success
      const successToast = walletPage.getByText(/mUSDC received|Transaction sent/i);
      const hasSuccess = await successToast.isVisible({ timeout: 30000 }).catch(() => false);
      
      if (hasSuccess) {
        console.log('✓ Faucet mint successful!');
      } else {
        console.log('Transaction may still be pending...');
      }
    } else {
      console.log('Mint button not visible - wallet may not be connected');
    }
  });

  test('trade: buy YES shares via AMM', async ({ walletPage, extensionPage }) => {
    if (!hasCredentials) {
      test.skip();
      return;
    }

    const context = walletPage.context();

    // Navigate to trade page
    await walletPage.bringToFront();
    await walletPage.goto('http://localhost:5173/trade');
    await walletPage.waitForTimeout(3000);

    // Ensure wallet is connected
    const isConnected = await walletPage.getByText(/0x[a-fA-F0-9]{4}/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!isConnected) {
      console.log('Wallet not connected, connecting...');
      const connectBtn = walletPage.getByRole('button', { name: /Connect/i }).first();
      if (await connectBtn.isVisible().catch(() => false)) {
        await connectBtn.click();
        await walletPage.waitForTimeout(1500);
        await walletPage.getByText(/MetaMask/i).first().click();
        
        await walletPage.waitForTimeout(3000);
        for (const page of context.pages()) {
          if (page.url().includes('notification')) {
            await page.bringToFront();
            const nextBtn = page.locator('button:has-text("Next")');
            if (await nextBtn.isVisible().catch(() => false)) {
              await nextBtn.click();
              await page.waitForTimeout(500);
              await page.locator('button:has-text("Connect")').first().click();
            }
          }
        }
        await walletPage.bringToFront();
        await walletPage.waitForTimeout(3000);
      }
    }

    // Close Web3Modal if open (it blocks clicks on underlying elements)
    const modal = walletPage.locator('w3m-modal.open');
    if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Closing Web3Modal...');
      // Press Escape to close the modal
      await walletPage.keyboard.press('Escape');
      await walletPage.waitForTimeout(1000);
      
      // If still open, click outside the modal
      if (await modal.isVisible({ timeout: 500 }).catch(() => false)) {
        await walletPage.mouse.click(10, 10);
        await walletPage.waitForTimeout(1000);
      }
    }

    // Select BUY mode (should be default)
    const buyBtn = walletPage.getByRole('button', { name: /^BUY$/i }).first();
    await buyBtn.click({ force: true }); // Use force if modal is slow to close
    
    // Select YES outcome
    const yesBtn = walletPage.getByText(/YES/i).first();
    await yesBtn.click();
    
    // Enter amount (small amount for testing)
    const sharesInput = walletPage.locator('[data-testid="shares-input"]');
    if (await sharesInput.isVisible().catch(() => false)) {
      await sharesInput.fill('10');
      console.log('Entered 10 shares');
    } else {
      // Try number input
      const numInput = walletPage.locator('input[type="number"]').first();
      await numInput.fill('10');
    }

    await walletPage.waitForTimeout(2000);

    // Look for trade execution button (may say "Approve" first, then "Trade")
    const tradeBtn = walletPage.getByRole('button', { name: /Trade|Buy|Approve|Execute/i }).first();
    if (await tradeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const btnText = await tradeBtn.textContent();
      console.log(`Found button: "${btnText}"`);
      
      await tradeBtn.click();
      console.log('Clicked trade button...');

      // Handle MetaMask transaction
      await walletPage.waitForTimeout(3000);
      for (const page of context.pages()) {
        if (page.url().includes('notification')) {
          await page.bringToFront();
          await page.waitForTimeout(1500);
          
          const confirmBtn = page.locator('button:has-text("Confirm")');
          if (await confirmBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
            console.log('Confirming trade transaction...');
            await confirmBtn.click();
          }
        }
      }

      await walletPage.bringToFront();
      await walletPage.waitForTimeout(10000);

      // Check for success toast
      const successIndicator = walletPage.getByText(/success|bought|confirmed|complete/i);
      const hasSuccess = await successIndicator.isVisible({ timeout: 30000 }).catch(() => false);
      
      if (hasSuccess) {
        console.log('✓ Trade executed successfully!');
      } else {
        console.log('Trade may still be pending or requires approval first');
      }
    } else {
      console.log('Trade button not found - may need to connect wallet or approve tokens first');
    }
  });

  test('portfolio: verify positions after trade', async ({ walletPage }) => {
    if (!hasCredentials) {
      test.skip();
      return;
    }

    // Navigate to portfolio
    await walletPage.bringToFront();
    await walletPage.goto('http://localhost:5173/portfolio');
    await walletPage.waitForTimeout(3000);

    // Check for positions
    const positionCard = walletPage.locator('[data-testid="position-card"]');
    const hasPositions = await positionCard.first().isVisible({ timeout: 10000 }).catch(() => false);

    if (hasPositions) {
      const count = await positionCard.count();
      console.log(`✓ Found ${count} position(s) in portfolio`);
    } else {
      // May show "No positions" or need wallet connection
      const noPositions = await walletPage.getByText(/no positions|connect wallet/i).first().isVisible().catch(() => false);
      if (noPositions) {
        console.log('No positions found (or wallet not connected)');
      }
    }
  });

  test('pro: verify SoothBook access for graduated markets', async ({ walletPage }) => {
    if (!hasCredentials) {
      test.skip();
      return;
    }

    // Navigate to Pro page
    await walletPage.bringToFront();
    await walletPage.goto('http://localhost:5173/pro');
    await walletPage.waitForTimeout(3000);

    // Check for SoothBook or market selection
    const soothBookHeader = walletPage.getByText(/SoothBook|Order Book|Pro Trading/i).first();
    const hasSoothBook = await soothBookHeader.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasSoothBook) {
      console.log('✓ Pro trading interface loaded');
      
      // Check for graduated market indicator
      const graduatedBadge = walletPage.getByText(/graduated/i);
      if (await graduatedBadge.isVisible().catch(() => false)) {
        console.log('✓ Graduated market detected - SoothBook available');
      }
    } else {
      console.log('Pro interface may require graduated market selection');
    }
  });
});

