# Frontend Integration Documentation

This folder contains all documentation and resources for integrating frontend applications with the Sooth Protocol smart contracts.

## Files

### 📘 [CONTRACT_INTERFACES.md](./CONTRACT_INTERFACES.md)

**Comprehensive contract interface documentation**

- Complete ABIs for SoothMarket, SoothVault, SoothSettlement
- All function signatures with parameters and return types
- Role-based access control (owner, prover, public)
- UI button gating logic
- Integration patterns with code examples
- Event monitoring guide
- Error handling and common revert reasons

### 📋 [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

**Quick reference summary**

- Essential functions at a glance
- Key parameters for settlement functions
- Merkle proof format
- Quick start guide

### 🎯 [SETTLEMENT_GUIDE.md](./SETTLEMENT_GUIDE.md)

**Frontend settlement integration guide**

- React hooks for settlement
- UI components and examples
- Complete claim flow
- Event monitoring
- User-facing settlement process

### 💧 [LIQUIDITY_MECHANISM.md](./LIQUIDITY_MECHANISM.md)

**Liquidity & Exposure Guide**

- Shared vault model explanation
- Virtual allocation mechanism
- Automatic vs manual flows
- Frontend implications

### 🔬 [SLIPPAGE_PROTECTION.md](./SLIPPAGE_PROTECTION.md)

**Slippage & Price Impact Guide**

- Math behind LMSR pricing
- Calculating price impact
- On-chain slippage protection (maxCost)
- Frontend implementation examples
- Best practices for tolerance settings

### 🔗 [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)

**Original integration guide**

- How to use deployments.json
- ABI export locations
- Basic setup instructions

### 🔧 [deployments.json](./deployments.json)

**Current deployment addresses**

```json
{
  "MockERC20": "0x...",
  "SoothVault": "0x...",
  "SoothRiskManager": "0x...",
  "SoothBalancedAMM": "0x...",
  "SoothLMSRReal": "0x...",
  "SoothAdjudicatorRegistry": "0x...",
  "SoothSettlement": "0x...",
  "SoothMarketFactory": "0x...",
  "ExampleMarket": "0x...",
  "SecondMarket": "0x..."
}
```

> **Note**: Two markets are currently deployed, both in the MEDIUM risk class, sharing the same liquidity vault.

## Quick Start

### 1. Load Contract Addresses

```typescript
import deployments from "./docs/frontend-integration/deployments.json";

// Access individual markets
const market1Address = deployments.ExampleMarket; // Market ID: 1
const market2Address = deployments.SecondMarket; // Market ID: 2

// Shared infrastructure
const vaultAddress = deployments.SoothVault;
const settlementAddress = deployments.SoothSettlement;
const riskManagerAddress = deployments.SoothRiskManager;

// Both markets share the same vault and risk manager
```

### 2. Use Contract ABIs

See `CONTRACT_INTERFACES.md` section 7 for simplified ABIs, or use full ABIs from:

- `out/SoothMarket.sol/SoothMarket.json`
- `out/SoothVault.sol/SoothVault.json`
- `out/SoothSettlement.sol/SoothSettlement.json`

### 3. Follow Integration Patterns

- **Trading**: CONTRACT_INTERFACES.md → Section 8, Pattern 1
- **LP Operations**: CONTRACT_INTERFACES.md → Section 8, Pattern 2
- **Settlement Claims**: CONTRACT_INTERFACES.md → Section 8, Pattern 3

### 4. Monitor Events

See CONTRACT_INTERFACES.md → Section 9 for key events:

- `Trade` - price updates
- `Deposit`/`Withdraw` - LP activity
- `ResultStored` - market outcomes
- `Claimed` - settlement claims

## Key Contracts

| Contract               | Purpose                   | Key Functions                                     |
| ---------------------- | ------------------------- | ------------------------------------------------- |
| **SoothMarket**        | Prediction market trading | `trade()`, `isLive()`, `ammState()`               |
| **SoothVault**         | Liquidity pool            | `depositFor()`, `withdrawFor()`, `balanceOfLP()`  |
| **SoothSettlement**    | Settlement & claims       | `storeResult()`, `claimSettlement()`, `results()` |
| **SoothMarketFactory** | Market creation           | `createMarket()`                                  |
| **SoothRiskManager**   | Risk parameters           | `getBForMarket()`, `updateGlobalB()`              |

## Documentation Index

1. **Start here**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Get oriented
2. **Deep dive**: [CONTRACT_INTERFACES.md](./CONTRACT_INTERFACES.md) - Complete reference
3. **Setup**: [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) - Deployment guide
4. **Addresses**: [deployments.json](./deployments.json) - Contract addresses

## Support

For detailed information on any function, parameter, or integration pattern, refer to `CONTRACT_INTERFACES.md`.
