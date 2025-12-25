# V8 Deployment & Benchmark Scripts

Multi-chain deployment and HFT benchmark tooling for Sooth Protocol V8.

## Prerequisites

1. **Install Bun** (TypeScript runtime):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Build contracts first:**
   ```bash
   cd packages/contracts-evm
   forge build
   ```

3. **Install dependencies:**
   ```bash
   pnpm install
   ```

4. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your PRIVATE_KEY
   ```

5. **Fund deployer wallet** with native tokens on target chains:
   - Base Sepolia: Get ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
   - MegaETH Frontier: Bridge ETH or use faucet
   - Monad Testnet: Get MON from [Monad Faucet](https://faucet.monad.xyz)

> **Note:** Scripts auto-load `.env` from the current directory. You can also pass `PRIVATE_KEY=0x...` as an env var.

---

## Multi-Chain Deployment

### Quick Start

```bash
cd packages/contracts-evm

# Ensure .env has PRIVATE_KEY set, then:

# Deploy to all 3 chains in parallel
bun run deploy:all

# Deploy to specific chain
bun run deploy:base      # Base Sepolia (84532)
bun run deploy:megaeth   # MegaETH Frontier (4326)
bun run deploy:monad     # Monad Testnet (10143)

# Or run directly with inline key
PRIVATE_KEY=0x... bun run script/deploy-multichain.ts --chains=baseSepolia
```

### What Gets Deployed

| Contract | Description |
|----------|-------------|
| MockUSDC | Test USDC token (18 decimals) |
| Collateralizer | Split/merge USDC ↔ YES/NO tokens |
| AMMEngine | LMSR AMM with position domain |
| TickBook | 10,000-tick orderbook |
| LaunchpadEngine | Creator economics wrapper |

### Markets Created

1. **Alien Life** (`ALIEN`) - Pre-graduation, 1,000 USDC liquidity
2. **BTC TWAP >= $100k** (`BTC100K`) - **Graduated** via 40k trading volume

### Graduation Process

The BTC market is automatically graduated through 10 trades:

```
Trade 1:  BUY  +5,000 shares  →  ~250 USDC fees
Trade 2:  SELL -3,000 shares  →  ~150 USDC fees
Trade 3:  BUY  +6,000 shares  →  ~300 USDC fees
Trade 4:  SELL -4,000 shares  →  ~200 USDC fees
Trade 5:  BUY  +5,000 shares  →  ~250 USDC fees
Trade 6:  SELL -3,000 shares  →  ~150 USDC fees
Trade 7:  BUY  +6,000 shares  →  ~300 USDC fees
Trade 8:  SELL -4,000 shares  →  ~200 USDC fees
Trade 9:  BUY  +5,000 shares  →  ~250 USDC fees
Trade 10: BUY  +5,000 shares  →  ~250 USDC fees ← GRADUATES HERE
─────────────────────────────────────────────────
Total: ~46,000 USDC volume → ~2,300 USDC fees > 2,000 threshold
```

### Output Artifacts

Each chain produces a deployment artifact:

```
deployments/v8-baseSepolia.json
deployments/v8-megaethFrontier.json
deployments/v8-monadTestnet.json
```

Example artifact:
```json
{
  "chainId": 84532,
  "chainName": "baseSepolia",
  "timestamp": "2025-12-25T...",
  "deployer": "0x...",
  "contracts": {
    "MockUSDC": "0x...",
    "Collateralizer": "0x...",
    "AMMEngine": "0x...",
    "TickBook": "0x...",
    "LaunchpadEngine": "0x..."
  },
  "markets": [
    {
      "address": "0x...",
      "name": "UN Confirms Alien Life",
      "symbol": "ALIEN",
      "yesToken": "0x...",
      "noToken": "0x...",
      "isGraduated": false
    },
    {
      "address": "0x...",
      "name": "BTC TWAP >= $100k",
      "symbol": "BTC100K",
      "yesToken": "0x...",
      "noToken": "0x...",
      "isGraduated": true
    }
  ]
}
```

---

## HFT Benchmark

Stress-test TickBook orderbook performance across chains.

### Quick Start

```bash
cd packages/contracts-evm

# Benchmark all deployed chains
PRIVATE_KEY=0x... bun run benchmark

# Benchmark specific chain
PRIVATE_KEY=0x... bun run benchmark:base
PRIVATE_KEY=0x... bun run benchmark:megaeth
PRIVATE_KEY=0x... bun run benchmark:monad
```

### Custom Options

```bash
PRIVATE_KEY=0x... bun run script/hft-benchmark.ts \
  --chain=megaethFrontier \
  --wallets=20 \
  --trades=500 \
  --parallel=10
```

| Option | Default | Description |
|--------|---------|-------------|
| `--chain` | all | Target chain(s), comma-separated |
| `--wallets` | 10 | Number of trader wallets |
| `--trades` | 100 | Total trades to execute |
| `--parallel` | 5 | Max concurrent transactions |

### Benchmark Phases (V8.1 Maker/Taker Model)

1. **Setup**: Generate N trader wallets with random private keys
2. **Fund**: Mint & transfer 10,000 USDC + 0.01 ETH per wallet
3. **Split**: Convert USDC to YES/NO tokens via Collateralizer
4. **Maker Setup**: Place ranged limit orders via `placeLimitOrder()`:
   - 35%-45% range (NO favored)
   - 45%-55% range (neutral)
   - 55%-65% range (YES favored)
5. **Approve**: Approve TickBook for all trader wallets
6. **Benchmark**: Execute market orders via `executeMarketOrder()` in parallel
   - Alternating BUY (sweep UP) and SELL (sweep DOWN)
   - 20bps taker fee on each trade
7. **Report**: Calculate and save metrics

### Metrics Collected

| Metric | Description |
|--------|-------------|
| `successRate` | % of trades that succeeded |
| `latency.p50` | Median latency (ms) |
| `latency.p95` | 95th percentile latency |
| `latency.p99` | 99th percentile latency |
| `tps` | Transactions per second |
| `avgGas` | Average gas used per trade |

### Output

Results saved to `deployments/benchmark-results.json`:

```json
[
  {
    "chain": "megaethFrontier",
    "chainId": 4326,
    "timestamp": "2025-12-25T...",
    "trades": {
      "total": 100,
      "successful": 98,
      "failed": 2,
      "successRate": 0.98
    },
    "latency": {
      "min": 8,
      "max": 245,
      "avg": 42.3,
      "p50": 35,
      "p95": 120,
      "p99": 200
    },
    "throughput": {
      "totalTimeMs": 12500,
      "tps": 7.84
    },
    "gas": {
      "min": "125000",
      "max": "185000",
      "avg": "145000",
      "total": "14210000"
    }
  }
]
```

---

## Chain Configurations

| Chain | ID | RPC | Explorer |
|-------|-----|-----|----------|
| Base Sepolia | 84532 | `https://sepolia.base.org` | [basescan.org](https://sepolia.basescan.org) |
| MegaETH Frontier | 4326 | `https://mainnet.megaeth.com/rpc` | [explorer.megaeth.com](https://explorer.megaeth.com) |
| Monad Testnet | 10143 | `https://testnet-rpc.monad.xyz` | [monadexplorer.com](https://testnet.monadexplorer.com) |

---

## Troubleshooting

### "Deployer has zero balance"
Fund your wallet with native tokens on the target chain before deployment.

### "Artifact not found"
Run `forge build` first to compile contracts.

### "Market already registered"
The benchmark handles this gracefully - the market was already set up.

### "Trade failed"
Some trades may fail due to:
- Insufficient liquidity at target tick
- Price moved beyond limit tick
- RPC rate limiting

The benchmark continues and reports success rate.

---

## File Structure

```
script/
├── chainConfigs.ts      # Chain definitions & market configs
├── deploy-multichain.ts # Parallel deployment + graduation
├── hft-benchmark.ts     # TickBook stress test
├── tsconfig.json        # TypeScript config
└── README.md            # This file
```

