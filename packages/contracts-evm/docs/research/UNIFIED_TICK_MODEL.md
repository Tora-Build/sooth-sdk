# Unified Tick-Based Prediction Market Model
## (formerly Model B: Tick-Based LMSR)

This document defines the architectural specification for **Sooth V3**, a unified liquidity protocol combining an LMSR-based AMM with a Central Limit Orderbook using a shared discrete tick system. It integrates key findings regarding liquidity dynamics and token lock mechanics.

---

# 1. The Core Innovation: Unified Ticks

Traditional prediction markets split liquidity between:
1.  **AMM**: Continuous, high-gas, "always on" automated pricing (using expensive `exp`/`log`).
2.  **Orderbook**: Discrete, low-gas, user-provided limit orders.

**Sooth V3 unifies these** by adopting a discrete **Tick System** (inspired by Uniswap v3) where:
*   The Probability Space $[0, 1]$ is divided into $N$ discrete ticks (e.g., 2000 ticks).
*   **AMM**: Provides "Base Liquidity" across all ticks using a precomputed LMSR-convex curve.
*   **User Orders**: Provide "Concentrated Liquidity" at specific ticks (Limit Orders).

### 1.1 Benefits
*   **Gas Efficiency**: ~50x cheaper than continuous LMSR (No `exp`/`log` on-chain).
*   **Deep Liquidity**: User orders sit *on top* of AMM liquidity, naturally tightening spreads.
*   **Unified Matching**: A single "trade loop" walks through ticks, consuming the best available liquidity (User or AMM) seamlessly.
## 1.2 Optimal Tick Intensity (N) -> Precision vs Gas
We analyzed the impact of Tick Count ($N$) on efficiency and arbitrage opportunities.

| Tick Count ($N$) | Tick Size (bps) | Max Price Error | Gas Cost (Worst Case) | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **500** | 20 bps (0.2%) | ~0.10% | Low (~80k gas) | ❌ Too coarse, high arb risk |
| **1,000** | **10 bps (0.10%)** | **~0.05%** | **Medium-Low (~100k gas)** | ⚠️ **Viable Economy Mode** |
| **2,000** | **5 bps (0.05%)** | **~0.025%** | **Medium (~120k gas)** | ✅ **Optimal Sweet Spot** |
| **10,000** | 1 bp (0.01%) | ~0.005% | High (>300k gas) | ❌ Too expensive for L2 |

### Why N=2,000?
*   **Arbitrage Defense**: A 5bps tick size is significantly smaller than the typical fee (e.g., 10-30bps). Arbitrageurs cannot profit from the discretization error itself.
*   **Loop Limit**: EVM gas limits allow iterating ~100-200 ticks safely. A 2,000-tick range ensures even large market shifts (e.g., probability 0.5 -> 0.6) only traverse ~200 ticks, fitting within a single block.

---

# 2. Key Mechanics

## 2.1 The Tick Engine (Model B)
Instead of calculating $C = b \cdot \ln(e^{q_Y/b} + e^{q_N/b})$, we define a discrete cost function where the cost to cross a tick is precomputed.
*   **State**: The AMM state is simply the `currentTick` index.
*   ** bounded Loss**: The sum of all tick costs is calibrated to exactly equal $b \ln 2$, preserving the protocol's solvency guarantees.

## 2.2 Tokenization (ERC1155)
Outcome shares (`YES`, `NO`) are standardized as **ERC1155** tokens.
*   **Composability**: Visible in wallets, tradable on secondary markets (Uniswap, OpenSea).
*   **Efficiency**: Single-contract management (`SoothMarket`) avoids the overhead of deploying separate ERC20s per market.

## 2.3 Liquidity Dynamics: The "Split/Merge" Orderbook Principle
The user correctly identified that an Orderbook match is not just a transfer—it can be a **Split**, **Transfer**, or **Merge** depending on the participants' starting states.

| Interaction Type | Scenario | Mechanism | Capital Effect | Lock Status |
| :--- | :--- | :--- | :--- | :--- |
| **Split (Creation)** | Buyer A (USDC) matches Buyer B (USDC) | **Mint** (A gets YES, B gets NO) | Liquidity **UP** (Inflow) | 🔓 **Free** |
| **Transfer (Swap)** | User C (YES) sells to Buyer A (USDC) | **Transfer** (C -> A) | Liquidity **Neutral** | 🔓 **Free** |
| **AMM Sell (House Trade)** | User C (YES) sells to AMM | **Burn** (Claim Extinguished) | Liability **DOWN** (Reserve Payout) | 🔒 **Locked** |
| **Merge (Redemption)** | User C via `merge()` (YES+NO) | **Burn** (Pair Destroyed) | Collateral **Unlock** (Full Exit) | 🔒 **Locked** |

### Note on AMM vs Orderbook
*   **Orderbook** is peer-to-peer. A "Merge" requires a complete matched set (YES+NO) to unlock the backing collateral ($1).
*   **AMM** is a **vAMM (LMSR)**. Liquidity is mathematical (`b` parameter).
    *   When you "Sell" to the AMM, you are trading against the House's reserves.
    *   The Token is burned (reducing the House's future liability), and Cash is paid out (reducing the House's current reserves).
    *   Since this is a capital exit, it is **Locked** just like a Merge.
*   **Mechanism**: **Transfer**. `YES` tokens move from A to B.
*   **Liquidity Effect**: **Neutral**. Total Open Interest (Supply) is constant.
*   **Lock Interaction**: **None**. Funds remain in the Protocol Vault. No lock is triggered.

### B. Redemption (Protocol Level)
*   **Action**: User holds `1 YES + 1 NO` (Complete Set) and exits to USDC.
*   **Mechanism**: **Merge (Burn)**. Tokens are destroyed.
*   **Liquidity Effect**: **Contraction**. Total Open Interest decreases.
*   **Lock Interaction**: **Required**. This is a capital exit. The `TimeLock` module applies here to prevent "run-on-the-bank" attacks or oracle manipulation exits.

**Conclusion**: The specific `merge()` function is essential for Arbitrageurs/Market Makers to recycle capital. Without it, buying both sides locks capital until settlement.

## 2.4 External Ecosystem & Integrations
Unifying tokens and exposing `merge()` creates new surfaces for external interaction.

### A. Keeper & Arbitrage Opportunities
*   **The "Discount" Arb**: If $Price(YES) + Price(NO) < \$1.00$ on secondary markets (e.g., due to panic selling), external Keepers can accumulate both sides and call `merge()` to capture the spread.
    *   **Benefit**: This naturally pegs the combined token price to \$1.00, keeping the prediction market efficient without active protocol intervention.
    *   **Exposed Action**: `merge(user, amount)` is permissionless.

### B. Secondary Markets
*   **Listing**: ERC1155 tokens can be listed on NFT marketplaces (OpenSea) or wrapped for AMMs (Uniswap).
*   **Exposed Action**: `safeTransferFrom` allows tokens to leave the "walled garden" of the Sooth UI.

### C. Security Note: Flash Loan Defense
*   While `split` (Mint) is instant, `merge` (Redeem) is **Time-Locked**.
*   **Crucial Defense**: This prevents Flash Loan attacks where an attacker might try to manipulate the AMM price, mint cheap sets, and instantly redeem for profit in one block. The lock forces them to hold risk, acting as a circuit breaker.

---

# 3. Liquidity Comparison

| Feature | Sooth V2 (Current) | Sooth V3 (Unified Tick) |
| :--- | :--- | :--- |
| **Pricing Engine** | Continuous LMSR (High Gas) | Discrete Tick LMSR (Low Gas) |
| **Orderbook** | Separate Linked-List | Unified Tick Overlay |
| **Token Standard** | Internal Accounting | ERC1155 |
| **Exit Mechanism** | Settlement Only | `merge()` (Pre-settlement Exit) |
| **Math Ops** | `FixedPoint.exp/ln` | Integer `+/-` |

---

# 4. Implementation Guidelines

1.  **Strict Separation**: Ensure `transfer()` logic (Secondary) never touches the Vault's `lockProceeds` function. Only `merge()` and `sell` (where AMM burns) should trigger locks.
2.  **Tick Calibration**: Recommended $N=2000$ ticks for optimal gas/precision balance.
3.  **Migration**: V3 will be a new Market implementation. Existing V2 markets can run in parallel but won't interact.

---

# 5. References
*   *Gnosis Conditional Tokens Framework (CTF)*
*   *Uniswap V3 Tick Math*
*   *Logarithmic Market Scoring Rule (Hanson)*
