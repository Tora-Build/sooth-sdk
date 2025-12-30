# E2E Test Plan - V8 Frontend

> Last Updated: 2025-12-25

## Overview

End-to-end testing strategy for Sooth Protocol V8 frontend using **Playwright + Synpress** (MetaMask integration).

---

## Test Stack

| Tool | Purpose |
|------|---------|
| **Playwright** | Browser automation framework |
| **Synpress** | MetaMask wallet testing extension |
| **Base Sepolia** | Testnet for contract interactions |

---

## Environment Setup

### Prerequisites

```bash
# Install dependencies
npm install

# Cache Synpress wallet (first time only)
npm run test:e2e:cache
```

### Required Environment Variables

```bash
# .env (do NOT commit)
WALLET_PASSWORD=your_metamask_password
SECRET_WORDS=word1,word2,word3,...,word12
```

### Running Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run with UI mode (debugging)
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/markets.spec.ts
```

---

## Test Categories

### 🟢 P1: Critical User Journeys

| Test | File | Description |
|------|------|-------------|
| Wallet Connection | `metamask-connect.spec.ts` | Connect MetaMask, verify navbar shows address |
| Markets Listing | `markets.spec.ts` | Navigate to /markets, verify V8 markets display |
| Market Detail View | `market-detail.spec.ts` | Click market, verify stats/AMM info loads |
| AMM Buy Trade | `amm-trading.spec.ts` | Execute a buy trade, verify position updates |
| Portfolio View | `portfolio.spec.ts` | View portfolio, verify position cards render |

### 🟡 P2: Secondary Flows

| Test | File | Description |
|------|------|-------------|
| Faucet | `faucet.spec.ts` | Request test USDC, verify balance updates |
| USDC Approval | `approval.spec.ts` | Approve USDC spending, verify allowance |
| AMM Sell Trade | `amm-trading.spec.ts` | Execute sell, verify 24h lock appears |
| Proceeds Claim | `proceeds.spec.ts` | Claim expired proceeds (requires time mocking) |

### 🔵 P3: Operator Flows

| Test | File | Description |
|------|------|-------------|
| Creator Dashboard | `operator.spec.ts` | View creator LP positions, fee accrual |
| Market Settlement | `settlement.spec.ts` | Settle market (adjudicator role required) |

---

## Test Data

### Test Wallet

The e2e wallet should be pre-funded with:
- **ETH**: 0.1+ ETH for gas
- **MockUSDC**: 10,000+ for trading tests

### Test Markets (Base Sepolia)

| Market | Address | Question |
|--------|---------|----------|
| Alien Life | `0xa67D75Bb57e6aBe59Cc6E8d102b319D894919ef1` | UN Confirms Alien Life |
| BTC TWAP | `0xAbEf550048C255B6513fF9B28EaFC6bF1e27b089` | BTC 7-day TWAP >= $100k |
| ETH5K | `0xcdE5B0b2dD6b229d8d6195D14CBAb726025ECd18` | ETH >= $5k by 2025-02-01 |

---

## Page Object Model

### Key Selectors (stable selectors for tests)

```typescript
// Navigation
const nav = {
  connectButton: 'button:has-text("Connect")',
  addressButton: 'button:has-text(/0x[a-f0-9]{4,}\\.\\.\\.[a-f0-9]{4}/i)',
  marketsLink: 'a:has-text("Markets")',
  portfolioLink: 'a:has-text("Portfolio")',
};

// Markets page
const markets = {
  marketCard: '[data-testid="market-card"]',
  filterAll: 'button:has-text("All")',
  filterLive: 'button:has-text("Live")',
};

// Market detail
const marketDetail = {
  yesPrice: '[data-testid="yes-price"]',
  noPrice: '[data-testid="no-price"]',
  tradingPanel: '[data-testid="trading-panel"]',
  buyTab: 'button:has-text("Buy")',
  sellTab: 'button:has-text("Sell")',
  sharesInput: 'input[placeholder*="shares"]',
  executeButton: 'button:has-text(/Execute|Trade|Buy|Sell/)',
};

// Portfolio
const portfolio = {
  positionCard: '[data-testid="position-card"]',
  lpCard: '[data-testid="lp-card"]',
};
```

---

## Mocking Strategy

### Network Mocking (Optional)

For deterministic tests without real RPC:

```typescript
await page.route('**/sepolia.base.org/**', async route => {
  // Return mock RPC responses
});
```

### Time Mocking (24h Locks)

For testing proceeds claim after lock expires:

```typescript
// Use blockchain time manipulation via anvil/hardhat
// Or mock the frontend's "now" reference
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
        
      - name: Cache Synpress wallet
        run: npm run test:e2e:cache
        env:
          WALLET_PASSWORD: ${{ secrets.WALLET_PASSWORD }}
          SECRET_WORDS: ${{ secrets.SECRET_WORDS }}
          
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          E2E_BASE_URL: ${{ secrets.E2E_BASE_URL }}
```

---

## Test Writing Guidelines

### 1. Prefer data-testid for selectors

```tsx
// Component
<div data-testid="market-card">...</div>

// Test
await page.locator('[data-testid="market-card"]').click();
```

### 2. Use explicit waits, not arbitrary timeouts

```typescript
// Good
await expect(page.getByText('Trade complete')).toBeVisible({ timeout: 30_000 });

// Bad
await page.waitForTimeout(5000);
```

### 3. Clean up state between tests

```typescript
// Reset wallet state or use fresh page context
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});
```

### 4. Test transaction flows with confirmation

```typescript
// Wait for transaction confirmation
await metamask.confirmTransaction();
await expect(page.getByText('Transaction confirmed')).toBeVisible();
```

---

## Current Coverage

| Flow | Status | File |
|------|--------|------|
| Wallet Connect | ✅ Exists | `metamask-connect.spec.ts` |
| Markets List | ⏳ Pending | `markets.spec.ts` |
| Market Detail | ⏳ Pending | `market-detail.spec.ts` |
| AMM Trading | ⏳ Pending | `amm-trading.spec.ts` |
| Portfolio | ⏳ Pending | `portfolio.spec.ts` |
| Faucet | ⏳ Pending | `faucet.spec.ts` |
| Operator | ⏳ Pending | `operator.spec.ts` |

---

## Known Limitations

1. **MetaMask State**: Synpress caches wallet state; test order may matter
2. **Transaction Timing**: Testnet confirmations can be slow (adjust timeouts)
3. **24h Locks**: Difficult to test without blockchain time manipulation
4. **Testnet Funds**: Wallet must be pre-funded before tests

---

*Version: 1.0 | Target: V8.1 Frontend*

