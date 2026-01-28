# Interactive CLI Testing

**Status**: Full REPL for on-chain testing ✅  
**Location**: `packages/contracts-testing/script/interactive/`  
**Chains**: Base Sepolia, Monad Testnet

---

## 🚀 Quick Start

```bash
cd packages/contracts-testing
bun run script/interactive/interactive-test.ts --chain=baseSepolia
```

**Output**:
```
Connected to Base Sepolia (chainId: 84532)
Loaded deployment:
  - TickBookPoolManager: 0xac4d5854719ba80dfef344bf6b9357492ea73a95
  - Collateralizer: 0x0bf4b644626d2bf5c6f608e176efdff71ed02856
  - AMMEngine: 0xa02367e6c3adb22ccba67aad42cfd97cdacda82d
  - LaunchpadEngine: 0x6c6e2cd8177055a14caf69701f670f7b61bf3106
  - MockUSDC: 0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3

sooth> 
```

---

## 📋 Commands

### Market Creation

```bash
sooth> createmarket "Bitcoin $100k" "BTC100K" 1000

Creating market...
✓ Market: 0x...
✓ Activated
✓ Registered with TickBook
Status: LIVE
```

### Market Operations

```bash
# Graduate market (via trades)
sooth> graduate 50 4
Starting graduation...
Trade 1/4: +1247 fees (14% progress)
Trade 2/4: +1156 fees (29% progress)
Trade 3/4: +1089 fees (44% progress)
Trade 4/4: +1023 fees (60% progress)
⚠️  Graduation incomplete at 60%

# Check market status
sooth> marketstatus
Market: Bitcoin $100k
  State: LIVE
  Progress: 60%
  CreatorDeposit: 1000 USDC
  FeesAccrued: 4515 USDC

# List markets
sooth> markets
1. Bitcoin $100k (BTC100K) — 60% to graduation
2. Ethereum $5k (ETH5K) — 45% to graduation
```

---

### Trading Commands

```bash
# Place market order
sooth> placeorder YES 500 1 999 750
OrderID: 42
Filled: 500 shares
Cost: 250 USDC

# Place limit order
sooth> placeorder YES 100 500 500 50
OrderID: 43
Filled: 0 shares (resting)
Cost: 0 USDC

# View orderbook
sooth> orderbook
YES ticks:
  300: 100 shares @ 30%
  400: 250 shares @ 40%
  500: 500 shares @ 50%
  600: 300 shares @ 60%
NO ticks:
  300: 200 shares @ 70%
  ...
```

---

### Simulation

```bash
# Simulate trading scenarios
sooth> simulate
  Step 1: Place 100 YES limit @ 450
  Step 2: Place 200 NO range @ (400-600)
  Step 3: Place 150 YES market
  Step 4: Check fills
  
Result:
  - 100 YES limit: 0/100 filled (resting)
  - 200 NO range: 150/200 filled
  - 150 YES market: 150/150 filled
```

---

## 🎯 Common Workflows

### Workflow 1: Create and Graduate

```bash
sooth> createmarket "Test Market" "TEST" 1000
✓ Market created: 0x...

sooth> graduate 100 10
Graduation progress: 0% → 100%
✓ Market graduated (fees: 5% → 1%)

sooth> marketstatus
Status: LIVE (Graduated)
```

---

### Workflow 2: Test Graduation Impact

```bash
sooth> setmarket 0x...

# Check pre-grad state
sooth> placeorder YES 100 500 500 75
✓ Cost: 50 USDC (with 5% fee = 52.5 total)

# Graduate
sooth> graduate 50 4
✓ Graduated

# Check post-grad state
sooth> placeorder YES 100 500 500 50.5
✓ Cost: 50 USDC (with 1% fee = 50.5 total)
# Notice: fee dropped from 5% to 1%
```

---

### Workflow 3: Multi-User Simulation

```bash
sooth> setmarket 0x...

# Create multiple wallets
sooth> wallet alice
sooth> wallet bob
sooth> wallet charlie

# Each trades
sooth> placeorder --from alice YES 100 500 500 50
sooth> placeorder --from bob NO 100 500 500 50
sooth> placeorder --from charlie YES 200 450 550 100

# Check all orders
sooth> orderbook
  Alice: 100 YES @ 50%
  Bob: 100 NO @ 50%
  Charlie: 200 YES range (45-55%)
```

---

## 🛠️ Setup Commands

### Set Active Market

```bash
sooth> setmarket 0x123...

# Or use index
sooth> m 1  # Switch to market 1
```

### Wallet Management

```bash
# View current wallet
sooth> wallet
Current: 0x1234...

# Switch wallet
sooth> wallet bob
Switched to: bob (0x5678...)

# Create new wallet
sooth> wallet alice
Created: alice (0x9abc...)
```

### Deposit USDC

```bash
# Deposit MockUSDC for testing
sooth> deposit 1000
✓ Deposited 1000 USDC
Balance: 1000 USDC
```

---

## 📊 Query Commands

### List Markets

```bash
sooth> m
sooth> markets

1. Bitcoin $100k (BTC100K)
   Creator: 0x123...
   Status: LIVE (65% to graduation)
   TVL: 5000 USDC

2. Ethereum $5k (ETH5K)
   Creator: 0x456...
   Status: LIVE (30% to graduation)
   TVL: 2000 USDC
```

### Market Details

```bash
sooth> state
sooth> marketstatus

Market: Bitcoin $100k
State: LIVE
Deadline: Jan 1 2025
CreatorDeposit: 1000 USDC
FeesAccrued: 1500 USDC
GraduationProgress: 65%
ReservesYES: 2000
ReservesNO: 2000
CurrentTickYES: 500
CurrentTickNO: 500
```

### Orderbook

```bash
sooth> orderbook
sooth> ob

Orderbook for Bitcoin $100k:
YES side:
  300 ticks: 100 shares
  400 ticks: 250 shares
  500 ticks: 500 shares

NO side:
  200 ticks: 150 shares
  300 ticks: 300 shares

Total liquidity: 1300 shares
```

---

## 🔧 Configuration

### Change Chain

```bash
# At startup
bun run script/interactive/interactive-test.ts --chain=monadTestnet

# Or in REPL
sooth> setchain monadTestnet
Switched to Monad Testnet (chainId: 10143)
```

### Use Custom RPC

```bash
bun run script/interactive/interactive-test.ts \
  --chain=baseSepolia \
  --rpc=https://custom-rpc.example.com
```

---

## 📝 Advanced Usage

### Scripted Scenarios

```bash
# Run predefined scenario
sooth> load scenarios/graduation.yaml

# Scenario file:
# steps:
#   - action: createmarket
#     params: {name: "Test", liquidity: 1000}
#   - action: graduate
#     params: {tradeSize: 50, numTrades: 10}
#   - action: validate
#     params: {graduated: true}
```

### Export Results

```bash
sooth> export results.json
✓ Saved to results.json

# Contains:
# {
#   "markets": [...],
#   "trades": [...],
#   "gas": {...},
#   "timings": {...}
# }
```

---

## 🐛 Troubleshooting

### "Market not found"
```bash
sooth> markets  # List all
sooth> setmarket <address>  # Use correct address
```

### "Insufficient balance"
```bash
sooth> deposit 1000  # Get more USDC
```

### "RPC timeout"
```bash
# Try different RPC
bun run script/interactive/interactive-test.ts --rpc=https://... 
```

### "Transaction failed"
```bash
sooth> state  # Check current state
# May be incorrect state for operation
```

---

## 🎓 Learning Path

1. **Start**: `createmarket` + `marketstatus`
2. **Trade**: `placeorder` + `orderbook`
3. **Experiment**: `simulate` + `graduate`
4. **Advanced**: Multi-user workflows, custom scenarios

---

## 📚 Available Commands

```bash
# Markets
createmarket <name> <symbol> <liquidity>
setmarket <address>
markets / m
marketstatus / state

# Trading
placeorder <outcome> <shares> <tickLower> <tickUpper> <maxCost>
orderbook / ob
getAllOrders
simulate

# Wallets
wallet [name]
deposit <amount>

# Admin
graduate <tradeSize> <numTrades>
setchain <name>
export <filename>
help
exit / quit
```

---

**Last Updated**: 2026-01-03  
**Status**: Full REPL testing ✅  
**Chains**: Base Sepolia, Monad Testnet
