# V8.1 E2E Testing Specification

> **Version**: 8.1.0  
> **Last Updated**: 2025-12-25  
> **Framework**: Playwright + Synpress (MetaMask)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Test Configuration](#test-configuration)
3. [Page Specifications](#page-specifications)
4. [Test Scenarios](#test-scenarios)
5. [Selectors Reference](#selectors-reference)
6. [Wallet Integration](#wallet-integration)
7. [Test Data](#test-data)

---

## Overview

This document specifies end-to-end test cases for the V8.1 frontend. Tests are organized by page/feature and categorized into:

- **Smoke Tests**: Basic visibility and rendering
- **Functional Tests**: User interactions without wallet
- **Integration Tests**: Full flows with MetaMask wallet

### Test Files Structure

```
e2e/
├── navigation.spec.ts       # Route navigation, navbar
├── trade.spec.ts            # /trade AMM trading page
├── pro.spec.ts              # /pro TickBook trading page
├── create.spec.ts           # /create creator/adjudicator page
├── gov.spec.ts              # /gov guardian page
├── learn.spec.ts            # /learn tutorial page
├── faucet.spec.ts           # /faucet token minting
├── amm-trading.spec.ts      # AMM trading with wallet
└── metamask-connect.spec.ts # Wallet connection setup
```

---

## Test Configuration

### Playwright Config (`playwright.config.ts`)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    headless: false,
    trace: 'on-first-retry',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 5173',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
      },
});
```

### Running Tests

```bash
# All tests (headless)
npx playwright test

# With UI mode
npx playwright test --ui

# Specific file
npx playwright test e2e/trade.spec.ts

# With MetaMask (Synpress)
npx synpress run --config playwright.config.ts
```

---

## Page Specifications

### Navigation Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Marketing page with "Launch App" CTA |
| `/trade` | Trade | AMM trading for retail users |
| `/trade/:marketId` | Trade (specific) | Trade page with pre-selected market |
| `/pro` | Pro | TickBook trading for advanced users |
| `/pro/:marketId` | Pro (specific) | Pro page with pre-selected market |
| `/create` | Create | Creator + Adjudicator tools |
| `/gov` | Gov | Guardian governance controls |
| `/learn` | Learn | Tutorial and sandbox |
| `/faucet` | Faucet | Testnet token minting |
| `/about` | About | Protocol information |

### Navbar Links (Desktop)

```
Create | Trade | Pro | Gov | Learn | Faucet
```

---

## Test Scenarios

### 1. Navigation Tests (`navigation.spec.ts`)

#### Smoke Tests

| Test | Description | Expected |
|------|-------------|----------|
| Landing loads | Navigate to `/` | Title contains "Sooth" |
| Launch App visible | Check CTA button | "Launch App" link visible |
| Navbar brand | Check brand logo | "SOOTH" text visible |

#### Functional Tests

| Test | Description | Expected |
|------|-------------|----------|
| Navigate to Trade | Click Trade nav link | URL = `/trade` |
| Navigate to Pro | Click Pro nav link | URL = `/pro` |
| Navigate to Create | Click Create nav link | URL = `/create` |
| Navigate to Gov | Click Gov nav link | URL = `/gov` |
| Navigate to Learn | Click Learn nav link | URL = `/learn` |
| Navigate to Faucet | Click Faucet nav link | URL = `/faucet` |
| Mobile menu opens | Click hamburger, check drawer | Drawer visible with links |

---

### 2. Trade Page Tests (`trade.spec.ts`)

#### Page Elements

| Element | Selector | Type |
|---------|----------|------|
| Page heading | `h1:text("Trade")` | Heading |
| Search input | `input[placeholder*="Search"]` | Input |
| Category buttons | `button:text("Crypto")` etc. | Buttons |
| Market cards | `.card-lift` or market list items | Buttons |
| Trading panel | `SimpleTradingPanel` container | Div |
| YES button | `button:text("YES")` | Button |
| NO button | `button:text("NO")` | Button |
| BUY button | `button:text("BUY")` | Button |
| SELL button | `button:text("SELL")` | Button |
| Shares input | `input[type="number"]` | Input |
| Quick trade buttons | `button:text("10")`, `button:text("50")` | Buttons |
| Connect Wallet | `button:text("Connect Wallet")` | Button |
| My Positions card | Card with "My Positions" heading | Div |
| Learn link | `a:text("New to prediction markets")` | Link |

#### Smoke Tests

| Test | Description | Expected |
|------|-------------|----------|
| Page loads | Navigate to `/trade` | "Trade" heading visible |
| Market list visible | Check for market cards | At least 1 market card |
| Trading panel visible | Check for YES/NO buttons | Both visible |

#### Functional Tests

| Test | Description | Expected |
|------|-------------|----------|
| Search filters markets | Type in search | List updates |
| Select market | Click market card | Trading panel updates |
| Toggle BUY/SELL | Click SELL button | Button style changes |
| Enter shares | Type in shares input | Quote updates |
| Quick trade buttons | Click "50" button | Input shows 50 |
| Shows connect prompt | Not connected | "Connect Wallet" button visible |

#### Integration Tests (with wallet)

| Test | Description | Expected |
|------|-------------|----------|
| Connect wallet | Click Connect, approve in MetaMask | Address shown in navbar |
| Get quote | Enter shares, observe quote | Cost, fee, price impact shown |
| Approve USDC | Click Approve, confirm tx | Approval succeeds |
| Execute trade | Click Buy, confirm tx | Trade completes, toast shown |

---

### 3. Pro Page Tests (`pro.spec.ts`)

#### Page Elements

| Element | Selector |
|---------|----------|
| Page heading | `h1:text("Pro Trading")` |
| Market selector | Dropdown or list |
| Orderbook | Orderbook component |
| Limit order form | Form with price/amount inputs |
| Warning banner | "Market Not Graduated" message |

#### Smoke Tests

| Test | Description | Expected |
|------|-------------|----------|
| Page loads | Navigate to `/pro` | Heading visible |
| Shows warning for pre-grad | If market not graduated | Warning banner visible |

#### Functional Tests

| Test | Description | Expected |
|------|-------------|----------|
| Select market | Choose from selector | Orderbook updates |
| Orderbook depth visible | For graduated market | Bid/ask visible |

---

### 4. Create Page Tests (`create.spec.ts`)

#### Page Elements

| Element | Selector |
|---------|----------|
| Page heading | `h1:text("Create")` |
| Role badge | `OperatorRoleBadge` component |
| Market selector | Dropdown or list |
| Initialization panel | "Initialize Market" card |
| Creator dashboard | "Creator Dashboard" card |
| Settlement panel | "Settlement" card (if adjudicator) |

#### Smoke Tests

| Test | Description | Expected |
|------|-------------|----------|
| Page loads | Navigate to `/create` | Heading visible |
| Connect prompt | Not connected | "Connect Wallet" visible |

#### Integration Tests (with wallet)

| Test | Description | Expected |
|------|-------------|----------|
| Shows role badge | Connected as creator | "Creator" badge visible |
| Initialize market | Deposit USDC | LP tokens received |
| Settle market | As adjudicator | Settlement succeeds |

---

### 5. Gov Page Tests (`gov.spec.ts`)

#### Page Elements

| Element | Selector |
|---------|----------|
| Page heading | `h1:text("Governance")` |
| Guardian panel | `GuardianPanel` component |
| Veto button | `button:text("Veto")` |
| Finalize button | `button:text("Finalize")` |

#### Smoke Tests

| Test | Description | Expected |
|------|-------------|----------|
| Page loads | Navigate to `/gov` | Heading visible |
| Connect prompt | Not connected | "Connect Wallet" visible |

#### Integration Tests (with guardian wallet)

| Test | Description | Expected |
|------|-------------|----------|
| Shows guardian controls | Connected as guardian | Veto/Finalize visible |
| Veto settlement | Click Veto, confirm | Settlement vetoed |
| Finalize market | Click Finalize, confirm | Market finalized |

---

### 6. Learn Page Tests (`learn.spec.ts`)

#### Page Elements

| Element | Selector |
|---------|----------|
| Page heading | `h1:text("Learn")` |
| Sandbox banner | "SANDBOX MODE" banner |
| Step indicator | Progress dots/bar |
| Next button | `button:text("Next")` |
| Back button | `button:text("Back")` |
| LMSR curve | SVG visualization |
| Practice panel | Sandbox trading panel |
| Play animation | `button:text("Play Animation")` |

#### Smoke Tests

| Test | Description | Expected |
|------|-------------|----------|
| Page loads | Navigate to `/learn` | Heading visible |
| Sandbox banner | Check top banner | "SANDBOX MODE" visible |
| Step 1 visible | First tutorial step | Content visible |

#### Functional Tests

| Test | Description | Expected |
|------|-------------|----------|
| Navigate steps | Click Next/Back | Step changes |
| Progress indicator | Navigate forward | Progress updates |
| LMSR curve interactive | Drag on curve | Price updates |
| Practice trade | Enter amount, click buy | Mock trade executes |
| Play animation | Click Play | Animation runs |
| Complete tutorial | Reach step 5 | "Ready to Trade" shown |

---

### 7. Faucet Page Tests (`faucet.spec.ts`)

#### Page Elements

| Element | Selector |
|---------|----------|
| Page heading | `h1:text("Faucet")` |
| USDC card | Card with "Mock USDC" |
| ETH card | Card with "Native ETH" |
| Request button | `button:text("Request")` |
| Balance display | "Your Balance" text |

#### Smoke Tests

| Test | Description | Expected |
|------|-------------|----------|
| Page loads | Navigate to `/faucet` | Heading visible |
| Cards visible | Check for USDC/ETH cards | Both visible |

#### Integration Tests (with wallet)

| Test | Description | Expected |
|------|-------------|----------|
| Request USDC | Click Request, confirm tx | Balance increases |
| Balance shown | After request | New balance displayed |

---

## Selectors Reference

### Data Test IDs

Add these `data-testid` attributes to components for reliable selection:

```typescript
// Trading Panel
data-testid="trading-panel"
data-testid="shares-input"
data-testid="quote-cost"
data-testid="quote-fee"
data-testid="buy-button"
data-testid="sell-button"

// Market Cards
data-testid="market-card"
data-testid="market-probability"

// Positions
data-testid="position-card"
data-testid="position-shares"

// Forms
data-testid="search-input"
data-testid="amount-input"
```

### Role-Based Selectors (Playwright)

```typescript
// Buttons
page.getByRole('button', { name: /Connect/i })
page.getByRole('button', { name: /^BUY$/i })
page.getByRole('button', { name: /^SELL$/i })

// Links
page.getByRole('link', { name: /Trade/i })
page.getByRole('link', { name: /Learn more/i })

// Inputs
page.getByRole('spinbutton')  // type="number"
page.getByRole('textbox', { name: /Search/i })

// Headings
page.getByRole('heading', { name: /Trade/i })
```

### Text-Based Selectors

```typescript
// Contains text
page.getByText(/Connect Wallet/i)
page.getByText(/YES|NO/i)

// Exact text
page.getByText('BUY', { exact: true })
```

---

## Wallet Integration

### MetaMask Setup (Synpress)

```typescript
// test/wallet-setup/basic.setup.ts
import { defineWalletSetup } from '@synthetixio/synpress';
import { MetaMask } from '@synthetixio/synpress/playwright';

export const walletPassword = 'TestPassword123!';

export default defineWalletSetup(walletPassword, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, walletPassword);
  
  // Import test wallet
  await metamask.importWallet(process.env.TEST_SEED_PHRASE!);
  
  // Add Base Sepolia network
  await metamask.addNetwork({
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    chainId: 84532,
    symbol: 'ETH',
  });
});
```

### Connect Wallet Pattern

```typescript
test('connect wallet', async ({ context, page, metamaskPage, extensionId }) => {
  const metamask = new MetaMask(context, metamaskPage, walletPassword, extensionId);
  
  await page.goto('/trade');
  
  // Click connect button
  await page.getByRole('button', { name: /connect/i }).click();
  
  // Select MetaMask in modal
  const metamaskOption = page.getByRole('button', { name: /meta\s*mask/i });
  if (await metamaskOption.count()) {
    await metamaskOption.first().click({ timeout: 30_000 });
  } else {
    await page.getByText(/meta\s*mask/i).first().click({ timeout: 30_000 });
  }
  
  // Approve in MetaMask popup
  await metamask.connectToDapp();
  
  // Verify connected
  await expect(
    page.getByRole('button', { name: /0x[a-f0-9]{4,}\.\.\.[a-f0-9]{4}/i })
  ).toBeVisible({ timeout: 30_000 });
});
```

### Transaction Confirmation Pattern

```typescript
// For approve/trade transactions
await page.getByRole('button', { name: /Approve|Buy|Sell/i }).click();
await metamask.confirmTransaction();
await expect(page.getByText(/success|confirmed/i)).toBeVisible({ timeout: 60_000 });
```

---

## Test Data

### Test Markets (Base Sepolia)

| Market | Address | Status |
|--------|---------|--------|
| ETH5K | `0x0b7BfdfE0FAB1b48e4435fE713d78376DAC026fC` | Live |
| ALIEN | (check markets.json) | Live |
| BTC100K | (check markets.json) | Settled |

### Test Wallet

```
Address: 0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F
Network: Base Sepolia (84532)
Funded: mUSDC from faucet
```

### Contract Addresses

Load from `deployments.json`:

```typescript
import deployments from '../src/config/deployments.json';

const contracts = deployments.contracts;
// contracts.TruthMarket, contracts.AMMEngine, etc.
```

---

## CI/CD Integration

### GitHub Actions Example

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
        run: npx playwright install --with-deps
        
      - name: Start dev server
        run: npm run dev &
        
      - name: Run E2E tests
        run: npx playwright test
        env:
          E2E_BASE_URL: http://localhost:5173
```

---

## Coverage Checklist

### Pages

- [ ] Landing (`/`)
- [ ] Trade (`/trade`)
- [ ] Pro (`/pro`)
- [ ] Create (`/create`)
- [ ] Gov (`/gov`)
- [ ] Learn (`/learn`)
- [ ] Faucet (`/faucet`)
- [ ] About (`/about`)

### Flows

- [ ] Navigation between pages
- [ ] Wallet connection
- [ ] Market selection
- [ ] AMM trading (buy/sell)
- [ ] USDC approval
- [ ] Faucet token request
- [ ] Tutorial completion
- [ ] Sandbox trading

### Edge Cases

- [ ] No markets available
- [ ] No wallet connected
- [ ] Wrong network
- [ ] Insufficient balance
- [ ] Market not graduated
- [ ] Market settled
- [ ] Transaction failure

---

## Maintenance Notes

1. **Market Addresses**: Update test market addresses when deploying new markets
2. **Selectors**: Keep data-testid attributes stable across refactors
3. **Wallet Setup**: Ensure test wallet has sufficient testnet funds
4. **Network**: Tests assume Base Sepolia network
5. **Timeouts**: Increase timeouts for slow RPC responses in CI

---

## Related Documentation

- [V8.1 Frontend Documentation](../V8.1_FRONTEND.md)
- [V8.1 Actor Flow Diagrams](../V8_ACTOR_FLOW.md)
- [Playwright Documentation](https://playwright.dev/)
- [Synpress Documentation](https://synpress.io/)

