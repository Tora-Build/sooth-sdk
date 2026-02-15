# Interactive On-Chain Testing REPL

A command-line REPL for interactive testing of Sooth Protocol V12 contracts on live testnets.

## Quick Start

```bash
# From monorepo root
pnpm dev:cli:base

# Or from contracts-testing directory
cd packages/contracts-testing
bun run interactive

# Or specify chain
bun run interactive:base
```

## Prerequisites

1. **Private Keys**: Set up test wallets in `.env` (monorepo root):
   ```bash
   # Single actor (uses PRIVATE_KEY)
   PRIVATE_KEY=0x...

   # Multiple actors
   PRIVATE_KEY_ALICE=0x...
   PRIVATE_KEY_BOB=0x...
   PRIVATE_KEY_CHARLIE=0x...
   PRIVATE_KEY_DAVID=0x...
   PRIVATE_KEY_ELLEN=0x...
   ```

2. **Deployment Config**: Ensure `contracts-core/deployments/baseSepolia.json` exists with contract addresses and market data.

## Commands

### Actor Management
```
actor <name>    Switch to actor (alice, bob, charlie, david, ellen, admin)
actors          List all available actors with addresses
```

### Wallet Operations
```
balance         Show USDC + outcome token balances
mint <amount>   Mint MockUSDC to current actor
approve <contract>  Approve contract (launchpad, soothbook, all)
allowance       Show current allowances
```

### SoothBook Orderbook
```
buyyes <tick> <amount> [escrow] [maxcost]   Place YES order at tick
buyno <tick> <amount> [escrow] [maxcost]    Place NO order at tick
sbmint <amount>                             Mint complete set (USDC → YES+NO)
sbmerge <amount>                            Merge back to USDC (YES+NO → USDC)
cancel <side> <tick>                        Cancel oldest order at tick
redeem                                      Redeem winning tokens after resolution
resolve <outcome>                           Resolve market (owner only)
createmarket <name>                         Create SoothBook market (owner only)
```

### SoothBook State Inspection
```
state               Show market state (tokens, backing, implied price)
book [center] [window]  Show orderbook depth around center tick
positions [actor]   Show token balances for all actors
```

### LaunchpadEngine (AMM)
```
createmarket <template> [liquidity]   Create market via LaunchpadEngine
                                      Templates: alien, btcath, lakers, btc75k
graduate [steps]                      Accumulate fees to trigger graduation
marketstatus                          Show comprehensive market status
settle <outcome>                      Settle market (adjudicator only)
finalize                              Finalize settled market
redeem                                Redeem winning ERC20 tokens
redeemamm                             Settle AMM position after settlement
redeemlp [amount|max]                 Redeem LP tokens
pnl [initial]                         Show P&L summary
transferlp <actor> <amount|max>       Transfer LP tokens
```

### Accounting
```
snapshot            Take comprehensive balance snapshot
checksum            Zero-sum verification (run after scenario)
```

### State Selection
```
setmarket <addr|index|key>   Set current market context
```

### Scenarios
```
scenario <name>     Run a predefined scenario
scenarios           List available scenarios
record start        Start recording commands
record stop <name>  Save recorded commands as scenario
playback <name>     Playback a recorded scenario
```

### Debug
```
rpc                 Show RPC status and test connection
invariants          Run all invariant checks
check               Alias for invariants
help                Show available commands
```

## Example Session

```
╔════════════════════════════════════════════════════════════╗
║          SOOTH V12 INTERACTIVE TEST CONSOLE               ║
║ Chain: baseSepolia | Version: V12.0                       ║
║ Market: Will BTC hit 150k in 2026?                        ║
╚════════════════════════════════════════════════════════════╝

  Type "help" for available commands

alice> balance
  Balances for 0xEfdB...74F
  ────────────────────────────────────────
  Wallet USDC: 0.00 USDC
  YES Token:   0.00 YES
  NO Token:    0.00 NO

alice> mint 10000
  ✓ Minted 10,000.00 USDC

alice> approve soothbook
  ✓ Approved SoothBook for unlimited USDC

alice> buyyes 500 100
  ✓ Placed YES order at 50.0% for 100.00 shares

alice> actor bob
  Switched to bob (0x1234...567)

bob> mint 5000
  ✓ Minted 5,000.00 USDC

bob> approve soothbook
  ✓ Approved SoothBook for unlimited USDC

bob> buyno 500 100
  ✓ Placed NO order at 50.0% for 100.00 shares

bob> book 500 5
  SoothBook [center=500, window=5]
  Best YES Tick: 500 | Best NO Tick: 500
  ...

bob> positions
  Positions
  Actor    Address     USDC       YES        NO
  alice    0xEfdB...   9,900.00   0.00       0.00
  bob      0x1234...   4,900.00   0.00       0.00

alice> invariants
  Invariant Checks:
  ──────────────────────────────────────────────────
    [PASS] soothbook.backing
    [PASS] soothbook.marketActive
    [PASS] soothbook.tokenSupply
    [PASS] soothbook.tickRange

  4/4 invariants passed
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
│   ├── index.ts            # Command registry
│   ├── wallet.ts           # mint, approve, balance, allowance, snapshot, checksum
│   ├── soothbook.ts        # buyyes, buyno, mint, merge, cancel, redeem, resolve, book, state, positions, createmarket
│   └── market.ts           # createmarket (launchpad), graduate, marketstatus, settle, finalize, redeem, redeemamm, redeemlp, pnl, transferlp
├── scenarios/
│   ├── engine.ts           # Scenario execution engine
│   ├── library/            # Predefined scenarios (YAML)
│   └── recordings/         # User-recorded scenarios
└── assertions/
    └── invariants.ts       # SoothBook invariant checks
```

## Invariants Checked

| Invariant | Description |
|-----------|-------------|
| `soothbook.backing` | SoothBook USDC balance >= collateral backing for market |
| `soothbook.marketActive` | Market is active (not finalized) |
| `soothbook.tokenSupply` | YES totalSupply == NO totalSupply (complete sets) |
| `soothbook.tickRange` | Best ticks in valid range (0 = empty, or 1-999) |

## SoothBook Concepts

| Concept | Description |
|---------|-------------|
| **Tick** | Price point 1-999 (tick/1000 = probability). E.g., tick 500 = 50% |
| **Auto-match** | When `yesTick + noTick >= 1000`, orders cross and mint a complete set |
| **Complete set** | 1 YES + 1 NO = 1 USDC. `mint` creates, `merge` destroys |
| **Escrow** | If true, shares are held in SoothBook; if false, sent to wallet |
| **Side** | `yes` (1) or `no` (0) |
| **Outcome** | `no` (0), `yes` (1), `invalid` (2) |

## Troubleshooting

### "No actors loaded"
Set `PRIVATE_KEY` or `PRIVATE_KEY_ALICE` in `.env` file.

### "No market selected"
Run `setmarket 0` to select the first market in deployment config, or `setmarket <key>`.

### "SoothBook address not found"
Ensure `contracts-core/deployments/baseSepolia.json` has a `SoothBook` entry in `contracts`.

### Transaction failures
- Check USDC balance with `balance`
- Ensure allowances with `allowance`
- Approve if needed: `approve soothbook` or `approve all`
