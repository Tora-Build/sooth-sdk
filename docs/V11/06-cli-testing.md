# CLI Actor Testing Tool

> Interactive REPL for multi-actor protocol testing on live testnets

**Status**: Implemented (V12 SoothBook)
**Location**: `packages/contracts-testing/script/interactive/`
**Last Updated**: 2026-02-20

---

## Quick Start

```bash
cd packages/contracts-testing

# Run against Base Sepolia (default)
bun run interactive

# Or specify chain
bun run interactive:base

# Auto-run a scenario
bun run interactive:base -- --scenario=market-lifecycle-multi-actor
```

## Actors

| Actor | Role | Env Var | Typical Actions |
|-------|------|---------|-----------------|
| Alice | Creator | `PRIVATE_KEY_ALICE` | Create market, provide LP, redeem LP |
| Bob | AMM Trader | `PRIVATE_KEY_BOB` | AMM trades, graduate market, SoothBook orders |
| Charlie | SoothBook Trader | `PRIVATE_KEY_CHARLIE` | buyYes/buyNo, mint, merge, redeem |
| David | Adjudicator | `PRIVATE_KEY_DAVID` | Settle, finalize markets |
| Ellen | Keeper | `PRIVATE_KEY_ELLEN` | Verify invariants, redeem LP |

## Actor-to-Contract Mapping

| Actor | Contract(s) | Actions |
|-------|-------------|---------|
| Creator | LaunchpadEngine | `createMarket`, `dismissMarket` |
| AMM Trader | LaunchpadEngine | `tradePositions` |
| SoothBook Trader | SoothBook | `buyYes`, `buyNo`, `mint`, `merge`, `cancel` |
| Adjudicator | TruthMarket | `settle`, `finalize` |
| Guardian | ProtocolConfig, TruthMarket | `pause`, `unpause`, `veto` |
| Keeper | SoothBook | `redeem`, permissionless view calls |

## Command Categories

### Actor Management
```
actor <name>     Switch to actor (alice, bob, charlie, david, ellen)
actors           List all actors with addresses
```

### Wallet
```
balance          Show USDC balances
mint <amount>    Mint MockUSDC
approve all      Approve all contracts for USDC spending
```

### AMM Trading
```
buy <shares> [outcome]    Buy via LaunchpadEngine
sell <shares> [outcome]   Sell via LaunchpadEngine
ammquote <shares>         Get price quote
```

### SoothBook Trading (V12)
```
buyyes <tick> <amount> [escrow] [maxCost]    Buy YES at tick price
buyno <tick> <amount> [escrow] [maxCost]     Buy NO at tick price
sbmint <amount>                               Mint complete YES+NO set
sbmerge <amount>                              Burn YES+NO set, get USDC
sbcancel <side> <tick>                        Cancel resting orders at tick
sbredeem                                      Redeem after market resolution
```

### SoothBook Views (V12)
```
sbstate          Show market state (active, finalized, outcome, prices)
sbbook           Show orderbook depth (top YES and NO ticks)
sbbalance        Show YES/NO token balances
sbprice          Show implied YES/NO prices
sbhistory [page] [pageSize]    Show order history for connected wallet
sbsetmarket <key|index>        Select SoothBook market by key
```

### Settlement
```
settle <outcome>    Settle market (adjudicator only)
finalize            Finalize settlement
veto                Veto settlement (guardian only)
```

### Market Management
```
market <id>         Switch to market
markets             List all markets
createmarket        Create new market
dismiss             Dismiss trial market
```

## SoothBook Command Details

### buyyes / buyno
Place a limit order to buy YES or NO tokens at a specified tick (price).

```bash
# Buy 100 YES tokens at tick 600 (60¢)
buyyes 600 100

# Buy 50 NO tokens at tick 450 (45¢)
buyno 450 50

# Sell YES by buying NO with escrow (burns YES tokens as collateral)
buyno 400 100 escrow

# Sell NO by buying YES with escrow (burns NO tokens as collateral)
buyyes 550 100 escrow
```

### sbmint / sbmerge
Mint or burn complete token sets.

```bash
# Mint 100 USDC worth of YES+NO pairs
sbmint 100

# Burn 50 YES+NO pairs back to USDC
sbmerge 50
```

### sbcancel
Cancel resting orders at a specific tick.

```bash
# Cancel all YES orders at tick 600
sbcancel yes 600

# Cancel all NO orders at tick 450
sbcancel no 450
```

### sbstate / sbbook
View market state and orderbook depth.

```bash
# View full market state
sbstate

# View orderbook (top 10 ticks per side)
sbbook
```

## Scenarios

Pre-built test scenarios in `scenarios/`:

| Scenario | Description |
|----------|-------------|
| `market-lifecycle-multi-actor` | Full lifecycle: create → trade → graduate → settle → redeem |

Run with:
```bash
bun run interactive:base -- --scenario=market-lifecycle-multi-actor
```

## File Structure

```
interactive/
├── actors.ts           # Actor definitions & switching
├── commands/           # Command implementations
│   ├── actor.ts
│   ├── amm.ts
│   ├── market.ts
│   ├── settlement.ts
│   └── soothbook.ts    # V12 SoothBook commands
├── scenarios/          # Pre-built test scenarios
├── config.ts           # Chain & contract config
├── interactive-test.ts # Main REPL entry
└── README.md           # Detailed usage docs
```

---

*Last Updated: 2026-02-20*
