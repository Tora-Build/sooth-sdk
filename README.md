# Sooth Protocol – Dynamic-b LMSR Reference Implementation

This repo contains a reference implementation of the Sooth core contracts:

- `SoothVault` – singleton, per-market exposure tracking
- `SoothRiskManager` – dynamic global `b` and per-market `b_market`
- `SoothBalancedAMM` – LMSR-like linear AMM (dev only)
- `SoothLMSRReal` – experimental true LMSR implementation (approximate exp/log, not gas-optimized)
- `SoothMarket` – infinite-end YES/NO vAMM markets
- `SoothMarketFactory` – helper to spin up new markets with risk classes and exposure
- `SoothAdjudicatorRegistry` – adjudicator configuration (A–D classes)
- `SoothSettlement` – stores `(outcome, T*)` and applies PnL via Merkle
- `SoothSmartAccount` – minimal AA-style wrapper over the vault

This matches the unified Sooth architecture:

- Infinite-end markets (terminate on truth time `T*`, not expiry)
- Singleton vault per adjudicator class
- Dynamic-b LMSR–style pricing, bounded LP loss
- Retroactive settlement (PnL replay around `T*`)
- Smart account–based UX and accounting

> NOTE: `SoothBalancedAMM` is still the recommended curve for early dev and testing.
> `SoothLMSRReal` implements the LMSR cost function with simple fixed-point approximations
> for `exp` and `log-sum-exp` and is **not** gas-optimized or production-ready.

## Layout

```text
contracts/
  core/
    SoothInterfaces.sol
    SoothVault.sol
    SoothBalancedAMM.sol
    SoothLMSRReal.sol
    SoothRiskManager.sol
    SoothAdjudicatorRegistry.sol
    SoothMarket.sol
    SoothMarketFactory.sol
    SoothSmartAccount.sol
  settlement/
    SoothSettlement.sol

script/
  DeploySooth.s.sol

test/
  MockERC20.sol
  SoothVault.t.sol
  SoothRiskManager.t.sol
  SoothMarket.t.sol
  SoothSettlement.t.sol
  SoothCoreIntegration.t.sol
```

## Prereqs

- Foundry installed (`forge`, `cast`).
- Node & Hardhat optional.

Install `forge-std` (if not already):

```bash
forge install foundry-rs/forge-std --no-commit
```

## Build

```bash
forge build
```

## Test

```bash
forge test -vv
```

## Deployment (Foundry script)

The `DeploySooth.s.sol` script deploys the minimal Sooth stack:

- Mock ERC20 as collateral (dev only)
- SoothVault
- SoothRiskManager
- SoothBalancedAMM
- SoothAdjudicatorRegistry
- SoothSettlement
- SoothMarketFactory
- Example market

Run:

```bash
forge script script/DeploySooth.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Edit the script to:

- Point at a real ERC20 collateral token on your network
- Configure risk classes & K
- Register real adjudicators (UMA / Reality / oracle+ZK / attestation)
- Create markets and wire them into your off-chain PnL engine
