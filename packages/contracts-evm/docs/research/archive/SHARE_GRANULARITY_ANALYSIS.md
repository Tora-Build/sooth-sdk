# Research: Minimal Share Unit Analysis

**User Question:** "Should we restrict minimal share unit = 1?"

## 1. Context
-   **Current State**: `OutcomeToken` is an ERC1155. It uses `uint256 amount`, typically scaled to 1e18 (WAD).
-   **Payout**: 1 Share (1e18) pays 1 USDC (1e6) upon resolution.
-   **AMM Math**: Continuous LMSR (SD59x18) handles high precision but is computationally bounded by gas.

## 2. Interpretation of "Unit = 1"
The user likely implies enforcing **Integer-Only Shares** (or a Minimum Unit of 1 Whole Share), effectively removing decimals from the end-user's perspective.

**Two Models:**
1.  **Fractional Model (Current)**:
    -   1 Share = 1e18 units.
    -   User can buy 0.5 shares (5e17 units).
    -   Payout = portion of 1 USDC.
2.  **Integer Model (Proposed)**:
    -   1 Share is Atomic.
    -   User can buy 1, 2, 10 shares. Cannot buy 1.5 shares.
    -   Underlying representation could still be 1e18 (for math compatibility) or strictly 1 (requires rescaling).

## 3. Analysis

### 3.1 Payout Precision (The "Dust" Problem)
-   **Scenario**: User holds `1e11` units (0.0000001 Shares).
-   **Payout**: $(1 \times 10^{11} / 10^{18}) \times 10^6$ USDC.
-   **Result**: $10^{17} / 10^{18} = 0.1$ USDC wei? No.
-   Calculation: `amount * 1e6 / 1e18`
-   If amount = `1e11`: $10^{11} \times 10^6 = 10^{17}$.
-   $10^{17} / 10^{18} = 0$ (Integer Division).
-   **Issue**: Any amount < `1e12` (1 picoshare) pays out **0 USDC**.
-   **Conclusion**: There is already a "natural" minimum limit due to USDC decimals. Allowing trades below `1e12` is effectively allowing users to buy worthless dust.

### 3.2 UX & Cognitive Load
-   **Fractional**: "I bought 10.53 YES".
    -   Standard for crypto (ETH, tokens).
    -   Allows "Change" (if I spend exactly $100, I might get 153.2 shares).
-   **Integer**: "I bought 10 YES".
    -   cleaner mental model ("1 Ticket").
    -   Harder for "Spend Max" logic (I have $100, price is $0.63. I buy 158 shares. Remainder $0.46 is left as dust USDC).

### 3.3 Recommendation

**Adopt a "Soft" Minimum, not Hard Integer Enforcement.**
Enforcing "Integer Only" at the protocol level (reverting if `amount % 1e18 != 0`) is rigid and prevents valid use cases (e.g., converting fractional LP shares).

**Alternative Proposal**:
1.  **UI Level**: Defaults to 2 decimals or integers.
2.  **Protocol Level**: Enforce `MIN_TRADE_SIZE` (e.g., 1e15 or 0.001 shares) to prevent spam/dust attacks, but don't force integers.
3.  **Rationale**:
    -   If we enforce `unit=1` (1 share), we lose flexibility.
    -   If the user meant "Min Trade Amount", yes, we should prevent < 1e6 trades.

## 4. Hybrid Granularity (Orderbook vs AMM)

**User Question:** "What about only on orderbook?"

### 4.1 Concept: Round Lots vs Odd Lots
This approach mimics Traditional Finance (TradFi):
-   **Orderbook (Round Lots)**: Enforces integer (or specific step) granularity (e.g., 1.0, 2.0 Shares).
-   **AMM (Odd Lots)**: Accepts any fractional amount (e.g., 0.5342 Shares).

### 4.2 Pros
1.  **Cleaner Orderbook**: Prevents "dust attacks" where the book is clogged with 0.000001 share orders.
2.  **Matching Efficiency**: Integer matching is marginally simpler than managing 18-decimal residuals.
3.  **User Mental Model**: "I place a limit order for 100 Shares at $0.65" is cleaner than "100.2452 Shares".

### 4.3 Cons / Friction
1.  **"Exit Problem"**: If I buy 10.5 shares on AMM, I can sell 10 on Orderbook. What do I do with the 0.5?
    -   *Solution*: I must sell the 0.5 back to the AMM. This naturally segments liquidity: "Bulk" goes to OB, "Dust" goes to AMM. This is actually **desirable** for LPs (less toxic flow).

### 4.4 Updated Recommendation

**YES, Enforce Integer Granularity on Orderbook Only.**

Contract Implementation:
```solidity
function createOrder(..., uint256 amount) external {
    require(amount % 1e18 == 0, "OB: Integers only");
    // ...
}
```

This creates a robust hybrid market:
-   **Orderbook**: Integers only (High signal, "Round Lots").
-   **AMM**: Infinite liquidity for fractions ("Odd Lots").

## 5. Final Proposed Answer
"**Yes, restricting the Orderbook to Integer-Only (Unit=1) is an excellent idea.** It prevents dust spam on the book and simplifies matching, while the AMM remains available to clean up any fractional 'odd lots' (e.g., users can sell their leftover 0.4 shares to the AMM)."

## 6. Analysis: Why not use Native Integers (`decimals=0`)?

**User Question:** "why just apply Integer data type to share directly"

**Interpretation:** User is asking why we don't change `OutcomeToken` to use `decimals=0` (where 1 unit = 1 share) instead of `decimals=18`.

### 6.1 The "Exact Input" vs "Exact Output" Trade-off (The Dust Problem)
If we enforce Integers (`decimals=0`), the market fundamentally shifts from "Amount In" to "Amount Out" logic.

-   **Fractional (Standard DeFi)**: "I want to swap **100 USDC**."
    -   Result: You get `163.934` shares. **0 USDC left**.
-   **Strict Integer (Ticket Model)**: "I want to buy **Shares**."
    -   Scenario: User has 100 USDC. Price is 0.61.
    -   Max Integer Shares = `floor(100 / 0.61) = 163` shares.
    -   Cost = `163 * 0.61 = 99.43` USDC.
    -   **Result**: User has **0.57 USDC dust** stuck in their wallet that cannot be invested.

### 6.1 The "Shared Token" Constraint
The **Orderbook** and **AMM** use the *same* `OutcomeToken` (ERC1155).

1.  **If we make `OutcomeToken` strictly Integer (`decimals=0`)**:
    -   It forces the **AMM** to also be Integer-Only.
    -   **AMM Friction**: This breaks "Swap 100 USDC for Shares" (Exact Input) because the AMM cannot return fractional shares to absorb the full 100 USDC. Users are forced to leave dust.

2.  **If we keep `OutcomeToken` Fractional (`decimals=18`)**:
    -   **AMM**: Works perfectly (Spend Max 100 USDC $\to$ 163.93 Shares).
    -   **Orderbook**: We can *artificially* restrict it to Integers via `require(amount % 1e18 == 0)`.

**Answer to "Where does Spend Max happen?":**
It happens effectively on the **AMM**.

### 6.1 The "Virtual Accounting" Architecture (Finalized)
You clarified the correct architecture:
1.  **OutcomeToken**: Uses **`decimals=0`** (Native Integer).
    -   1 Unit = 1 Share.
    -   No `1e18` scaling on the token itself.
2.  **AMM (Virtual)**: Uses **`decimals=18`** (High Precision).
    -   Internal `qYes/qNo` and user balances are stored as WAD.
3.  **Bridge / Withdrawal**:
    -   User has `10.53e18` Virtual Shares.
    -   User withdraws/trades on Orderbook: Can only move `10` Tokens.
    -   `0.53e18` remains as Virtual Dust.

**Correction on Orderbook Enforcement**:
My previous statement `amount % 1e18 == 0` was incorrect because it assumed `decimals=18`.
-   **Correct Logic**: The Token *is* an Integer. No check needed. `amount = 10` implies 10 shares.

**Result**:
-   **Orderbook**: Naturally Integer-Only (Round Lots).
-   **AMM**: Naturally Fractional (Odd Lots + Pricing Precision).
-   **Integration**: Seamless segregation of duties.

We proceed with this architecture.

### 6.2 Math Precision & Compatibility

### 6.2 Math Precision & Compatibility
-   **LMSR Math**: Relies on `log` and `exp`. These functions operate on high-precision fixed-point numbers (e.g., 1e18). If we feed them small integers (e.g., `q=100`), we lose significant granularity in the probability curve unless we manually rescale every input/output.
-   **Interoperability**: Most DeFi tooling (wallets, indexes) assumes standard ERC20 behavior where `1.0` token is represented as a large integer.

### 6.3 Conclusion
It is superior to **store** values as 18-decimal fixed-point integers (`uint256` scaled by 1e18) for math precision and AMM compatibility, but **enforce** logic-level restrictions (like `require(amount % 1e18 == 0)`) for specific actions like Orderbook placement. This gives us the "best of both worlds": cleanliness of integers where we want it, and precision of fractions where we need it (AMM).
