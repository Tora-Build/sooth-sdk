# @sooth/contracts-solana

Solana Anchor programs for Sooth Protocol.

## Status: Scaffold Complete ✅

The basic program structure compiles and includes:

- `TraderVault` - User deposits/withdrawals
- `Market` - Prediction market with LMSR state
- `UserPosition` - User's YES/NO token balances
- Basic trade execution

## Quick Start

```bash
# Build
anchor build

# Test
anchor test

# Deploy to localnet
anchor deploy
```

## Structure

```
programs/sooth_protocol/src/
└── lib.rs          # All-in-one program (state + instructions + errors)
```

## Instructions

| Instruction               | Description                        |
| ------------------------- | ---------------------------------- |
| `initialize_trader_vault` | Create the global trader vault     |
| `initialize_user_balance` | Create user's balance account      |
| `deposit`                 | Deposit to trader vault            |
| `withdraw`                | Withdraw from trader vault         |
| `create_market`           | Create a new prediction market     |
| `initialize_position`     | Create user's position in a market |
| `trade`                   | Execute buy/sell trade             |
| `settle_market`           | Settle market with winning outcome |

## Next Steps

- [ ] Add LMSR math integration
- [ ] Add token transfers (SPL Token)
- [ ] Add orderbook support
- [ ] Add LP/Governor vault
- [ ] Write comprehensive tests
