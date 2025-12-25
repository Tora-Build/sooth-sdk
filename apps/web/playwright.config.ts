import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  
  // Run tests SERIALLY for stability (less browser popups, less interruption)
  fullyParallel: false,
  workers: 1,
  
  // Longer timeouts for on-chain tests
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  
  retries: process.env.CI ? 2 : 0,
  
  // Reporter - use 'list' for cleaner output
  reporter: process.env.CI ? 'dot' : 'list',
  
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  
  // Define test order with different modes
  projects: [
    {
      name: 'basic',
      testMatch: /^(?!.*wallet|.*onchain).*\.spec\.ts$/,
      use: {
        // Basic tests run HEADLESS - no browser window, no interruption
        headless: true,
      },
    },
    {
      name: 'wallet',
      testMatch: /wallet.*\.spec\.ts$/,
      dependencies: ['basic'],
      // Wallet tests use custom fixture (headed but off-screen)
    },
    {
      name: 'onchain',
      testMatch: /onchain.*\.spec\.ts$/,
      dependencies: ['wallet'],
      // On-chain tests use custom fixture (headed but off-screen)
    },
  ],
  
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --host localhost --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120000,
      },
});
