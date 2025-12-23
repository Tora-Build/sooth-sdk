# Research Summary: Modular Venue Stack

**Date**: 2025-12-23  
**Status**: Architectural Consensus  
**Context**: This document wraps up the design convergence for the "Truth Market + AMM Engine + OB Venue" architecture.

---

## 1. The Tri-Modular Stack

The Sooth Protocol is evolving from a monolithic market structure to a decoupled, modular stack. This separation allows for specialized upgrades without compromising core security.

| Layer | Responsibility | Primary State |
| :--- | :--- | :--- |
| **Truth Market** | Canonical source of lifecycle (Live/Settled) and resolution (Truth-time, Outcome). | Lifecycle Flags, T* |
| **AMM Engine** | High-precision, continuous Logarithmic Market Scoring Rule (LMSR) pricing. | `qYes`, `qNo` |
| **OB Venue** | High-performance, capital-efficient "Tick Book" for discrete/continuous trading. | Tick Liquidity, Bitmap |

---

## 2. Non-Fungible Domains (Positions vs. Tokens)

A critical decision was made to keep the **AMM Domain** and **OB Domain** non-fungible.

- **AMM Domain (Positions)**: Trades result in non-transferable internal positions within the Vault/Market. This domain supports **security features** like sell-proceeds locks, dispute windows, and retro-settlement (Merkle roots).
- **OB Domain (Tokens)**: Trades result in transferable ERC20 outcome tokens. This domain prioritizes **capital efficiency** and DeFi composability.

### **The bypass protection**
By separating these domains, we prevent attackers from using the OB to "bypass" AMM-specific safety locks. Any movement between domains requires an explicit adapter/bridge with its own security policy.

---

## 3. Standard External Interface

To support non-Sooth markets, the OB Venue (TickBook) assumes a minimal interface for the underlying market.

### **Minimal Market Interface (`ITruthMarket`)**
```solidity
interface ITruthMarket {
    function isLive() external view returns (bool);
    function isSettled() external view returns (bool);
    function winningOutcome() external view returns (uint8);
    function tStar() external view returns (uint64);
    function getRedemptionValue(uint8 outcome) external view returns (uint256);
}
```

### **Pull-Based Lifecycle Gating**
The Venue operates on a **Pull-First** basis. It queries the `ITruthMarket` on every state-changing operation (`swap`, `addLiquidity`) to ensure trading is allowed. This eliminates the dependency on the market contract "pushing" events correctly.

---

## 4. TraderVault Evolution

The `TraderVault` is being refactored into **`TraderVaultLite`**.
- **Role**: Purely a custody and ledger helper for UX.
- **Simplification**: All execution logic (matching, pricing) is moved to the specialized Venue/Engine modules.
- **Custody**: In the Modular Stack, the **Venue** may hold its own token custody, while the **Vault** handles the user's USDC collateral and split/merge interactions.

---

## 5. Next Steps
The protocol will move forward with the implementation of the **Continuous Linear Tick** model as the primary OB replacement, utilizing the native ERC20 outcome token domain for maximum composability.
