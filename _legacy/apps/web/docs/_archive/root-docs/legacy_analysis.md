# Legacy Codebase Analysis & Extraction

## 1. Executive Summary

The current `sooth-dapp` is a React-based frontend interacting with the Sooth Protocol on Base Sepolia. It uses `wagmi` and `viem` for Web3 interactions. The core logic revolves around three pillars: Trading (AMM), Liquidity (Vaults), and Settlement (Adjudicators).

## 2. Contract Architecture

The system relies on a set of interconnected smart contracts.

| Contract Name              | Address                                      | Purpose                                                                        |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `SoothMarket`              | _Dynamic_                                    | Individual prediction market instances. Handles trading and position tracking. |
| `SoothLMSRReal`            | `0xE73E78C4F93C79593c4E09b6d096D668BA45852F` | Stateless LMSR AMM logic for price calculations.                               |
| `SoothVault`               | `0x98169FFFDf249b1196e4e8095f673379f3D06694` | Pooled liquidity vault. LPs deposit here.                                      |
| `SoothRiskManager`         | `0xae2aea85f34c6daB95403163bc2E457e82744196` | Manages risk parameters (B, K) for markets.                                    |
| `SoothSettlement`          | `0xb7069f379138cFf592EA372f2EAeF80a4f484F21` | Handles market resolution and PnL claiming.                                    |
| `SoothAdjudicatorRegistry` | `0xC69003eEc9B262dd9d5911d4d00133BC73d5f70d` | Registry of valid adjudicators.                                                |
| `SoothMarketFactory`       | `0x3014DB85baA8906Ab0f0562014f947995EaA0f15` | Factory for creating new markets.                                              |

**Source:** `src/config/deployments.json`

## 3. Core Algorithms (Algos)

### 3.1. Price Calculation (LMSR)

Prices are calculated off-chain using the `SoothLMSRReal` contract's `price` view function.

**Formula:**
Price depends on:

1.  `ammState` (qYes, qNo): Current quantity of shares sold.
2.  `bParam`: Liquidity parameter from `SoothRiskManager`.

**Frontend Logic:**

```typescript
// 1. Fetch State
const [qYes, qNo] = await market.ammState();
const b = await riskManager.getBForMarket(marketId);

// 2. Calculate Price (View Call)
const price = await lmsr.price({ qYes, qNo }, outcomeIndex, b);
```

### 3.2. Settlement Flow

Settlement is a multi-step process involving different roles.

1.  **Adjudication (Owner/Oracle)**:

    - `SoothSettlement.storeResult(marketId, adjudicatorId, outcome, truthTime)`
    - Sets the winning outcome (YES/NO).

2.  **PnL Calculation (Off-chain)**:

    - A prover calculates the PnL for all users based on their positions and the winning outcome.
    - Generates a Merkle Tree of claims.

3.  **Root Upload (Prover)**:

    - `SoothSettlement.storeSettlementRoot(marketId, batchId, root, proofMeta)`
    - Uploads the Merkle root to the contract.

4.  **Claiming (User)**:
    - `SoothSettlement.claimSettlement(marketId, batchId, pnlDelta, merkleProof)`
    - Users submit their proof to claim their PnL.

### 3.3. Liquidity Mechanism

Liquidity is pooled in `SoothVault`.

- **Deposit**: `vault.depositFor(lpAddress, amount)`
  - Mints LP shares to the user.
- **Withdraw**: `vault.withdrawFor(lpAddress, amount, receiver)`
  - Burns LP shares and returns assets, subject to `liquidBuffer` (total assets - locked exposure).

## 4. Standard Operating Procedures (SOPs)

### 4.1. Trading (with Slippage Protection)

1.  Check `isLive` and `!isSettled`.
2.  Approve `SoothVault` (collateral) to spend USDC.
3.  Calculate `maxCost` (for buys) or `minProceeds` (for sells) based on expected price + slippage tolerance.
4.  Call `market.trade(outcomeIndex, deltaShares, maxCost)`.
    - `deltaShares > 0`: Buy. `maxCost` is the max USDC you are willing to spend.
    - `deltaShares < 0`: Sell. `maxCost` is the min USDC you expect to receive (negative value).

### 4.2. Adding Markets

Markets are defined in `src/config/markets.json`.
To add a market:

1.  Deploy a new market via `SoothMarketFactory` (or use existing).
2.  Add entry to `markets.json` with:
    - `id`, `name`, `question`
    - `contractAddress`
    - `adjudicatorId`, `eventId`

### 4.3. Frontend Integration

- **ABIs**: Located in `src/config/abis`.
- **Hooks**: `useMarket`, `useVault`, `useSettlement` wrap the contract interactions.

## 5. Data Models

### Market Config (`markets.json`)

```json
{
  "id": "string",
  "mode": "real | demo",
  "name": "string",
  "question": "string",
  "adjudicatorKind": "CHAINLINK_ZK | UMA_REALITY | ZK_PROOF",
  "contractAddress": "0x...",
  "adjudicatorId": "0x...",
  "eventId": "0x...",
  "initialStatus": "trading | cooldown | settled",
  "initialYes": "number (0-1)"
}
```

## 6. Rebuild Recommendations

1.  **Preserve Configs**: Copy `src/config/deployments.json` and `src/config/markets.json` to the new project.
2.  **Reuse ABIs**: Copy `src/config/abis` folder.
3.  **Port Hooks**: The logic in `src/hooks/*.ts` is solid and maps 1:1 to the contracts. These should be ported or adapted to the new state management library (if changing).
4.  **UI Overhaul**: The user requested a rebuild, likely due to UI "patches".
    - Start with a clean component library (e.g., Shadcn/UI + Tailwind).
    - Implement a strict separation between "Smart Components" (data fetching) and "Presentational Components".
    - Use a global store (Zustand/Context) for shared state like "User Balance" or "Global Settings" (Real/Demo toggle).
