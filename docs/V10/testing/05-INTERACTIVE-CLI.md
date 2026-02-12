# V10 Interactive CLI Testing

**Date**: 2026-01-06  
**Version**: V10.0.0  
**Read Time**: 10 mins

---

## Overview

The Interactive CLI provides a REPL for testing V10 functionality without writing scripts. Perfect for manual testing, debugging, and exploration.

---

## Quick Start

### Launch

```bash
cd packages/contracts-core
bun run script/interactive/interactive-test.ts --chain=baseSepolia
```

### Basic Commands

```
> help                    # Show all commands
> markets                 # List available markets
> setmarket <address>     # Select a market
> marketstatus            # Show market state
> simulate                # Run trading simulation
```

---

## V10-Specific Commands

### Spot Sell Commands

```
> spotsell <outcome> <shares> <tickLower> <tickUpper>
  Place a spot sell order (requires existing shares)
  
  Example:
  > spotsell 1 100 600 600
  Placing spot sell: 100 YES shares at tick 600

> cancelspotsell <orderId>
  Cancel a spot sell order
  
> claimspotsell <orderId>
  Claim proceeds from a spot sell
```

### Hybrid Sell Commands

```
> hybridsell <outcome> <shares> <tickLower> <tickUpper>
  Split sell between spot + short (for users with shares)
  
  Example:
  > hybridsell 1 200 550 600
  Hybrid sell: 100 spot + 100 short
```

### Unified Order Commands

```
> placeorder <outcome> <shares> <tickLower> <tickUpper> <maxCost>
  Place unified order (V10 unified crossing)
  
  Example:
  > placeorder 1 500 400 600 300
  Order placed: ID 42, filled 200, resting 300

> cancelorder <orderId>
  Cancel a resting order

> claimfills <orderId>
  Claim filled shares from order
```

---

## Market Commands

### Create Market

```
> createmarket <template> [liquidity]
  Create a new market from template
  
  Templates: alien, btc100k, test
  
  Example:
  > createmarket alien 100
  Creating "UN Confirms Alien Life" with 100 USDC liquidity
  Market: 0x1234...
  YES Token: 0xabcd...
  NO Token: 0xdef0...
```

### Graduate Market

```
> graduate [tradeSize] [numTrades]
  Execute trades to accumulate fees until graduation
  
  Example:
  > graduate 500 8
  Progress: 23% -> 45% -> 67% -> 89% -> 100%
  Market graduated!
```

### Market Status

```
> marketstatus
  Show comprehensive market state
  
  === Market Status ===
  Market: 0x1234...
  State: LIVE
  Deadline: 2026-02-05
  
  === AMM State ===
  YES Supply: 1,234.56
  NO Supply: 1,234.56
  YES Price: 0.52
  NO Price: 0.48
  
  === TickBook State ===
  Active Orders: 12
  YES Liquidity: 500 @ ticks 400-600
  NO Liquidity: 300 @ ticks 350-550
  Spot Sells: 200 YES @ tick 580
  
  === Graduation ===
  Progress: 45% (4,500 / 10,000 bps)
  Fees Accrued: 234.56 USDC
```

---

## Simulation Commands

### Basic Simulation

```
> simulate
  Run default trading simulation
  
  Simulation Plan:
  1. Place 3 range orders (YES, NO, YES)
  2. Execute 5 market orders
  3. Report fills and costs
  
  Results:
  Order 1: Filled 200/500, Cost 98.5 USDC
  Order 2: Filled 150/300, Cost 45.2 USDC
  ...
```

### Custom Simulation

```
> simulate --scenario=orderbook
  Run orderbook stress test
  
> simulate --scenario=crossing
  Test unified crossing behavior
  
> simulate --scenario=spotfirst
  Verify spot-first priority
```

---

## Account Management

### Check Balances

```
> balances
  USDC: 10,000.00
  Available: 5,000.00
  Locked: 2,000.00
  
  Positions:
  Market 0x1234:
    YES: 500.00
    NO: 200.00
```

### Deposit/Withdraw

```
> deposit 1000
  Depositing 1000 USDC to vault
  
> withdraw 500
  Withdrawing 500 USDC from vault
```

### Mint Test USDC

```
> mint 10000
  Minting 10,000 test USDC (testnet only)
```

---

## Debugging Commands

### Inspect Order

```
> order <orderId>
  Order #42
  Owner: 0xabcd...
  Outcome: YES
  Shares: 500
  Filled: 200 (40%)
  Ticks: 400-600
  Active: true
  Cost: 95.5 USDC
```

### Inspect Tick

```
> tick <outcome> <tick>
  Tick 500 (YES)
  Range Liquidity Net: 1,000
  Range Liquidity Gross: 2,500
  Spot Liquidity: 300
  Bitmap Set: true
```

### Inspect Spot Sell

```
> spotsellorder <orderId>
  Spot Sell #7
  Owner: 0xdef0...
  Outcome: YES
  Shares: 200
  Filled: 50 (25%)
  Ticks: 580-600
  Active: true
  Proceeds: 28.5 USDC
```

---

## Common Workflows

### Test Unified Crossing

```bash
# 1. Select market
> setmarket 0x1234...

# 2. Place range order (NO side)
> placeorder 0 500 400 600 300
Order 1 placed

# 3. Place spot sell (YES side)
> spotsell 1 200 500 500
Spot sell 1 placed

# 4. Place crossing order (YES buy)
> placeorder 1 300 450 550 200
Order 2 placed: filled 200 (spot first), resting 100

# 5. Verify spot was consumed
> spotsellorder 1
Filled: 200 (100%)
```

### Test Graduation

```bash
# 1. Create market
> createmarket test 100

# 2. Check initial progress
> marketstatus
Progress: 0%

# 3. Graduate
> graduate 500 10

# 4. Verify
> marketstatus
Progress: 100% (graduated)
```

---

## Configuration

### Chain Selection

```bash
# Base Sepolia (default)
bun run script/interactive/interactive-test.ts --chain=baseSepolia

# Monad Testnet
bun run script/interactive/interactive-test.ts --chain=monadTestnet

# Local Anvil
bun run script/interactive/interactive-test.ts --chain=localhost
```

### Environment Variables

```bash
# .env
PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
```

---

## Tips

### Autocomplete

Use Tab for command completion:
```
> mark<TAB>
> markets  marketstatus
```

### History

Use Up/Down arrows to navigate command history.

### Logging

```
> loglevel debug
  Showing debug output

> loglevel info
  Normal output
```

---

## Troubleshooting

### "MarketNotLive" Error

Market hasn't been activated. Use `marketstatus` to check state.

### "InsufficientBalance" Error

Check balances with `balances`. Deposit more USDC or mint test tokens.

### "SlippageExceeded" Error

Increase `maxCost` parameter in order commands.

### RPC Timeout

Check RPC URL. Try different RPC endpoint or reduce batch size.

---

## Next Steps

- **[06-BENCHMARKS.md](./06-BENCHMARKS.md)** - Gas benchmarks
- **[TESTING-REVIEW.md](./TESTING-REVIEW.md)** - Coverage analysis
