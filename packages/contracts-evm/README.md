# @sooth/contracts-evm

Solidity smart contracts for Sooth Protocol (V4).

## Architecture (V4)

Sooth V4 uses a **Dual-Venue** architecture:

```
                    ┌─────────────────┐
                    │SoothTraderVaultV4│  ← User Accounts & AMM Positions
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │  SoothMarketV4  │  ← Continuous LMSR + Orderbook
                    └────────┬────────┘
                             │
         ┌───────────────────┼────────────────────┐
         │                   │                    │
┌────────▼────────┐ ┌────────┴────────┐   ┌──────┴───────┐
│  OutcomeToken   │ │SoothGovernorVault│   │SoothFeeCtrl │
│    (ERC1155)    │ │   (LP Funds)     │   │ (Fees)      │
└─────────────────┘ └─────────────────┘   └──────────────┘
```

## Core Contracts

| Contract             | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `SoothTraderVaultV4` | Main user entry point. Manages deposits and positions.     |
| `SoothMarketV4`      | Unified Market (Continuous LMSR + Orderbook).              |
| `OutcomeToken`       | ERC1155 token for Orderbook shares (YES/NO).               |
| `SoothGovernorVault` | LP Liquidity Pool.                                         |
| `SoothFeeController` | Global fee settings.                                       |

## Quick Start

```bash
# Build
forge build

# Test
forge test

# Deploy to Base Sepolia
./deploy-and-sync.sh
```

## Testing

```bash
# Run all tests
forge test

# Key Tests
forge test --match-contract GranularityTest
forge test --match-contract OrderbookShort
forge test --match-contract V4Integration
```

## Deployment

1. Configure `.env`:

```env
PRIVATE_KEY=0x...
RPC_URL=https://...
```

2. Run deployment script:

```bash
./deploy-and-sync.sh
```

## Documentation

- [Architecture](./docs/core/ARCHITECTURE.md)
- [Frontend Integration](./docs/technical/frontend-integration/README.md)
- [Fee Design](./docs/research/FEE_DESIGN.md)

## Directory Structure

```
contracts/
  core/
    SoothTraderVaultV4.sol  # User vault
    SoothMarketV4.sol       # Market logic
    OutcomeToken.sol        # ERC1155 Shares
    SoothGovernorVault.sol  # LP vault
    SoothFeeController.sol  # Fee management
    SoothInterfaces.sol     # Shared interfaces

test/
    GranularityTest.t.sol   # V4 Math tests
    V4Integration.t.sol     # System tests
    OrderbookShort.t.sol    # Short selling tests

script/
  DeployFreshV4.s.sol       # V4 Deployment
```

## Architecture

```
                    ┌─────────────────┐
                    │ SoothTraderVault│  ← User deposits/withdrawals
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │   SoothMarket   │  ← Per-market trading logic
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────┴───────┐   ┌────────┴────────┐   ┌──────┴───────┐
│SoothLMSRReal  │   │SoothGovernorVault│   │SoothFeeCtrl │
│  (AMM Math)   │   │   (LP Funds)     │   │ (Fees)      │
└───────────────┘   └─────────────────┘   └──────────────┘
```

## Core Contracts

| Contract             | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `SoothTraderVault`   | Manages user deposits, withdrawals, and collateral locking |
| `SoothGovernorVault` | LP liquidity pool with ERC4626-style shares                |
| `SoothMarket`        | Per-market AMM + Orderbook trading                         |
| `SoothLMSRReal`      | LMSR pricing using PRBMath fixed-point                     |
| `SoothFeeController` | Global fee settings (orderbook fee, LP split)              |

## Quick Start

```bash
# Build
forge build

# Test
forge test

# Test with verbosity
forge test -vvv

# Deploy to testnet
./deploy-and-sync.sh
```

## Testing

```bash
# Run all tests
forge test

# Run specific test
forge test --match-test testBuyYes

# Gas report
forge test --gas-report
```

## Deployment

1. Configure `.env`:

```env
PRIVATE_KEY=0x...
RPC_URL=https://...
```

2. Run deployment:

```bash
./deploy-and-sync.sh
```

3. Verify contracts:

```bash
forge script script/Verify.s.sol --rpc-url $RPC_URL
```

## Documentation

- [Architecture](./docs/core/ARCHITECTURE.md)
- [Frontend Integration](./docs/technical/frontend-integration/README.md)
- [Fee Design](./docs/research/FEE_DESIGN.md)

## Directory Structure

```
contracts/
  core/
    SoothInterfaces.sol     # Shared interfaces
    SoothTraderVault.sol    # User vault
    SoothGovernorVault.sol  # LP vault
    SoothMarket.sol         # Market logic
    SoothLMSRReal.sol       # LMSR AMM
    SoothFeeController.sol  # Fee management
    SoothTimeLock.sol       # Timelock for governance

test/
  *.t.sol                   # Foundry tests

script/
  Deploy.s.sol              # Deployment script
  Verify.s.sol              # Verification script
```
