# Frontend Integration Guide

**Version:** 2.0 (Legacy) -> **Migrating to v3**

> [!WARNING] > **v3 is LIVE on Base Sepolia.**
> Please refer to the **[V3 Migration Guide](./V3_MIGRATION_GUIDE.md)** for the latest integration instructions.
> This document describes the v2 architecture and is kept for reference only.

## Overview

**Updated:** 2025-12-04

---

## 1. Get Deployment Artifacts

Contract addresses are in `deployments.json` (Base Sepolia) or `deployments-monad.json` (Monad).

```json
{
  "SoothTraderVault": "0x...",
  "SoothGovernorVault": "0x...",
  "SoothFeeController": "0x...",
  "SoothMarketFactory": "0x...",
  "MockERC20": "0x..."
}
```

ABIs are in `out/` directory:

- `out/SoothTraderVault.sol/SoothTraderVault.json`
- `out/SoothGovernorVault.sol/SoothGovernorVault.json`
- `out/SoothMarket.sol/SoothMarket.json`

---

## 2. Recommended Frontend Structure

```
frontend/
  src/
    config/
      deployments.json
      abis/
        SoothTraderVault.json
        SoothGovernorVault.json
        SoothMarket.json
        SoothFeeController.json
```

---

## 3. Usage with wagmi/viem

```typescript
import { useContractRead, useContractWrite } from "wagmi";
import deployments from "../config/deployments.json";
import TraderVaultABI from "../config/abis/SoothTraderVault.json";
import MarketABI from "../config/abis/SoothMarket.json";

// Read user balance from TraderVault
const { data: balance } = useContractRead({
  address: deployments.SoothTraderVault,
  abi: TraderVaultABI.abi,
  functionName: "freeBalance",
  args: [userAddress],
});

// Deposit to TraderVault
const { write: deposit } = useContractWrite({
  address: deployments.SoothTraderVault,
  abi: TraderVaultABI.abi,
  functionName: "deposit",
});

// Trade on Market
const { write: trade } = useContractWrite({
  address: marketAddress,
  abi: MarketABI.abi,
  functionName: "trade",
});
```

---

## 4. Usage with ethers.js

```typescript
import { ethers } from "ethers";
import deployments from "../config/deployments.json";
import TraderVaultABI from "../config/abis/SoothTraderVault.json";

const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// TraderVault contract
const traderVault = new ethers.Contract(
  deployments.SoothTraderVault,
  TraderVaultABI.abi,
  signer
);

// Approve + Deposit
await usdc.approve(deployments.SoothTraderVault, amount);
await traderVault.deposit(amount);

// Trade
await market.trade(outcomeIndex, deltaShares, maxCost);
```

---

## 5. Key Integration Points

### User Flow

1. **Approve** → `usdc.approve(TraderVault, amount)`
2. **Deposit** → `traderVault.deposit(amount)`
3. **Trade** → `market.trade(outcome, shares, maxCost)`
4. **Withdraw** → `traderVault.withdraw(amount)`

### LP Flow

1. **Approve** → `usdc.approve(GovernorVault, amount)`
2. **Deposit** → `governorVault.depositFor(lp, amount)`
3. **Withdraw** → `governorVault.withdrawFor(lp, amount, receiver)`

### Fee Display

```typescript
const orderbookFee = await feeController.orderbookFee(); // Global
const ammFee = await market.feeLMSR(); // Per market
```

---

## 6. See Also

- [CONTRACT_INTERFACES.md](./CONTRACT_INTERFACES.md) - Full ABIs
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [FEE_DESIGN.md](./FEE_DESIGN.md) - Fee mechanism
