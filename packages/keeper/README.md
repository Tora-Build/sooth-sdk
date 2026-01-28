# Sooth Keeper Bot

Arbitrage keeper bot for the Sooth Protocol TickBook orderbook. Monitors markets for price discrepancies between spot sells and resting range orders, then executes arbitrage trades to capture the spread.

## How It Works

TickBook's range orders only match within their specified tick range. A buy order at 30-40% won't match a sell at 29%, even though 29% is a better price. This creates arbitrage opportunities:

```
Spot Sell: YES @ 29%  ← Cheaper
Buy Order: YES @ 30-40%  ← Would pay 30%

Arbitrage:
1. Buy from spot sell at 29%
2. Sell to resting buyer at 30%
3. Profit: 1% spread
```

The keeper bot:
1. Scans all graduated TickBook markets
2. Finds spot sells priced below resting buy orders
3. Executes arbitrage trades to capture the spread

## Quick Start

```bash
cd packages/keeper

# Install dependencies
bun install

# Set environment variables
export PRIVATE_KEY=0x...  # Keeper wallet private key
export CHAIN=baseSepolia  # or monadTestnet, arcTestnet, megaethTestnet

# Run in dry-run mode (no execution)
DRY_RUN=true bun run keeper

# Run live
bun run keeper
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Keeper wallet private key (with 0x prefix) |
| `CHAIN` | No | Network to monitor (default: baseSepolia) |
| `DRY_RUN` | No | Set to "true" to disable execution |

## Supported Networks

- `baseSepolia` - Base Sepolia testnet
- `monadTestnet` - Monad testnet
- `arcTestnet` - Arc testnet
- `megaethTestnet` - MegaETH testnet

## NPM Scripts

```bash
bun run keeper          # Run with default chain (baseSepolia)
bun run keeper:base     # Run on Base Sepolia
bun run keeper:monad    # Run on Monad testnet
bun run keeper:arc      # Run on Arc testnet
bun run keeper:megaeth  # Run on MegaETH testnet
```

## Configuration

Edit `src/index.ts` to adjust:

- `POLL_INTERVAL_MS` - How often to scan (default: 5000ms)
- `MIN_PROFIT_WAD` - Minimum profit threshold (default: 0.1 USDC)

## Architecture

```
src/
├── index.ts      # Main entry point, polling loop
├── config.ts     # Chain configs, contract addresses, ABIs
├── types.ts      # TypeScript interfaces
├── monitor.ts    # Fetch orders and spot sells from chain
├── analyzer.ts   # Find arbitrage opportunities
└── executor.ts   # Execute arbitrage transactions
```

## Output Example

```
  Sooth Keeper Bot
  ─────────────────────────────────────
  Chain: Base Sepolia (84532)
  Mode: LIVE
  Min Profit: 0.1 USDC
  Poll Interval: 5000ms
  ─────────────────────────────────────

  Keeper Address: 0x1234...5678

  Found 3 markets
  2 graduated + registered markets

  Starting scan loop...

  [2026-01-18T12:00:00.000Z] Market 0xabcd1234...
  Orders: 5 | Spot Sells: 3
  Opportunities: 1

    YES | Spread: 1.5% | Shares: 100.00 | Est. Profit: 1.5000 USDC
    Gas estimate: 500000 (~0.0001 ETH)
    SUCCESS! Profit: 1.5 USDC
```

## Profitability

Minimum spread for profitability depends on gas costs:

| Network | Typical Gas | Break-even Spread |
|---------|-------------|-------------------|
| Base Sepolia | ~$0.001 | <0.01% |
| Monad | ~$0.001 | <0.01% |
| L1 Mainnet | ~$5-15 | 0.5-1.5% |

## Safety Notes

- Always test in dry-run mode first
- Use a dedicated keeper wallet
- Monitor for failed transactions
- The bot has position risk between buy and sell transactions

## Related Documentation

- [TickBook Keeper Spec](../../docs/research/TICKBOOK_KEEPER_SPEC.md)
- [TickBook Order Matching Guide](../../docs/guides/tickbook-order-matching-guide.md)
