# Interactive On-Chain Testing Flow Design

> **Status**: Design Document
> **Date**: 2026-01-01
> **Author**: QA Engineering

## Overview

This document describes an interactive testing framework for Sooth Protocol V9 that enables:
1. **Live on-chain testing** against testnet deployments
2. **REPL-style interaction** for exploratory testing
3. **Scenario playback** for regression testing
4. **Multi-actor simulation** for stress testing

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Interactive Test Runner                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  CLI/REPL     │───►│ Scenario     │───►│ Chain Executor       │  │
│  │  Interface    │    │ Engine       │    │ (viem + actors)      │  │
│  └───────────────┘    └──────────────┘    └──────────────────────┘  │
│         │                    │                      │               │
│         ▼                    ▼                      ▼               │
│  ┌───────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  Command      │    │ Scenario     │    │ Assertion            │  │
│  │  Parser       │    │ Library      │    │ Engine               │  │
│  └───────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    On-Chain Contracts                               │
├─────────────────────────────────────────────────────────────────────┤
│  TickBookPoolManager │ TickBookVault │ LaunchpadEngine │ AMMEngine │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. CLI/REPL Interface (`interactive-test.ts`)

A command-line REPL that allows testers to:
- Execute individual operations (mint, deposit, place order, etc.)
- Run predefined scenarios
- Inspect on-chain state
- Switch between actors (simulated users)

```bash
# Launch interactive session
bun run test:interactive --chain=baseSepolia

# Example REPL session
sooth> actor alice         # Switch to Alice's wallet
sooth> mint 10000          # Mint 10k USDC
sooth> deposit 5000        # Deposit to vault
sooth> order yes 40-60 100 # Place YES order at 40-60% for 100 shares
sooth> actor bob           # Switch to Bob
sooth> market buy no 50    # Bob buys 50 NO shares (crosses Alice's order)
sooth> check fills alice   # Check Alice's fills
sooth> scenario roundtrip  # Run predefined roundtrip scenario
```

### 2. Actor System

Pre-configured test wallets with dedicated roles:

```typescript
interface Actor {
  name: string;
  privateKey: string;
  role: 'maker' | 'taker' | 'arbitrageur' | 'keeper';
}

const ACTORS: Actor[] = [
  { name: 'alice', privateKey: '...', role: 'maker' },
  { name: 'bob', privateKey: '...', role: 'taker' },
  { name: 'charlie', privateKey: '...', role: 'arbitrageur' },
  { name: 'keeper', privateKey: '...', role: 'keeper' },
];
```

### 3. Command System

#### Wallet Commands
| Command | Description | Example |
|---------|-------------|---------|
| `actor <name>` | Switch active actor | `actor alice` |
| `balance` | Show USDC + vault balances | `balance` |
| `mint <amount>` | Mint MockUSDC | `mint 10000` |
| `approve <contract>` | Approve contract | `approve vault` |

#### Vault Commands
| Command | Description | Example |
|---------|-------------|---------|
| `deposit <amount>` | Deposit to TickBookVault | `deposit 5000` |
| `withdraw <amount>` | Withdraw from vault | `withdraw 1000` |
| `reserved` | Show reserved balance | `reserved` |

#### Orderbook Commands (V9.9.6 Unified API)

> **Note**: V9.9.6 uses a single `placeOrder()` function. Order type is determined by tick range:
> - Market order: `tickLower=1, tickUpper=999`
> - Limit order: `tickLower=X, tickUpper=X`
> - Range order: `tickLower < tickUpper`
> - Market with floor: `tickLower=floor, tickUpper=999`

| Command | Description | Example |
|---------|-------------|---------|
| `limit <outcome> <price> <shares>` | Place limit order (single tick) | `limit yes 50 100` |
| `range <outcome> <low-high> <shares>` | Place range order | `range yes 40-60 100` |
| `market <outcome> <shares>` | Market order (full range 1-999) | `market yes 50` |
| `floor <outcome> <floor> <shares>` | Market with floor | `floor yes 40 100` |
| `cancel <orderId>` | Cancel order | `cancel 5` |
| `orders` | List my active orders | `orders` |

> **Auto-claim**: V9.9.6 automatically claims pending fills before placing new orders.

#### State Commands
| Command | Description | Example |
|---------|-------------|---------|
| `state` | Show market state (tick, liquidity) | `state` |
| `book` | Show orderbook (bids/asks) | `book` |
| `fills <actor>` | Check pending fills | `fills alice` |
| `positions` | Show all actor positions | `positions` |

#### Scenario Commands
| Command | Description | Example |
|---------|-------------|---------|
| `scenario <name>` | Run predefined scenario | `scenario graduation` |
| `record start` | Start recording commands | `record start` |
| `record stop <name>` | Save recorded scenario | `record stop my-test` |
| `playback <name>` | Playback saved scenario | `playback my-test` |

### 4. Scenario Library

Predefined test scenarios that can be played back:

#### `basic-roundtrip`
```yaml
name: basic-roundtrip
description: Place order, cross it, claim fills
steps:
  - actor: alice
    action: deposit
    amount: 10000
  - actor: alice
    action: order
    outcome: yes
    tickRange: [400, 600]
    shares: 100
  - actor: bob
    action: deposit
    amount: 10000
  - actor: bob
    action: market
    side: buy
    outcome: no
    shares: 50
  - actor: alice
    action: claim
    orderId: "$lastOrderId"
assertions:
  - alice.fills > 0
  - bob.positions.no == 50
```

#### `graduation-flow`
```yaml
name: graduation-flow
description: Trade until market graduates
steps:
  - actor: alice
    action: deposit
    amount: 100000
  - loop:
      count: 10
      steps:
        - action: trade
          deltaShares: 5000
        - action: trade
          deltaShares: -4000
        - checkpoint: graduationProgress
assertions:
  - market.isGraduated == true
```

#### `stress-orderbook`
```yaml
name: stress-orderbook
description: Many concurrent orders to stress test
steps:
  - parallel:
      - actor: alice
        repeat: 20
        action: order
        outcome: yes
        tickRange: random(100, 900)
        shares: random(10, 100)
      - actor: bob
        repeat: 20
        action: order
        outcome: no
        tickRange: random(100, 900)
        shares: random(10, 100)
  - actor: charlie
    repeat: 50
    action: market
    side: random
    outcome: random
    shares: random(5, 20)
```

### 5. Assertion Engine

Built-in assertions for validating invariants:

```typescript
interface AssertionContext {
  actors: Record<string, ActorState>;
  market: MarketState;
  vault: VaultState;
  orders: OrderState[];
}

const ASSERTIONS = {
  // Vault solvency
  'vault.solvent': (ctx) => {
    const totalClaims = sum(ctx.actors, a => a.available + a.reserved);
    return totalClaims <= ctx.vault.balance;
  },

  // No fill overflow
  'orders.noOverflow': (ctx) => {
    return ctx.orders.every(o => o.filledShares <= o.sharesTotal);
  },

  // Tick consistency
  'market.tickValid': (ctx) => {
    return ctx.market.tick >= 1 && ctx.market.tick <= 999;
  },
};
```

## Implementation Plan

### Phase 1: Core REPL (MVP)

**Files to create:**
```
packages/contracts-testing/script/interactive/
├── interactive-test.ts      # Main REPL entry point
├── commands/
│   ├── wallet.ts            # mint, approve, balance
│   ├── vault.ts             # deposit, withdraw
│   ├── orderbook.ts         # order, cancel, claim, market
│   └── state.ts             # state, book, positions
├── actors.ts                # Actor management
├── config.ts                # Chain + contract config
└── utils.ts                 # Formatting, parsing
```

**Dependencies:**
- `bun` (runtime)
- `viem` (chain interaction)
- `readline` or `enquirer` (REPL interface)
- `chalk` (colored output)

### Phase 2: Scenario Engine

**Files to add:**
```
packages/contracts-testing/script/interactive/
├── scenarios/
│   ├── engine.ts            # Scenario execution engine
│   ├── parser.ts            # YAML scenario parser
│   └── library/
│       ├── basic-roundtrip.yaml
│       ├── graduation-flow.yaml
│       └── stress-orderbook.yaml
└── assertions/
    ├── engine.ts            # Assertion runner
    └── invariants.ts        # Predefined invariants
```

### Phase 3: Recording & Playback

**Features:**
- Record REPL commands to YAML scenario
- Playback scenarios with variable substitution
- Diff actual vs expected state
- Generate test reports

### Phase 4: CI Integration

**Files to add:**
```
packages/contracts-testing/
├── script/interactive/
│   └── ci-runner.ts         # Headless scenario runner
└── .github/workflows/
    └── interactive-tests.yml # CI workflow
```

## Usage Examples

### Example 1: Manual Exploratory Testing

```bash
$ bun run test:interactive --chain=baseSepolia

╔════════════════════════════════════════════════════════════╗
║           SOOTH V9 INTERACTIVE TEST CONSOLE                 ║
║ Chain: baseSepolia | Market: BTC100K (0x45Fd...)            ║
╚════════════════════════════════════════════════════════════╝

sooth> actor alice
Switched to alice (0xEfdB...74F)

sooth> balance
  Wallet USDC: 0.00
  Vault Available: 0.00
  Vault Reserved: 0.00

sooth> mint 10000
✓ Minted 10,000 USDC (tx: 0xabc...)

sooth> deposit 5000
✓ Deposited 5,000 USDC to vault (tx: 0xdef...)

sooth> order yes 45-55 100
✓ Placed YES order #7 at ticks 450-550 for 100 shares
  Collateral locked: 52.50 USDC

sooth> actor bob
Switched to bob (0x1234...567)

sooth> mint 5000 && deposit 5000
✓ Minted 5,000 USDC
✓ Deposited 5,000 USDC

sooth> market buy no 50
✓ Bought 50 NO shares for 25.12 USDC
  Crossed 50 shares from order #7

sooth> actor alice
Switched to alice

sooth> claim 7
✓ Claimed 50 shares filled, received 25.00 USDC proceeds
```

### Example 2: Running a Scenario

```bash
sooth> scenario basic-roundtrip

Running scenario: basic-roundtrip
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1/5: alice.deposit(10000)
  ✓ Deposited 10,000 USDC

Step 2/5: alice.order(yes, 400-600, 100)
  ✓ Placed order #8

Step 3/5: bob.deposit(10000)
  ✓ Deposited 10,000 USDC

Step 4/5: bob.market(buy, no, 50)
  ✓ Bought 50 NO shares

Step 5/5: alice.claim(#8)
  ✓ Claimed 50 shares

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Assertions:
  ✓ alice.fills > 0
  ✓ bob.positions.no == 50
  ✓ vault.solvent

Scenario PASSED in 12.3s (5 transactions)
```

### Example 3: Recording a Custom Test

```bash
sooth> record start
Recording started. Use 'record stop <name>' to save.

sooth> actor alice
sooth> mint 1000
sooth> deposit 500
sooth> order no 30-40 25

sooth> record stop my-limit-order-test
✓ Saved scenario to scenarios/library/my-limit-order-test.yaml

sooth> playback my-limit-order-test
Running scenario: my-limit-order-test
...
```

## Configuration

### Environment Variables

```bash
# .env
PRIVATE_KEY_ALICE=0x...
PRIVATE_KEY_BOB=0x...
PRIVATE_KEY_CHARLIE=0x...
PRIVATE_KEY_KEEPER=0x...

# Chain selection
DEFAULT_CHAIN=baseSepolia
```

### Config File (`interactive.config.ts`)

```typescript
export const config = {
  chains: {
    baseSepolia: {
      rpc: 'https://sepolia.base.org',
      deploymentPath: '../deployments/v9-baseSepolia.json',
    },
    monadTestnet: {
      rpc: 'https://testnet-rpc.monad.xyz',
      deploymentPath: '../deployments/v9-monadTestnet.json',
    },
  },
  defaultMarket: 'BTC100K', // or address
  gasMultiplier: 1.5,
  confirmations: 1,
};
```

## Comparison with Existing Tools

| Feature | Foundry Fork | HFT Benchmark | Interactive REPL |
|---------|--------------|---------------|------------------|
| Live chain | No (local fork) | Yes | Yes |
| Multi-actor | Yes (vm.prank) | No | Yes |
| Interactive | No | No | Yes |
| Recording | No | No | Yes |
| Scenarios | Test files | Hardcoded | YAML library |
| Assertions | Solidity | Manual | Built-in engine |
| CI-ready | Yes | Partial | Yes |

## Security Considerations

1. **Testnet Only**: This tool uses private keys and should ONLY be used on testnets
2. **Key Management**: Actor private keys should be dedicated test keys, not mainnet keys
3. **No Secrets in Scenarios**: Scenario files should use environment variable references, not hardcoded keys

## Next Steps

1. [x] Implement Phase 1 MVP (core REPL + basic commands)
2. [x] Test against Base Sepolia deployment
3. [ ] **Update to V9.9.6 API** — Replace `placeRangeOrder`/`executeMarketOrder` with `placeOrder`
4. [ ] Add scenario engine (Phase 2)
5. [ ] Create scenario library for V9.9.6 features (auto-claim, market with floor)
6. [ ] Add recording/playback (Phase 3)
7. [ ] CI integration (Phase 4)

## V9.9.6 Migration Notes

The interactive CLI currently uses the old V9.9.5 API:
- `placeRangeOrder(marketKey, outcome, tickLower, tickUpper, shares)`
- `executeMarketOrder(marketKey, outcome, shares, maxCost)`

These should be replaced with the unified V9.9.6 API:
- `placeOrder(marketKey, outcome, shares, tickLower, tickUpper, maxCost)`

**Files to update:**
- `commands/orderbook.ts` — Replace function calls
- `commands/market.ts` — Replace function calls
- `config.ts` — Update ABI definitions

---

*Last updated: 2026-01-01*
