# @sooth/indexer

Ponder-based indexer for the Sooth prediction market orderbook.

## Setup

1. Copy environment file:
```bash
cp .env.example .env
```

2. Configure RPC URLs in `.env`

3. Install dependencies:
```bash
pnpm install
```

## Development

```bash
# Start the indexer in dev mode (with hot reload)
pnpm dev
```

The indexer will:
- Start syncing events from configured chains
- Serve a GraphQL API at http://localhost:42069/graphql
- Serve REST API at http://localhost:42069/

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /orders/:chainId/:marketKey` | All active orders for a market |
| `GET /orders/:chainId/:marketKey/:owner` | User's orders in a market |
| `GET /orderbook/:chainId/:marketKey` | Aggregated tick liquidity |
| `GET /fills/:chainId/:orderId` | Fill history for an order |
| `GET /trades/:chainId/:marketKey` | Recent market order trades |
| `GET /markets/:chainId` | All registered markets |
| `GET /health` | Health check |

## Schema

### Tables

- **market** - Registered markets
- **order** - Range orders with status tracking
- **fillClaim** - Fill claim events
- **marketOrder** - Market order executions
- **tickLiquidity** - Aggregated liquidity per tick

## Production

```bash
# Build and start
pnpm start

# Or serve pre-built
pnpm serve
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Arc Testnet    │     │  Base Sepolia   │
│  Monad Testnet  │     │                 │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
    ┌────────────────────────────────┐
    │         Ponder Indexer         │
    │  ┌──────────┐  ┌────────────┐  │
    │  │ Handlers │  │  Database  │  │
    │  └──────────┘  └────────────┘  │
    └─────────────┬──────────────────┘
                  │
                  ▼
    ┌────────────────────────────────┐
    │       REST / GraphQL API       │
    └─────────────┬──────────────────┘
                  │
                  ▼
    ┌────────────────────────────────┐
    │          Frontend              │
    └────────────────────────────────┘
```
