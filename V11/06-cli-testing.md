# CLI Actor Testing Tool

> Interactive REPL for multi-actor protocol testing on live testnets

**Status**: Implemented
**Location**: `packages/contracts-core/script/interactive/`
**Last Updated**: 2026-01-25

---

## Quick Start

```bash
cd packages/contracts-core

# Run against Base Sepolia (default)
bun run interactive

# Or specify chain
bun run interactive:base
bun run interactive:monad

# Auto-run a scenario
bun run interactive:base -- --scenario=market-lifecycle-multi-actor
```

## Actors

| Actor | Role | Env Var | Typical Actions |
|-------|------|---------|-----------------|
| Alice | Creator | `PRIVATE_KEY_ALICE` | Create market, provide LP, redeem LP |
| Bob | AMM Trader | `PRIVATE_KEY_BOB` | AMM trades, graduate market, place orders |
| Charlie | TickBook Trader | `PRIVATE_KEY_CHARLIE` | Cross orders, spot sell, redeem |
| David | Adjudicator | `PRIVATE_KEY_DAVID` | Settle, finalize markets |
| Ellen | Keeper | `PRIVATE_KEY_ELLEN` | Claim fills, verify invariants |

## Actor-to-Contract Mapping

| Actor | Contract(s) | Actions |
|-------|-------------|---------|
| Creator | LaunchpadEngine | `createMarket`, `dismissMarket` |
| AMM Trader | LaunchpadEngine | `tradePositions` |
| TickBook Trader | TickBookPoolManager | `placeOrder`, `placeSpotSell`, `cancelOrder` |
| Adjudicator | TruthMarket | `settle`, `finalize` |
| Guardian | ProtocolConfig, TruthMarket | `pause`, `unpause`, `veto` |
| Keeper | TickBookPoolManager | `claimFillsFor`, permissionless maintenance |

## Command Categories

### Actor Management
```
actor <name>     Switch to actor (alice, bob, charlie, david, ellen)
actors           List all actors with addresses
```

### Wallet & Vault
```
balance          Show USDC balances
mint <amount>    Mint MockUSDC
deposit <amt>    Deposit to TickBookVault
withdraw <amt>   Withdraw from vault
```

### AMM Trading
```
buy <shares> [outcome]    Buy via LaunchpadEngine
sell <shares> [outcome]   Sell via LaunchpadEngine
ammquote <shares>         Get price quote
```

### TickBook Trading
```
order <side> <low>-<high> <shares>   Place range order
spotsell <outcome> <tick> <shares>   Place spot sell
cancel <orderId>                     Cancel order
claim                                Claim fills
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
│   ├── tickbook.ts
│   └── vault.ts
├── scenarios/          # Pre-built test scenarios
├── config.ts           # Chain & contract config
├── interactive-test.ts # Main REPL entry
└── README.md           # Detailed usage docs
```

---

*Last Updated: 2026-01-25*
