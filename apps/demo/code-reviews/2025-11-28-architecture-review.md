# Sooth Protocol dApp - Architecture Review

**Date:** November 28, 2025
**Version:** 0.0.1
**Network:** Base Sepolia (Chain ID: 84532)

## Executive Summary

The Sooth Protocol dApp implements a **dual-mode architecture** designed to support both low-friction user onboarding (Demo Mode) and actual on-chain trading (Real Mode) within a single interface. The codebase is built on a modern Web3 stack (wagmi v3, viem v2) and features strict TypeScript typing.

## Core Architecture: Dual-Mode Design

The application intentionally bifurcates logic based on the `mode` property of markets and pools. This allows the UI to serve as both a simulator and a real dApp.

### 1. Hybrid State Management

- **Demo Mode (`mode: 'demo'`)**: Uses in-memory React state (`useState` in `App.tsx`) to simulate order book depth, vAMM price impact, and settlement flows without wallet signatures or gas.
- **Real Mode (`mode: 'real'`)**: Bypasses local simulation and interacts directly with smart contracts via custom hooks.

### 2. On-Chain Gating

Components explicitly gate interactions based on the selected market's mode.

**TraderTerminal.tsx:**

```typescript
const isOnChainMarket = selected.mode === 'real';
// ...
if (isOnChainMarket) {
  // Uses useTrade hook
  trade(outcomeIndex, sharesInput);
} else {
  // Uses local simulation callback
  onSimulateTrade(...);
}
```

**LPDashboard.tsx:**

```typescript
const isOnChain = selectedPool.mode === "real";
// ...
// Gates Deposit/Withdraw actions to use contract hooks vs local state setters
```

## Technology Stack

| Component     | Technology   | Version    | Notes                                      |
| ------------- | ------------ | ---------- | ------------------------------------------ |
| **Framework** | React + Vite | 18.2 / 5.0 | Fast HMR, production build ready           |
| **Web3**      | wagmi        | 3.0.2      | Latest major version                       |
| **Client**    | viem         | 2.40.3     | Efficient, type-safe Ethereum interactions |
| **UI**        | RainbowKit   | 2.2.9      | Wallet connection UI                       |
| **Language**  | TypeScript   | 5.0.0      | Strict mode enabled                        |

## Smart Contract Integration

The dApp integrates with a comprehensive suite of Sooth Protocol contracts on Base Sepolia.

- **Hooks**: Located in `src/hooks/`, cleanly separated by domain (`useMarket`, `useVault`, `useSettlement`).
- **Config**: `src/config/deployments.json` maps contracts to the Base Sepolia deployment.
- **ABIs**: Full ABIs present in `src/config/abis/`.

## Current Status & Observations

### Strengths

- **Clear Separation**: The `mode` flag effectively isolates simulation logic from production contract calls.
- **Type Safety**: Extensive use of TypeScript interfaces (`Market`, `Pool`) ensures consistency across both modes.
- **Modern Tooling**: Usage of `useReadContract` and `useWriteContract` from wagmi v3 follows current best practices.

### Actual Risks & Areas for Attention

1. **RPC Error Handling**: While hooks handle loading states (`isPending`), robust error handling for RPC failures (e.g., user rejection, insufficient gas, network timeouts) is minimal in the UI layer.
2. **Read Fallbacks**: The UI relies heavily on successful hook reads. If an RPC call fails, data may appear missing or undefined without a fallback UI state.
3. **Testing**: There are currently no automated tests (unit or E2E) to verify that the gating logic holds up under refactoring.

## Conclusion

The codebase correctly implements the intended hybrid design. The "Demo" markets are a feature, not legacy code. The primary focus for moving forward should be on **hardening the "Real" mode paths**—specifically around error handling and edge cases in network interaction—rather than altering the fundamental architecture.
