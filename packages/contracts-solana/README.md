# @sooth/contracts-solana

Solana Anchor programs for Sooth Protocol.

## Status: Core Features Complete ✅

The program includes:

- ✅ **TraderVault** - User deposits/withdrawals with SPL Token
- ✅ **GovernorVault** - LP deposits/withdrawals with ERC4626 shares
- ✅ **Market** - Prediction market with LMSR pricing
- ✅ **UserPosition** - User's YES/NO token balances
- ✅ **LMSR math** - 59.18 fixed-point arithmetic
- ✅ **Trade execution** - Slippage protection
- ✅ **LP functionality** - Share-based accounting

## Quick Start

```bash
# Build
anchor build

# Test (requires local validator)
anchor test

# Deploy to localnet
anchor deploy
```

## Testing

### Run Tests

```bash
# Start local validator (in separate terminal)
solana-test-validator

# Run tests
anchor test --skip-local-validator
```

### Test Coverage

- ✅ Vault initialization (Trader & Governor)
- ✅ User balance creation
- ✅ USDC deposits/withdrawals (Trader)
- ✅ LP deposits/withdrawals (Governor)
- ✅ Market creation
- ✅ Position initialization
- ✅ Buy/sell trades with LMSR pricing
- ✅ Market settlement

## Structure

```
programs/sooth_protocol/src/
├── lib.rs          # Main program (instructions + accounts)
└── lmsr.rs         # LMSR math module
```

## Instructions

### Trader Vault

| Instruction               | Description                     |
| ------------------------- | ------------------------------- |
| `initialize_trader_vault` | Create the global trader vault  |
| `initialize_user_balance` | Create user's balance account   |
| `deposit`                 | Deposit USDC to trader vault    |
| `withdraw`                | Withdraw USDC from trader vault |

### Governor Vault (LP)

| Instruction                 | Description                       |
| --------------------------- | --------------------------------- |
| `initialize_governor_vault` | Create the LP vault               |
| `initialize_lp_balance`     | Create LP's share balance account |
| `lp_deposit`                | Deposit USDC, receive LP shares   |
| `lp_withdraw`               | Burn LP shares, withdraw USDC     |

### Markets & Trading

| Instruction           | Description                        |
| --------------------- | ---------------------------------- |
| `create_market`       | Create a new prediction market     |
| `initialize_position` | Create user's position in a market |
| `trade`               | Execute buy/sell trade with LMSR   |
| `settle_market`       | Settle market with winning outcome |

### Orderbook

| Instruction          | Description                         |
| -------------------- | ----------------------------------- |
| `create_limit_order` | Create limit order, lock collateral |
| `cancel_order`       | Cancel order, refund collateral     |
| `match_orders`       | Manually match two orders           |

## Next Steps

- [ ] Add fee collection
- [ ] Deploy to Devnet
- [ ] Write comprehensive docs
- [ ] Frontend integration
- [ ] Keeper bot for auto-matching
