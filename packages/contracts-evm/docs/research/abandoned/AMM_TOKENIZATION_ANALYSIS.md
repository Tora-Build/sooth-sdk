# Analysis: Should AMM Inventory be Tokenized?

## The Question
Should the AMM address itself hold ERC1155 balances of `YES` and `NO` tokens?

## The Mechanics: Inventory vs. Emission

### 1. Uniswap Model (Inventory-Based)
*   **Mechanism**: LPs deposit Token A and Token B. The Pool holds these balances.
*   **Trade**: User Swaps A -> B. Pool Balance A increases, B decreases.
*   **Requirement**: The Pool **MUST** be tokenized because it acts as a vault for existing assets.

### 2. LMSR Model (Emission-Based / Issuer)
*   **Mechanism**: The AMM is the **Market Maker of Last Resort** (the Issuer).
*   **Trade (Buy)**: User sends Collateral. AMM **Mints** new shares.
    *   `Liability (q)` increases.
*   **Trade (Sell)**: User returns shares. AMM **Burns** shares.
    *   `Liability (q)` decreases.
*   **Requirement**: The AMM does not "swap" assets. It creates and destroys contracts based on the `Cost Function`.

## Why Verification Fails for Tokenized AMM
If the AMM held tokens (e.g., User sells YES to AMM, AMM keeps YES):
1.  **Supply Inflation**: The Total Supply of YES would imply liabilities that don't exist (because the AMM owes itself).
2.  **Collateral Lock**: The Collateral backing those AMM-held tokens would be locked in the Vault, serving no purpose.
3.  **Gas Waste**: Updating `_balances[AMM][ID]` costs gas purely for internal bookkeeping.

## Conclusion: "Virtual Inventory"
The AMM's inventory is **Virtual**.
*   It is represented solely by the `currentTick` (or `qYes/qNo` state).
*   This number represents the **Net Outstanding Liability** to the world.

## Recommendation
**NO. Do not tokenize AMM inventory.**
*   **Users**: Hold ERC1155 Tokens.
*   **AMM**: Holds **State** (`currentTick`).
*   **Operations**:
    *   **Buy**: Mint (Create).
    *   **Sell**: Burn (Destroy).

 This is the most gas-efficient and mathematically correct approach for an LMSR prediction market.
