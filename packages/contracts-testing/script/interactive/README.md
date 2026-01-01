# Interactive On-Chain Testing REPL

A command-line REPL for interactive testing of Sooth Protocol V9 contracts on live testnets.

## Quick Start

```bash
# From contracts-testing directory
cd packages/contracts-testing

# Run against Base Sepolia (default)
bun run interactive

# Or specify chain
bun run interactive:base
bun run interactive:monad
```

## Prerequisites

1. **Private Keys**: Set up test wallets in `.env`:
   ```bash
   # Single actor (uses PRIVATE_KEY)
   PRIVATE_KEY=0x...

   # Multiple actors
   PRIVATE_KEY_ALICE=0x...
   PRIVATE_KEY_BOB=0x...
   PRIVATE_KEY_CHARLIE=0x...
   PRIVATE_KEY_KEEPER=0x...
   ```

2. **Deployment Config**: Ensure `contracts-core/deployments/v9-baseSepolia.json` exists with market data.

3. **Market Key Info**: For market commands to work, add `yesToken`, `noToken`, and optionally `marketKey` to market entries in deployment config.

## Commands

### Actor Management
```
actor <name>    Switch to actor (alice, bob, charlie, keeper, admin)
actors          List all available actors with addresses
```

### Wallet Operations
```
balance         Show USDC balances (wallet + vault)
mint <amount>   Mint MockUSDC to current actor
approve <contract>  Approve contract (vault, poolmanager, launchpad, all)
allowance       Show current allowances for all contracts
```

### Vault Operations
```
deposit <amount>    Deposit USDC to TickBookVault
withdraw <amount>   Withdraw USDC from vault (or "max")
reserved            Show reserved balance details
```

### Orderbook Operations
```
order <side> <range> <shares>   Place a range order
                                Example: order yes 40-60 100

cancel <orderId>                Cancel an order
claim <orderId>                 Claim fills on an order
orders [actor]                  List orders for actor

market buy|sell <side> <shares> Execute market order
                                Example: market buy no 50

getorder <orderId>              Get detailed order info
```

### State Inspection
```
state               Show market state (tick, liquidity, probability)
book [depth]        Show orderbook with active orders
positions           Show all actor positions
info                Show market info (addresses)
setmarket <addr>    Set current market by address or index
```

### Scenarios
```
scenario <name>     Run a predefined scenario
scenarios           List available scenarios
record start        Start recording commands
record stop <name>  Save recorded commands as scenario
playback <name>     Playback a recorded scenario
```

### Market Lifecycle
```
createmarket <template> [liquidity]   Create new market (alien, btc100k)
                                      Example: createmarket alien 500
graduate [steps]                      Graduate market via trades (default 8)
marketstatus                          Show full market lifecycle status
```

### Simulation
```
simulate [n] [size] [seed]   Run orderbook simulation
                             n:    Number of orders (default 10)
                             size: Average shares (default 100)
                             seed: Random seed for reproducibility

                             Press Enter during simulation to stop early

Examples:
  simulate              10 random orders
  simulate 50           50 orders
  simulate 20 500       20 orders, 500 avg size
  simulate 20 100 12345 Deterministic with seed 12345

Order types generated:
  - Range orders (70%): Random tick ranges within 10-90%
  - Limit orders (20%): Single-tick orders at specific prices
  - Market orders (10%): Full range 1-999 for immediate fills
```

### Debug
```
rpc                 Show RPC status and test connection
call <contract> <fn>  Raw contract call for debugging
```

### Invariant Checks
```
invariants          Run all invariant checks
check               Alias for invariants
```

## Example Session

```
╔════════════════════════════════════════════════════════════╗
║          SOOTH V9 INTERACTIVE TEST CONSOLE                  ║
║ Chain: baseSepolia | Version: 9.9.6                         ║
║ Market: BTC100K                                             ║
╚════════════════════════════════════════════════════════════╝

  Type "help" for available commands

alice> balance
  Balances for 0xEfdB...74F
  ────────────────────────────────────────
  Wallet USDC:     0.00 USDC
  Vault Available: 0.00 USDC
  Vault Reserved:  0.00 USDC

alice> mint 10000
  ✓ Minted 10,000.00 USDC (tx: 0xabc123...)

alice> deposit 5000
  ✓ Deposited 5,000.00 USDC to vault (tx: 0xdef456...)

alice> order yes 40-60 100
  ✓ Placed YES order at 40.0%-60.0% for 100.00 shares (tx: 0x789...)

alice> actor bob
  Switched to bob (0x1234...567)

bob> mint 5000
  ✓ Minted 5,000.00 USDC (tx: 0xaaa...)

bob> deposit 5000
  ✓ Deposited 5,000.00 USDC to vault (tx: 0xbbb...)

bob> market buy no 50
  ✓ Bought 50.00 NO shares (tx: 0xccc...)

bob> actor alice
  Switched to alice (0xEfdB...74F)

alice> claim 1
  ✓ Claimed fills for order #1 (tx: 0xddd...)

alice> invariants
  Invariant Checks:
  ──────────────────────────────────────────────────
    [PASS] vault.solvent
    [PASS] orders.noOverflow
    [PASS] market.tickValid
    [PASS] vault.reservedBounds

  4/4 invariants passed
```

## Predefined Scenarios

| Name | Description |
|------|-------------|
| `basic-roundtrip` | Place order, cross it, claim fills |
| `multi-actor-orderbook` | Multiple actors placing and crossing orders |
| `order-lifecycle` | Complete order lifecycle with partial fills |
| `stress-orderbook` | Stress test with many orders |

Run a scenario:
```
alice> scenario basic-roundtrip
```

## Recording Custom Scenarios

```
alice> record start
Recording started

alice> mint 1000
alice> deposit 500
alice> order no 30-40 25

alice> record stop my-test
✓ Saved scenario to: scenarios/recordings/my-test.yaml

alice> playback my-test
Running scenario: my-test
...
```

## File Structure

```
script/interactive/
├── interactive-test.ts     # Main REPL entry point
├── config.ts               # Chain configs, ABIs, deployment loading
├── actors.ts               # Actor management system
├── utils.ts                # Formatting, parsing, UI helpers
├── commands/
│   ├── types.ts            # Command types
│   ├── wallet.ts           # mint, approve, balance
│   ├── vault.ts            # deposit, withdraw, reserved
│   ├── orderbook.ts        # order, cancel, claim, market
│   ├── state.ts            # state, book, positions, rpc
│   └── market.ts           # createmarket, graduate, marketstatus, simulate
├── scenarios/
│   ├── engine.ts           # Scenario execution engine
│   ├── library/            # Predefined scenarios (YAML)
│   └── recordings/         # User-recorded scenarios
└── assertions/
    └── invariants.ts       # Invariant check functions
```

## Invariants Checked

| Invariant | Description |
|-----------|-------------|
| `vault.solvent` | Total claims <= vault USDC balance |
| `orders.noOverflow` | filledShares <= sharesTotal for all orders |
| `market.tickValid` | Tick in range 1-999, consistent with probability |
| `vault.reservedBounds` | Reserved <= available for all actors |

## Troubleshooting

### "No actors loaded"
Set `PRIVATE_KEY` or `PRIVATE_KEY_ALICE` in `.env` file.

### "No market selected"
Run `setmarket 0` to select the first market in deployment config, or `setmarket <address>`.

### "Cannot compute market key"
Add `yesToken` and `noToken` fields to the market entry in deployment config.

### Transaction failures
- Check vault balance with `balance`
- Ensure allowances with `allowance`
- Approve if needed: `approve all`
