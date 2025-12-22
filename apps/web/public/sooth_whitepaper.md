# Sooth Protocol: The Permissionless Prediction Market Launchpad
### Official Whitepaper
---

## 1. Abstract
Sooth Protocol is a decentralized prediction market platform designed for institutional-grade reliability, permissionless innovation, and on-chain transparency. It introduces a novel **Launchpad Model** that enables anyone to create prediction markets with standardized configurations, bootstrapping liquidity through trading fees and rewarding early participants as both traders and Liquidity Providers (LPs).

By combining **Open-End Markets**—which eliminate rigid expiration dates—with a **Per-Market Liquidity** architecture, Sooth addresses the key limitations of existing platforms: fragmented liquidity, centralized gatekeeping, and the "Free Option" vulnerability. The protocol leverages the **Logarithmic Market Scoring Rule (LMSR)** to provide continuous liquidity and deterministic pricing, while implementing **V6 Pre-Graduation Locking** to protect capital efficiency and creator incentives.

---

## 2. Introduction
Prediction markets are powerful tools for aggregating information and forecasting real-world events. However, existing decentralized protocols often suffer from a "chicken and egg" problem: markets need liquidity to attract traders, but LPs are hesitant to provide liquidity to unproven or niche markets.

Sooth Protocol solves this by pivoting from a centralized LP pool model to a **permissionless launchpad model**. Inspired by the success of bonding curve launchpads, Sooth allows creators to bootstrap markets using their own capital (as a deposit) and organic trading volume. 

The protocol's mission is to deliver a fully on-chain, non-custodial infrastructure where:
* **Anyone can create a market** by selecting a liquidity tier and choosing a verified adjudicator.
* **Early traders become LPs** through fee contributions, earning a perpetual share of future revenue.
* **Markets graduate** into a mature state with deeper liquidity and lower fees once they reach a volume threshold.
* **Truth-driven settlement** is handled by modular adjudicators, ensuring that outcomes are based on reality, not the calendar.

---

## 3. Market Philosophy: The Open-End Model
### 3.1 Beyond Fixed Expiries
Traditional prediction markets rely on fixed end dates. If an event happens early, liquidity dries up; if it is delayed, the contract expires unresolved. Sooth introduces **Open-End Markets**:
* **Continuous Trading:** Markets remain live until the outcome is finalized.
* **Truth-Driven Termination:** The lifecycle is defined by the event condition. A market remains live until an Adjudicator signals resolution.

### 3.2 The Free Option Vulnerability & LVR
Standard Automated Market Makers (AMMs) suffer from **Loss-Versus-Rebalancing (LVR)** due to oracle latency. Sooth utilizes **Retroactive Finality**:
* **The Timestamp ($T^*$):** When an outcome is confirmed, the Adjudicator records the exact moment the event became true.
* **Economic Rewind:** Settlement accounting computes PnL relative to $T^*$, economically reversing trades executed after the event occurred. This protects LPs from latency arbitrage without requiring centralized circuit breakers.

---

## 4. Roles and Participants
The Sooth ecosystem consists of:
1.  **Creators:** Deploy markets by depositing USDC into a selected liquidity tier. They set the initial probability and select the adjudicator.
2.  **Traders:** Buy and sell outcome shares (YES/NO). During the "Internal Phase," their fees earn them LP shares.
3.  **Liquidity Providers (LPs):** In the Launchpad model, LPs are either the Creator or early Traders. They earn fees and share in the market's profit.
4.  **Adjudicators:** Modular contracts (EOA, Multisig, ZK-Oracle) that determine the outcome and $T^*$.
5.  **Guardians:** Protocol-level actors who can liquidate failed-to-graduate markets or force-graduate stuck ones to ensure system health.

---

## 5. Liquidity Architecture: The Launchpad Model
Sooth V6 moves away from global vaults to **Per-Market Liquidity**. Each market acts as its own vault, holding assets and issuing LP tokens.

### 5.1 Liquidity Tiers & Leverage
Creators select a **Liquidity Tier ($b$)** and deposit a required amount of USDC. Sooth uses **1.44x Liquidity Leverage**:
$$ \text{Deposit} = b \times \ln(2) \approx b \times 0.693 $$
A creator depositing \$693 provides \$1,000 of liquidity depth ($b$). This ensures capital efficiency where 100% of the deposit is utilized for market backing.

| Tier | Liquidity ($b$) | Creator Deposit | Graduation Threshold ($2 \times b$ fees) |
| :--- | :--- | :--- | :--- |
| **Micro** | \$100 | \$69 | \$200 |
| **Small** | \$1,000 | \$693 | \$2,000 |
| **Medium** | \$10,000 | \$6,930 | \$20,000 |
| **Large** | \$100,000 | \$69,300 | \$200,000 |

### 5.2 The Graduation Race
Markets race to graduate from the **Internal Phase** to the **Graduated Phase** within a 5-day deadline.
* **Internal Phase:** 5% AMM fee. 100% of fees grow the liquidity parameter $b$. Traders earn LP tokens proportional to fees paid.
* **Graduation Trigger:** When cumulative fees reach $2 \times b$.
* **Graduated Phase:** 1% AMM fee / 0.5% Orderbook fee. Fees are split: 50% to $b$ growth, 30% to LP Vault (Yield), 20% to Protocol.

### 5.3 V6 Pre-Graduation Locking
To protect creator capital and ensure settlement solvency, V6 implements **Pre-Graduation Locking**:
* **Locked Proceeds:** Sell proceeds during the Internal Phase are locked for 24 hours.
* **Reinvestment:** Locked funds can be used immediately to buy other shares in the same market, maintaining trading velocity while preventing "hit-and-run" value extraction.
* **Withdrawal Guard:** Global withdrawals are blocked if a user has active locks in any market.

---

## 6. Adjudication Layer
Sooth employs modular **Adjudicator Classes**. Creators choose the most appropriate truth source for their market:
1.  **Optimistic:** Disputes resolved via UMA or Reality.eth (Subjective events).
2.  **ZK Rule:** Deterministic on-chain state checks via ZK-Coprocessors (DeFi events).
3.  **Oracle + ZK:** ZK-proven data from Chainlink or other feeds (Financial thresholds).
4.  **Multisig:** Authorized signatures from trusted entities (Institutional/Private data).

---

## 7. Settlement and Payouts
Upon resolution, the Adjudicator finalizes the market via `finalizeResolution(outcome, T*)`.
1.  **Trader Payouts:** Calculated based on shares held and the final outcome.
2.  **LP Payouts:** Remaining funds in the market (Reserves) are distributed pro-rata to LP token holders.
3.  **Protocol Share:** If the market is profitable, the Protocol takes a 20% share of the profit (post-graduation only).
4.  **Expiry/Failure:** If a market fails to graduate in 5 days or the truth is known too early, it enters an **Expired** state where all creator deposits and trader fees are refunded pro-rata.

---

## 8. Technical Reference (Interfaces)
### 8.1 Launchpad Factory
```solidity
interface ILaunchpadFactory {
    function createMarket(
        string memory name,
        string memory symbol,
        string memory description,
        uint8 liquidityTierIndex,
        bool isOpenEnd,
        uint40 durationSeconds,
        address marketAdjudicator // 0 = default adjudicator
    ) external returns (address market, address lpVault);
}
```

### 8.2 Launchpad Market
```solidity
interface ILaunchpadMarket {
    function state() external view returns (MarketState); // Internal, Graduated, Settled, Expired
    function graduate() external;
    function finalizeResolution(uint8 outcome, uint64 tStar) external; // Adjudicator-only
}
```

---

## 9. Implementation Status (December 2025)
The **V6 Launchpad Architecture** is live on **Base Sepolia**.
* **LaunchpadFactory (V6):** Deployed at `0x5fe83532e061353ADe5D604DfB4239aE7c8B9d2F`.
* **ProtocolConfig:** Centralized management of fees and guardians.
* **Reference Markets:** "Alien Life Disclosure" and "BTC 7-day TWAP" markets are actively trading.
* **Frontend:** Full inline trading, graduation progress bars, and creator dashboards are integrated into the Sooth dApp.

---

## 10. Conclusion
Sooth Protocol represents a paradigm shift in decentralized forecasting. By combining the permissionless nature of a launchpad with the mathematical rigor of LMSR and the security of ZK-driven retroactive settlement, Sooth creates a self-sustaining ecosystem for global risk management. Whether for institutional hedging or viral prediction games, Sooth provides the infrastructure for truth to prevail.
