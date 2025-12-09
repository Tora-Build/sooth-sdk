# Unified Tick-Based Prediction Market Model
## (formerly Model B: Tick-Based LMSR)

This document defines the architectural specification for the **Unified Tick-Based AMM**, a unified liquidity protocol combining an LMSR-based AMM with a Central Limit Orderbook using a shared discrete tick system. It integrates key findings regarding liquidity dynamics and token lock mechanics.

---

# 1. The Core Innovation: Unified Ticks

Traditional prediction markets split liquidity between:
1.  **AMM**: Continuous, high-gas, "always on" automated pricing (using expensive `exp`/`log`).
2.  **Orderbook**: Discrete, low-gas, user-provided limit orders.

**Sooth Unified Market unifies these** by adopting a discrete **Tick System** (inspired by Uniswap v3) where:
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

### 2.2.1 Hybrid Approach: User Tokens + AMM Accounting
*   **User Balances**: Fully tokenized (ERC1155). Users can transfer, trade on DEXs, or call `merge()`.
*   **AMM Inventory**: **Virtual** (Accounting-based). The AMM does not hold ERC1155 balances.
    *   State is represented by `currentTick` (or `qYes/qNo`).
    *   Trades with AMM are **Mint** (Buy) or **Burn** (Sell) operations.
*   **Analogy**: Similar to **pump.fun**'s internal bonding curve (accounting) vs external Raydium pool (tokenized).

**Why This Works:**
*   AMM acts as the **Issuer**, not a liquidity pool. It doesn't "hold" inventory—it creates/destroys claims on demand based on the cost function.
*   This saves gas (no redundant balance updates for the AMM address) and prevents supply inflation (AMM-held tokens would artificially inflate total supply without representing real liabilities).

## 2.3 Liquidity Dynamics: AMM-Centric Protection (The "Two-Tier" Model)
We adopt a model where protection (Locking) is focused specifically on the AMM, while the Orderbook and Redemption layers remain open for maximum efficiency.

| Interaction Source | Mechanism | Capital Effect | Lock Status | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Orderbook P2P** | Transfer/Split/Merge | Neutral or Outflow | 🔓 **Free** | Market Driven. User takes counterparty risk. |
| **Merge Function** | Burn (Redeem) | Outflow (Exit) | 🔓 **Free** | **Price Neutral**. User holds full set (Hedging). Safe to exit. |
| **AMM Trade** | Sell / Buy | Liability Change | 🔒 **Locked** | **Protect AMM Actors**. Prevents toxic flow draining LPs. |

### Why Unlock "Merge"?
*   **Atomic Arbitrage**: By making `merge()` free, Keepers can buy mispriced shares (Sum < $1.00) and unlock the profit **atomically in one block**.
*   **Peg Stability**: This ensures the combined price of YES+NO is practically pinned to $1.00, increasing confidence for all participants.
*   **Security**: Since `Merge` requires holding both YES and NO ($Value = 1.00$), the user is delta-neutral. They cannot exploit oracle latency because their position value is fixed regardless of the outcome.

### The "Casino vs Spot" Distinction
1.  **The Casino (AMM)**: Guarded by TimeLocks. Interacting with the House requires safeguards.
2.  **The Spot Market (Orderbook)**: Open and Permissionless. Users trading with users or interacting with the protocol mechanics (Merge) face no artificial friction.
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

| Feature | Legacy Sooth (V2) | Unified Tick Market |
| :--- | :--- | :--- |
| **Pricing Engine** | Continuous LMSR (High Gas) | Discrete Tick LMSR (Low Gas) |
| **Orderbook** | Separate Linked-List | Unified Tick Overlay |
| **Token Standard** | Internal Accounting | ERC1155 |
| **Exit Mechanism** | Settlement Only | `merge()` (Pre-settlement Exit) |
| **Math Ops** | `FixedPoint.exp/ln` | Integer `+/-` |

---

# 4. Implementation Guidelines

1.  **Strict Separation**: Ensure `transfer()` (Secondary) and `merge()` (Redemption) never touch `TimeLock`. **Only `executeAMMTrade` (AMM Interaction) should trigger locks.**
2.  **Tick Calibration**: Recommended $N=2000$ ticks for optimal gas/precision balance.
3. **Migration**: This will be a new Market implementation. Existing legacy markets can run in parallel but won't interact.

---

# 5. References
*   *Gnosis Conditional Tokens Framework (CTF)*
*   *Uniswap V3 Tick Math*
*   *Logarithmic Market Scoring Rule (Hanson)*
