# Sooth Protocol: The Infinite-End Decentralized Prediction Market
### Official Whitepaper
---

## 1. Abstract
Sooth Protocol is a decentralized prediction market platform designed for institutional-grade reliability and on-chain transparency. It introduces **Infinite-End Markets**, a novel market structure that eliminates rigid expiration dates, allowing markets to remain open until a verifiable event condition is met.

By combining a **Singleton Vault** liquidity model with trust-minimized **Zero-Knowledge (ZK) Settlement**, Sooth addresses the key limitations of existing platforms: fragmented liquidity, settlement latency, and the "Free Option" vulnerability that drains liquidity providers. The protocol leverages Account Abstraction to offer a seamless, non-custodial user experience while providing robust compliance hooks for institutional participants.

---

## 2. Introduction
Prediction markets have rapidly evolved into powerful tools for aggregating information and forecasting real-world events. Recent platforms like Polymarket and Kalshi have demonstrated significant growth, handling billions in volume. However, the current landscape forces a trade-off between decentralization and efficiency:

* **Decentralized protocols** (e.g., Omen, Augur) suffer from liquidity fragmentation, where each market has an isolated pool, limiting depth and causing high slippage.
* **Centralized or Hybrid platforms** (e.g., Kalshi, Polymarket) rely on off-chain components or custodial accounts, introducing regulatory friction and opacity.

Sooth Protocol is designed to bridge this gap. It blends the continuous trading efficiency of perpetual futures with the discrete settlement of event contracts. Sooth’s mission is to deliver a fully on-chain, non-custodial infrastructure with deep liquidity, fast settlements, and a user experience on par with centralized exchanges.

---

## 3. Market Philosophy: The Infinite-End Model
### 3.1 Beyond Fixed Expiries
Traditional prediction markets are "periodical"—they rely on fixed end dates. If an event happens early, liquidity dries up; if it is delayed, the contract expires unresolved.

Sooth introduces **Infinite-End Markets**:
* **Continuous Trading:** Markets have no preset trading rounds or intervals. Trading stops only when the outcome is finalized.
* **Truth-Driven Termination:** The lifecycle of a market is defined solely by the event condition, not the calendar. A market remains live until an Adjudicator explicitly signals resolution.

### 3.2 The Free Option Vulnerability & LVR
A critical flaw in standard Automated Market Makers (AMMs) and prediction markets is the **"Free Option" attack** (often resulting in **Loss-Versus-Rebalancing** or **LVR**).

* **The Vulnerability:** In prediction markets, when a real-world event occurs (e.g., a goal is scored), there is a latency period before the on-chain oracle updates. Informed traders can exploit this lag to trade against stale quotes, effectively taking a "free option" at the expense of Liquidity Providers (LPs).
* **The Sooth Solution:** Sooth utilizes **Retroactive Finality**. By determining the precise timestamp ($T^*$) when the event occurred, the protocol economically invalidates any trades executed during the latency period. This structurally eliminates LVR derived from latency arbitrage, protecting LPs without requiring centralized emergency brakes.

### 3.3 Retroactive Finality ($T^*$)
To implement this protection, Sooth separates the *reporting* time from the *event* time.
* **The Timestamp ($T^*$):** When an outcome is confirmed, the Adjudicator records the **Effective Termination Time ($T^*$)**—the exact moment the event became true.
* **Economic Rewind:** Settlement accounting computes PnL relative to $T^*$. All trades executed *after* $T^*$ are economically reversed via delta-PnL adjustments. This ensures no chain rollback is required while maintaining market integrity.

---

## 4. Roles and Participants
The Sooth ecosystem is composed of five key participants:

1.  **Traders:** Interact exclusively through Sooth Smart Accounts. They maintain collateral, positions, and virtual PnL.
2.  **Liquidity Providers (LPs):** Deposit assets into Singleton Vaults. They act as the passive counterparty to all trades, earning fees without managing individual market positions.
3.  **Guardians:** Security actors who monitor live signals. They can **mark** a market to pause trading upon detecting an event, but they cannot determine the outcome.
4.  **Adjudicators:** The truth layer. They determine `outcome = YES/NO` and `terminationTime = T*`. They do not handle economics, only truth.
5.  **Settlement Accounting Layer:** An off-chain ZK-coprocessor that computes final balances based on the Adjudicator's data and generates validity proofs for on-chain settlement.

---

## 5. Liquidity Architecture: The Singleton Vault
Sooth solves the fragmentation problem by unifying liquidity at the protocol level.

### 5.1 Singleton Vaults
Each Vault is scoped by `(ChainID, AdjudicatorClass)`.
* **Unified Capital:** LPs deposit into the Vault, not specific betting pools. The Vault backs all markets sharing that specific adjudicator class.
* **Risk Isolation:** Risks are isolated by class (e.g., Sports Vault vs. Crypto Price Vault). LPs can choose their exposure type.
* **Diversification:** LPs act as the "house" for a broad basket of markets, diversifying risk and simplifying participation.

### 5.2 vAMM and Bounded Loss (LMSR)
Sooth utilizes a virtual Automated Market Maker (vAMM) based on the **Logarithmic Market Scoring Rule (LMSR)**.
* **Virtual Liquidity:** The protocol allocates liquidity to specific markets based on weights derived from the Vault's total TVL.
* **Bounded Loss:** The LMSR math guarantees a deterministic maximum loss for the Vault, ensuring solvency independent of flow imbalance.
* **Battle-tested Math:** The production `SoothLMSRReal` contract now routes all `exp/ln` calls through **PRBMath**, eliminating the Taylor-series approximation bug that once priced balanced markets at ~0.06. The fixed contract powers every deployed market and is guarded by a dedicated Foundry suite (`test/SoothLMSRReal.t.sol`) that verifies balanced pricing, round-trip invariants, and monotonic prices across 19 tests.

**Cost Function:**
$$C(q_{Yes}, q_{No}) = b \cdot \ln( e^{q_{Yes}/b} + e^{q_{No}/b} )$$

**Price Determination:**
$$P_{Yes} = \frac{e^{q_{Yes}/b}}{e^{q_{Yes}/b} + e^{q_{No}/b}}$$

Where $b$ is the liquidity parameter and $q$ is the quantity of outcome shares.

### 5.3 Dynamic Liquidity Calibration (SoothRiskManager)
The `SoothRiskManager` contract continuously derives market depth from the Vault’s realized balances. After every deployment or settlement the factory (and operators) call `updateGlobalB()`:

$$
L_{max} = \frac{Treasury + LiquidBuffer}{K} \quad ; \quad b_{global} = L_{max} \cdot 1.4427
$$

where $K$ is the configured maximum concurrent worst-case markets. Individual markets inherit a risk-adjusted $b$:

$$
b_{market} = b_{global} \times \frac{riskMultiplier}{10{,}000}
$$

| Risk Class | Multiplier | Result |
| :--------- | :--------- | :----- |
| **LOW**    | 6,000 bps  | $b = 0.6 \times b_{global}$ |
| **MEDIUM** | 10,000 bps | $b = 1.0 \times b_{global}$ |
| **HIGH**   | 14,000 bps | $b = 1.4 \times b_{global}$ |
| **CRITICAL** | 18,000 bps | $b = 1.8 \times b_{global}$ |

Deployment scripts now seed liquidity (100k units on Base Sepolia) *before* market creation, guaranteeing non-zero `b` values for every live market and ensuring the LMSR curve reflects actual vault depth.

### 5.4 Vault Accounting Safeguards
Unrealized PnL is isolated from LP share accounting. The vault’s `recordMarketFlow()` only transfers tokens and records the delta inside `marketReserves`, leaving `totalAssets` untouched until settlement proofs arrive. This fix prevents depositors from arbitraging unrealized gains and keeps the share exchange rate pegged 1:1 to realized assets. The dedicated `VaultAccountingTest` suite (8 tests) plus integration coverage (27 tests total) now enforces this behavior across every release.

---

## 6. Adjudication Layer
Sooth employs a modular oracle architecture allowing different "Adjudicator Classes" for different market types.

| Adjudicator Class  | Mechanism                                                    | Use Case                                         |
| :----------------- | :----------------------------------------------------------- | :----------------------------------------------- |
| **1. Optimistic**  | Proposals escalated to dispute systems (e.g., UMA, Reality.eth). | Subjective events, politics, news.               |
| **2. ZK Rule**     | ZK program reads on-chain state to deterministically prove a condition. | Protocol hacks, solvency checks.                 |
| **3. Oracle + ZK** | ZK program processes data from feeds (e.g., Chainlink) to prove logic (e.g., TWAP). | Financial thresholds, volatility triggers.       |
| **4. Attestation** | Threshold signatures from authorized off-chain entities.     | Regulatory outcomes, private institutional data. |

---

## 7. Settlement Engine
Sooth separates "truth" (Adjudicators) from "accounting" (Settlement Layer) to achieve scalability.

### 7.1 The Process
1.  **Guardian Mark:** A Guardian detects an event and "marks" the market. Smart Accounts enter a "Cooldown" state.
2.  **Adjudication:** The Adjudicator confirms the outcome and stamps $T^*$.
3.  **ZK Computation:** An off-chain engine (ZK-Coprocessor agnostic, e.g., Brevis) reads trade history and $T^*$. It calculates final delta-PnL for all users.
4.  **On-Chain Verification:** The engine submits a ZK proof. The Vault verifies it and updates a **Settlement Sink**.
5.  **Distribution:** Users (or Keepers) claim funds via Merkle proofs from the sink.

This architecture allows Sooth to settle thousands of users retroactively without massive gas costs.

---

## 8. User Experience: Sooth Smart Accounts
Sooth leverages Account Abstraction (Smart Contract Wallets) to deliver an institutional-grade UX.

* **Unified Portfolio:** The Smart Account acts as a vault for all user positions. It calculates portfolio-wide margin, allowing gains in one market to offset losses in another (Cross-Margining).
* **Gas Abstraction:** Users can sign intents (meta-transactions), allowing relayers to pay gas. This enables a "web2-like" experience.
* **Safety:** Accounts support multi-sig approvals and social recovery.
* **Privacy-Preserving Compliance:** Users can attach ZK identity proofs (e.g., "User is Non-US") to their accounts. This allows front-ends to enforce regulatory restrictions without the protocol storing user data.

### 8.1 Deterministic Slippage Protection
All trades now include an explicit `maxCost` guard baked into `SoothMarket.trade(uint8 outcomeIndex, int256 deltaShares, int256 maxCost)`. Front-ends compute the expected LMSR cost via `SoothLMSRReal.costDelta(...)`, add the user’s tolerance (e.g., ±2%), and pass that bound on-chain. Buys revert if `actualCost > maxCost`; sells revert if proceeds fall below the bound. This removes "surprise fills", gives relayers deterministic execution, and lets institutions set policy-level tolerances without trusting middleware.

---

## 9. Tokenomics
The protocol aligns incentives between Traders, LPs, and the Protocol Treasury.

### 9.1 Fee Distribution
Trading fees generated by the vAMM are distributed as follows:
* **80% to Liquidity Providers (LPs):** To incentivize deep capital.
* **10% to Protocol Treasury:** For operations and development.
* **10% to Token Buyback:** To capture value for governance.

### 9.2 Vault Yield
Capital in Singleton Vaults is not idle; it can be deployed to yield strategies.
* **50% to LPs**
* **25% to Protocol Treasury**
* **25% to Token Buyback**

---

## 10. Regulatory and Institutional Considerations
Sooth adopts a "pragmatic decentralization" approach.

* **Permissionless Core:** The base protocol is open software. It does not enforce KYC or jurisdiction limits by default.
* **Compliance Hooks:** The Smart Account architecture allows for "Permissioned Pools" or "Walled Gardens." Institutions can deploy specific Vaults that only accept interactions from Smart Accounts holding valid KYC credentials (verified via ZK proofs).
* **No Native Asset Dependency:** Markets settle in stablecoins (e.g., USDC), ensuring payoffs are understandable and reducing volatility risk for institutions.

---

## 11. Comparative Analysis
| Dimension           | **Sooth Protocol**                     | **Polymarket**          | **Kalshi**                       | **Omen**                |
| :------------------ | :------------------------------------- | :---------------------- | :------------------------------- | :---------------------- |
| **Market Type**     | **Infinite-End** (Terminates at $T^*$) | Event-based (Fixed End) | Event Contracts (Fixed End)      | Event-based (Fixed End) |
| **Liquidity Model** | **Singleton Vaults** (LMSR vAMM)       | Hybrid Order Book       | Central Limit Order Book         | Fragmented AMM Pools    |
| **LVR Protection**  | **Retroactive Settlement ($T^*$)**     | None (Latency Arb Risk) | Centralized Circuit Breakers     | None                    |
| **Settlement**      | **ZK Accounting + Retroactive**        | Optimistic Oracle (UMA) | Centralized Regulatory Oversight | Reality.eth + Kleros    |
| **User Account**    | **Smart Accounts** (Cross-margin)      | EOA / Multisig          | Custodial (KYC)                  | EOA (Web3 Wallet)       |

---

## 12. Implementation Status (Q4 2025)
The reference implementation now mirrors the full protocol design: infinite-end markets, singleton liquidity, dynamic LMSR pricing, on-chain slippage guards, and retroactive settlement sinks are all live on Base Sepolia and mirrored on Monad testnet.

### 12.1 Reference Stack Progress
- **Core contracts:** `SoothVault`, `SoothRiskManager`, `SoothLMSRReal`, `SoothMarketFactory`, `SoothSettlement`, and `SoothSmartAccount` deploy as a bundle via `script/DeploySooth.s.sol`, which now mints 100k mock USDC and seeds the vault before markets launch.
- **AMM accuracy:** `SoothLMSRReal` uses PRBMath for all log-sum-exp calls. The bugfix is documented in `docs/CHANGES_SUMMARY_2025_11_30.md` and enforced by the dedicated Foundry test.
- **Accounting safety:** `SoothVault` separates realized assets from `marketReserves`, a fix deployed on Nov 30 (`VAULT_ACCOUNTING_FIX_DEPLOYED.md`) to keep LP share price at 1:1 regardless of unrealized swings.
- **Trading UX:** `SoothMarket.trade()` now requires `maxCost`, exposing deterministic slippage protection that front-ends implement as described in `docs/frontend-integration/SLIPPAGE_PROTECTION.md`.

### 12.2 Testnet Deployments
| Network | Contracts | Markets | Notes |
| :------ | :-------- | :------ | :---- |
| **Base Sepolia** | Vault, Risk Manager, SoothLMSRReal, Settlement, Adjudicator Registry, Market Factory | `ExampleMarket` + `SecondMarket` | Shared liquidity seeded with 100k mock USDC; `deployments.json` lists current addresses; markets run under MEDIUM risk class with non-zero `b`. |
| **Monad Testnet** | Same stack | 5 illustrative markets (BTC price, ETH gas, Monad launch, Sooth TVL, Monad Top 10) | Addresses tracked in `docs/frontend-integration/MONAD_DEPLOYMENT_SUMMARY.md` and `deployments-monad.json`, exercising all risk classes and adjudicator types. |

Deployment scripts emit matching artifacts under `broadcast/` for reproducibility, and `SECOND_MARKET_DEPLOYMENT.md` plus `DEPLOYMENT_SUCCESS.md` walk through the Base Sepolia rollout timeline.

### 12.3 Tooling & Verification
- **Automated initialization:** `script/InitializeVault.s.sol` and `scripts/initialize-vault.sh` handle mint/approve/deposit/update-b flows for any fresh vault.
- **Test coverage:** 27 Foundry tests now cover vault accounting, LMSR pricing, market slippage, integration paths, and settlement accounting. CI expects `forge test -vv` to pass before every deployment.
- **Frontend sync:** All client-facing docs under `docs/frontend-integration/` (Quick Start, Contract Interfaces, Slippage, Deployment status) have been updated with the latest ABI signatures, addresses, and LMSR usage notes, ensuring integrators can rely on the current contracts without spelunking the codebase.

---

## 13. Technical Reference (Interfaces)
Sooth provides modular interfaces for developers building on the protocol.

### 13.1 Adjudicator Interface
```solidity
interface IAdjudicator {
    function requestFinality(bytes32 marketId, bytes calldata data) external;
    function getOutcomeWithTime(bytes32 marketId)
        external view
        returns (bool resolved, bool outcome, uint64 terminationTime);
    function adjudicatorClass() external pure returns (bytes32);
}
```

### 13.2 Settlement Sink Interface
```solidity
interface ISettlementSink {
    function registerAccountingBatch(
        bytes32 marketId,
        uint64 terminationTime,
        bool outcome,
        bytes32 accountsRoot,
        uint64 endBlock
    ) external;
}
```

### 13.3 System Architecture Diagram
```text
                          ADJUDICATION LAYER
 ┌───────────────────────────────────────────────────────────────────────┐
 │ UMA | Reality.eth | Chainlink | Chainlink+ZK | ZK Rules | Attestation │
 └──────────────▲────────────────────────────────────────────────────────┘
                │ (outcome, T*)
                ▼
          ┌──────────────┐
          │    vAMM      │
          │    LMSR      │
          └──────┬───────┘
                 │ virtual liquidity
                 ▼
     ┌──────────────────────────────────────────┐
     │ Singleton Vault (chain, adjudicatorClass)│
     └──────────────────────────────────────────┘
                 ▲
                 │ PnL settlement
                 │
        SETTLEMENT ACCOUNTING (ZK-COPROCESSOR)
 ┌────────────────────────────────────────────────────────┐
 │ Offchain Settlement Program                            │
 │  - reads trades, Smart Accounts, T*                    │
 │  - computes deltaPnl                                   │
 │  - outputs accountsRoot + proof                        │
 └────────────────────────────────────────────────────────┘
```

### 13.4 SoothMarket Trade Interface
```solidity
interface ISoothMarket {
    function marketId() external view returns (uint256);
    function ammState() external view returns (int256 qYes, int256 qNo);
    function trade(
        uint8 outcomeIndex,
        int256 deltaShares,
        int256 maxCost
    ) external;
}
```

The `maxCost` parameter enforces on-chain slippage bounds for both buys (positive `deltaShares`) and sells (negative `deltaShares`). Front-ends should pair this with `SoothLMSRReal.costDelta(...)` and `SoothRiskManager.getBForMarket(...)` when preparing user intents.

---

## 14. Conclusion
Sooth Protocol advances the state of the art in information markets. It marries the institutional rigor of traditional exchanges with the innovation of Web3.

By replacing fixed expirations with **Infinite-End Markets**, and fragmented pools with **Singleton Vaults**, Sooth ensures that markets remain liquid and information-rich from inception until resolution. Its integration of **Retroactive ZK Settlement** specifically targets the "Free Option" vulnerability, creating the first AMM design that is fundamentally resistant to latency arbitrage. With Sooth, we move toward a future where prediction markets are reliable, widely used instruments for global risk management.
