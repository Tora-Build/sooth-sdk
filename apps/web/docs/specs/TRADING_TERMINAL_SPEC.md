# Trading Terminal UI Specification

> Reference document for Trading Terminal terminology, labels, and calculations.
> Aligned with `.agent/KNOWLEDGE.md` as the canonical source of truth.

---

## 1. Component Structure

```
TraderTerminal (page)
├── MarketSelector
├── MarketFilters
└── AmmMarketCard (main trading card)
    ├── Header (title, badges, adjudicator link)
    ├── Trade Mode Toggle (Buy/Sell)
    ├── Outcome Toggle (YES/NO)
    ├── Quote Preview Section
    │   ├── Price & Liquidity Bar
    │   ├── Probability Bar
    │   └── Order Summary
    ├── Shares Input
    ├── Slippage Selector
    ├── Execute Button
    └── Orderbook Drawer
        ├── LimitOrderForm
        └── Orderbook Display
```

---

## 2. AmmMarketCard Header

|| Element | Source | Notes |
||---------|--------|-------|
|| **Title** | `#{market.id_numeric} {market.question}` | Line-clamped to 2 lines |
|| **Adjudicator Badge** | `market.adjudicatorLabel` | e.g., "Manual Settlement" |
|| **Status Badge** | `market.status` | "Trading" / "Settled - YES/NO" |
|| **Orderbook Button** | Opens drawer | "↗ Orderbook" |
|| **Adjudicator Link** | `market.adjudicatorId` | Links to BaseScan in real mode |

---

## 3. Trade Mode & Outcome Toggles

|| Element | States | Styling |
||---------|--------|---------|
|| **Buy/Sell Toggle** | `tradeMode: 'buy' \| 'sell'` | Green border (buy), Rose border (sell) |
|| **YES/NO Toggle** | `selectedOutcome: 0 \| 1` | Green (YES=0), Rose (NO=1) |

---

## 4. Quote Preview Section

### Price & Liquidity Bar

|| Label | Variable | Formula |
||-------|----------|---------|
|| **YES Price** | `quote.newPriceYes` or `market.priceYes` | From AMM or quote hook |
|| **USDC** | Static label | Currency denomination |
|| **Liquidity** | `virtualLiquidity` | `market.bParam / 1e18` |

### Probability Bar

|| Label | Variable | Formula |
||-------|----------|---------|
|| **YES Probability** | `priceYesPercent` | `market.priceYes * 100` |
|| **Arrow (→)** | Shown when | `hasValidAmount && quote` |
|| **New Probability** | `quote.newPriceYes * 100` | After trade impact |
|| **Progress Bar** | Width | `newPriceYes * 100%` |

### Order Summary (V6.1.8)

|| Label | Variable | Formula |
||-------|----------|---------|
|| **Price (Net)** | Computed | `(quote.totalCost - quote.fee) / amount` |
|| **Fee** | `quote.fee` | Shown with percentage (e.g., "Fee (1%)") |
|| **Total Cost** (Buy) | `quote.maxWithSlippage` | Net + Fee + Slippage buffer |
|| **Min Received** (Sell) | `quote.maxWithSlippage` | Minimum proceeds after fees |

> **V6.1.8 Note**: Separates "Price (Net)" and "Fee" to clarify the $1.00 LMSR price cap.
> The base cost per share is capped at $1.00; fees are added on top.

---

## 5. Shares Input

|| Element | Variable | Notes |
||---------|----------|-------|
|| **Label** | "Shares" | Static |
|| **Lock Info** (Sell) | `lockedAmount`, `hoursRemaining` | Shows if user has locked shares |
|| **Available** (Sell) | `maxSellAmount` | User's available balance |
|| **Decrement Button** | `-` | Hold-to-repeat enabled |
|| **Input Field** | `amount` | Numeric, 1 step |
|| **Increment Button** | `+` | Hold-to-repeat enabled |

---

## 6. Slippage Selector

|| Element | Variable | Options |
||---------|----------|---------|
|| **Label** | "Slippage Tolerance" | With info icon |
|| **Current Value** | `slippageBps / 100` | e.g., "0.5%" |
|| **Options** | Click to expand | 0.1%, 0.5%, 1.0%, 2.0% |

---

## 7. Execute Button

|| State | Condition | Text |
||-------|-----------|------|
|| **Normal** | Ready | "Buy YES" / "Sell NO" etc. |
|| **Loading** | `isPending` | "Loading..." |
|| **Disabled - Balance** | `hasInsufficientBalance` | "Insufficient Balance (X USDC)" |
|| **Disabled - Amount** | `amount <= 0` | Button disabled |
|| **Disabled - Sell** | `!canSell` | Button disabled |
|| **Disabled - Status** | `market.status !== 'trading'` | Button disabled |

---

## 8. Orderbook Drawer

### Drawer Header

|| Element | Source |
||---------|--------|
|| **Title** | "Orderbook" |
|| **Market Question** | `market.question` |
|| **Market ID** | `#{market.id_numeric}` |
|| **Liquidity** | `market.bParam / 1e18` |

### LimitOrderForm

|| Element | Variable | Notes |
||---------|----------|-------|
|| **Mode Tabs** | "Limit" | Only limit orders supported |
|| **Side Toggle** | `orderSide: 'bid' \| 'ask'` | Bid = Buy, Ask = Sell |
|| **Outcome Toggle** | `selectedOutcome: 0 \| 1` | YES / NO |
|| **Price Input** | `price` | 0.01 - 0.99 range |
|| **Quantity Input** | `quantity` | Shares to buy/sell |

### Order Summary (Limit)

|| Label | Variable | Formula |
||-------|----------|---------|
|| **Current YES Price** | `market.priceYes` | From AMM |
|| **Order Price** | `price` | User input |
|| **Collateral Required** | Computed | `max(price, 1-price) × quantity` |
|| **Max Profit** | Computed | `(1 - collateralPerShare) × quantity` |

### Place Order Button

|| State | Condition | Text |
||-------|-----------|------|
|| **Bid + YES** | Normal | "Place Bid (Buy YES)" |
|| **Ask + YES** | Normal | "Place Ask (Sell YES)" |
|| **Bid + NO** | Normal | "Place Bid (Buy NO)" |
|| **Ask + NO** | Normal | "Place Ask (Sell NO)" |
|| **Loading** | `isPending` | "Placing..." |
|| **Needs Approval** | `!isApproved` | "Approve & Place" |

---

## 9. Orderbook Display

### Tabs

|| Tab | Content |
||-----|---------|
|| **Orderbook** | Bid/Ask order display |
|| **My Orders** | User's open orders |

### Order Levels

|| Column | Data |
||--------|------|
|| **Price** | Order price (0.01 - 0.99) |
|| **Size** | Aggregated shares at price level |
|| **Total** | Cumulative notional |
|| **Bar** | Width proportional to size |

### My Orders

|| Column | Data |
||--------|------|
|| **Type** | Bid/Ask |
|| **Price** | Order price |
|| **Size** | Remaining shares |
|| **Cancel** | Cancel button |

---

## 10. Calculation Reference

### AMM Quote (useV4Quote / useLaunchpadTradeQuote)

```typescript
const { quote } = useV4Quote(marketId, outcome, amount, isBuy, fee);

// Returns:
quote.totalCost      // Total USDC cost (negative for sells)
quote.fee            // V6.1.8: Separate fee amount
quote.avgPrice       // Weighted average price
quote.newPriceYes    // YES price after trade
quote.newPriceNo     // NO price after trade
quote.maxWithSlippage // Cost with slippage buffer
```

### Limit Order Collateral

```typescript
// For bid (buying):
collateral = price × quantity;       // YES bid
collateral = (1 - price) × quantity; // NO bid

// For ask (selling):
// Must hold shares to sell
```

### Slippage Buffer

```typescript
const withSlippage = totalCost * (1 + slippageBps / 10000);
```

---

## 11. Data Sources

|| Data | Hook | Contract Function |
||------|------|-------------------|
|| Market Info | `useAmmMarket` / `useLaunchpadMarket` | Various market reads |
|| AMM Quote | `useV4Quote` / `useLaunchpadTradeQuote` | `calculateAMMTradeCost()` |
|| Balance | `useAmmTrade` / `useLaunchpadSwap` | `yesBalance()`, `noBalance()` |
|| Orderbook | `useOrderbook` | `orders()`, `bestBid()`, `bestAsk()` |
|| User Orders | `useOrderbook` | Filtered by `msg.sender` |

---

## 12. Files

|| File | Purpose |
||------|---------|
|| `AmmTradingPanel.tsx` | Shared trading logic/UI component |
|| `MarketCard.tsx` | Main trading card component (uses Panel) |
|| `MarketDetail.tsx` | Full page view (uses Panel) |
|| `OrderbookForm.tsx` | Drawer wrapper for limit orders |
|| `LimitOrderForm.tsx` | Limit order placement UI |
|| `Orderbook.tsx` | Order book display |
|| `MarketSelector.tsx` | Market selection dropdown |
|| `MarketFilters.tsx` | Category filters |
|| `useLaunchpadSwap.ts` | V6.1.8: Direct swap hook for Launchpad markets |

---

## 13. Translation Keys

|| Key | English Text |
||-----|--------------|
|| `trading.buy` | "Buy" |
|| `trading.sell` | "Sell" |
|| `trading.yes` | "YES" |
|| `trading.no` | "NO" |
|| `trading.yesPrice` | "YES Price" |
|| `trading.yesProb` | "YES Probability" |
|| `trading.liquidity` | "Liquidity" |
|| `trading.shares` | "Shares" |
|| `trading.priceNet` | "Price (Net)" |
|| `trading.fee` | "Fee" |
|| `trading.totalCost` | "Total Cost" |
|| `trading.orderbook` | "Orderbook" |
|| `trading.marketOrderNote` | "Market orders match immediately against AMM" |

---

## 14. PortfolioView (V4.6 Lock-on-Sell)

> Added 2025-12-12 for Lock-on-Sell feature

### Component Structure

```
PortfolioView
├── USDC Balance Card
│   ├── Available (green)
│   ├── Locked (amber, with claim button)
│   ├── Pending (gray)
│   └── Total
├── AMM Positions Card
│   ├── UnlockTimer (legacy, may be unused)
│   ├── YES Shares
│   └── NO Shares
└── Orderbook Tokens Card
    ├── YES Tokens
    └── NO Tokens
```

### USDC Balance Section

|| Label | Variable | Source | Notes |
||-------|----------|--------|-------|
|| **💰 USDC Balance** | Header | Static | Card title |
|| **Available** | `availableFormatted` | `useLockedFunds()` | Green text, can withdraw |
|| **🔒 Locked** | `lockedFormatted` | `useLockedFunds()` | Amber text, only shows if `locked > 0n` |
|| **Claim Button** | `claimableFormatted` | `useLockedFunds()` | Green button, only shows if `hasClaimable` |
|| **📋 Pending** | `pendingFormatted` | `useLockedFunds()` | Gray text, reserved for orders |
|| **Total** | `totalFormatted` | `useLockedFunds()` | Sum of all balances |

### useLockedFunds Hook

|| Function | Return Type | Description |
||----------|-------------|-------------|
|| `lockedBalance(user)` | `uint256` | Total locked USDC (proceeds from sells) |
|| `claimableBalance(user)` | `uint256` | Portion of locked that has expired |
|| `availableBalance(user)` | `uint256` | Free balance for trading/withdraw |
|| `pendingBalance(user)` | `uint256` | Collateral reserved for orders |
|| `totalBalance(user)` | `uint256` | Sum of all balances |
|| `claimUnlocked()` | Action | Claims expired locks to available |

### Data Sources

|| Data | Hook | Contract |
||------|------|----------|
|| Locked/Claimable | `useLockedFunds` | `TraderVaultV4` |
|| AMM Positions | `useBalances` | `TraderVaultV4.ammPositions()` |
|| Orderbook Tokens | `useBalances` | `OutcomeToken.balanceOf()` |

### Files

|| File | Purpose |
||------|---------|
|| `components/v4/PortfolioView.tsx` | Main portfolio display |
|| `hooks/useLockedFunds.ts` | Lock balance hook |
|| `hooks/v4/useBalances.ts` | Position balances |

---

*Last updated: 2025-12-20 (V6.1.8 Safe Parity Minting)*
