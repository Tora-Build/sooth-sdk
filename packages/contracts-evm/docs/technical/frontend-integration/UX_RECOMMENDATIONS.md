# Frontend UX Recommendations

**Updated:** 2025-12-04

---

## 1. Balance Display

### Concept: Available vs. Pending

In v3, users have two main balances:

1. **Available:** Liquid USDC ready to trade or withdraw.
2. **Pending:** Proceeds from selling shares, locked for 48h (Time-Lock).

### Recommended UI

```
┌─────────────────────────────────┐
│  Your Wallet                    │
│                                 │
│  Available:  $500.00            │
│  Pending:    $150.00 (unlocks in 24h)
│  ─────────────────────          │
│  Total:      $650.00            │
│                                 │
│  [Deposit] [Withdraw] [Claim]   │
│                                 │
│  (Claim button active if any    │
│   pending funds are unlocked)   │
└─────────────────────────────────┘
```

### Implementation

```typescript
const available = await traderVault.availableBalance(user);
const pending = await traderVault.pendingBalance(user);
const claimable = await traderVault.claimUnlocked.staticCall(); // Check if claimable
```

---

## 2. Deposit Flow

### "Top Up" Model

Users deposit USDC into the `TraderVault` once, then trade multiple times without further approvals.

```
┌─────────────────────────────────┐
│  ⚠️ Insufficient Available Funds│
│  Need: $52.34 | Have: $10.00    │
│                                 │
│  [Deposit $50] [Deposit Custom] │
└─────────────────────────────────┘
```

---

## 3. Trade Receipt & Fees

### Transparency

Show users where their trade was executed (Orderbook vs AMM) and the fees paid.

```
┌─────────────────────────────────────────┐
│  ✓ Trade Executed                       │
├─────────────────────────────────────────┤
│  Shares:     +100 YES                   │
│  Cost:       $52.34                     │
│                                         │
│  ▼ Fee Breakdown                        │
│  ├── AMM Fee:       $0.15 (0.5%)        │
│  └── Orderbook Fee: $0.00 (0.0%)        │
│                                         │
│  Total Paid: $52.49                     │
└─────────────────────────────────────────┘
```

---

## 4. Selling (Time-Lock Warning)

When a user sells shares, warn them about the time-lock.

```
┌─────────────────────────────────────────┐
│  Sell 100 YES                           │
├─────────────────────────────────────────┤
│  Est. Proceeds: $40.00                  │
│                                         │
│  ⚠️ Note: Proceeds will be locked       │
│  for 48 hours before withdrawal.        │
│                                         │
│  [Confirm Sell]                         │
└─────────────────────────────────────────┘
```

---

## 5. Orderbook Visualization

### Unified View

Since "Sell YES" = "Buy NO", you can show a unified depth chart or orderbook.

- **Buy Side:** Bids for YES.
- **Sell Side:** Asks for YES.

If the user is viewing the **NO** outcome:

- **Buy Side:** Asks for YES (inverted price).
- **Sell Side:** Bids for YES (inverted price).

**Example (NO View):**

- Best Ask for YES is $0.60 -> Show as "Buy NO @ $0.40"
- Best Bid for YES is $0.58 -> Show as "Sell NO @ $0.42"
