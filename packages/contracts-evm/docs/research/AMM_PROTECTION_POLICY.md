# Evaluation: AMM-Centric Protection & Open Orderbook

## 1. The Proposal
*   **Constraint**: Limit AMM access to Trading Vault (Standard).
*   **Locking**: **Only** on AMM Sell/Buy interactions.
*   **Freedom**: Orderbook matching and `merge()` are **Lock-Free**.
*   **Thesis**: "Price neutrality is more important than liquidity neutrality. We protect AMM actors."

## 2. Fullstack Developer Review (Technical Feasibility)
*   **`UNIFIED_TICK_MODEL.md` Status**: The current model (Tick V3 + ERC1155) supports this change easily.
*   **Implementation**:
    *   `SoothMarket`: Requires no changes to core logic, just access control.
    *   `SoothTraderVault`: Needs logic update.
        *   `executeAMMTrade` -> Triggers `TimeLock`.
        *   `mergePositions` -> **Bypasses `TimeLock`** (Direct Transfer).
*   **Complexity**: Reduces complexity. We no longer need to detect "Liquidity Down" events globally, just "AMM Touch" events.

## 3. Economic Analysis (The Pivot)

### Current Model vs. Proposed Model

| Feature | Current Research (Burn=Lock) | Proposed (AMM=Lock, Merge=Free) | Evaluation |
| :--- | :--- | :--- | :--- |
| **P2P Trade** | Free | Free | Neutral |
| **AMM Sell** | **Locked** | **Locked** | ✅ Protects AMM Reserves |
| **Merge (Redeem)** | **Locked** | 🔓 **Free** | 🚀 **Major Efficiency Boost** |
| **Arb Cycle** | Slow (Buy -> Wait -> Merge) | **Atomic** (Buy -> Merge) | ✅ Keeps \$1.00 Peg |

### The "Atomic Arb" Implication
*   **Scenario**: AMM Price YES = 0.40, Orderbook Price NO = 0.40. Sum = 0.80.
*   **Action**: Arb Bot buys both (Cost 0.80) and calls `merge()` (Get 1.00).
*   **Result**:
    *   **Current**: Profit 0.20, but locked for `T` hours. Capital inefficient.
    *   **Proposed**: Profit 0.20, realized **instantly** in the same block.
*   **Effect on AMM**: The AMM "loses" the cheap shares instantly.
*   **Is this Toxic?**: **No.** It forces the AMM to reprice correctly. It effectively "arbs the AMM against the Orderbook". This is healthy.

### Security Check: "Running on the Bank"
*   **Risk**: Can a user flee a bad Oracle settlement via `Merge`?
*   **Analysis**: To `Merge`, you must hold **1 YES + 1 NO**. This position is arguably **Delta Neutral** (worth \$1.00 regardless of outcome).
*   **Verdict**: Since the user is fully hedged, letting them exit via `Merge` does not exploit Inside Information about the outcome. They simply want their collateral back. **Safe to Unlock.**

## 4. Recommendation
**Strongly Endorse.**
This creates a clear "Two-Tier" system:
1.  **The Casino (AMM)**: Guarded, Locked, Algo-driven.
2.  **The Spot Market (Orderbook/Merge)**: Open, Free, Efficient.

This aligns perfectly with making Sooth a "Liquidity Layer".
