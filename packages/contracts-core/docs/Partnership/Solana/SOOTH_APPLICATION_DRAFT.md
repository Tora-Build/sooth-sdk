# Sooth Protocol: Ecosystem Application Draft

## 1. Project Information
**Project Name:** Sooth Protocol  
**Category:** DeFi / Prediction Markets / Infrastructure  
**Website:** [sooth.xyz](https://sooth.xyz) (Placeholder)  
**GitHub:** [github.com/sooth-protocol/sooth-alpha](https://github.com/sooth-protocol/sooth-alpha)  
**Deployment Status:** Live on Base Sepolia (Chain 84532)

---

## 2. Executive Summary
Sooth Protocol is a decentralized prediction market platform that introduces the **Launchpad Model** for permissionless, truth-terminated prediction markets. By combining the viral mechanics of bonding curve launchpads (like pump.fun) with institutional-grade risk management (LMSR AMM + ZK Settlement), Sooth enables anyone to create a liquid market for any verifiable event.

Our V6 architecture features **Pre-Graduation Locking** to eliminate "free option" vulnerabilities and **1.44x Liquidity Leverage**, allowing creators to provide deep liquidity depth with minimal capital.

---

## 3. The Problem
Existing prediction markets (e.g., Polymarket) suffer from:
1.  **Centralized Gatekeeping**: Listing a new market often requires manual approval or a DAO vote.
2.  **Liquidity Fragmentation**: Each market has an isolated pool, leading to high slippage.
3.  **LVR Vulnerability**: Latency arbitrage (the "free option") drains liquidity providers during the time between an event occurring and the oracle updating.
4.  **Rigid Expirations**: Fixed end dates often lead to unresolved or stale markets if events are delayed.

---

## 4. The Sooth Solution
Sooth addresses these issues through a novel architectural stack:
*   **Permissionless Launchpad**: Anyone can deploy a market by selecting a liquidity tier and depositing USDC.
*   **Open-End Markets**: Markets remain live until truth is established, not until a calendar date.
*   **V6 Pre-Graduation Locking**: All sell proceeds are locked for 24 hours during the "bonding" phase. This prevents latency arbitrage and "hit-and-run" profit extraction, protecting creators and LPs.
*   **1.44x Liquidity Leverage**: Creators deposit $b \times \ln(2)$, providing significantly more liquidity depth ($b$) than they deposit, incentivizing market creation.
*   **Retroactive ZK Settlement**: Uses $T^*$ (Truth Time) to economically reverse trades executed after an event occurred, fundamentally neutralizing LVR.

---

## 5. Technical Architecture
*   **Dual-Venue Execution**: Markets start in an AMM-only "Internal Phase" (5% fee) to grow liquidity, then graduate to a "Graduated Phase" (1% fee) where a full orderbook is activated.
*   **LMSR Engine**: Continuous Logarithmic Market Scoring Rule (LMSR) using PRB-Math for deterministic, slippage-protected pricing.
*   **Singleton Infrastructure**: `TraderVault` and `SoothLiquidityVault` manage cross-margining and global locked proceeds tracking.
*   **Modular Adjudication**: Pluggable interface for UMA, Chainlink, or ZK-proven data sources.

---

## 6. Current Progress & Traction
*   **Base Sepolia V6**: Full Launchpad suite deployed including `LaunchpadFactory`, `ProtocolConfig`, and `LaunchpadMarket`.
*   **Live Markets**: 
    *   *Alien Life Disclosure* (0x69b073...): Tier 1 ($1k liquidity)
    *   *BTC 7-day TWAP* (0x3A5E8...): Tier 2 ($10k liquidity)
*   **Frontend**: Production-ready dApp with inline trading, graduation progress bars, and creator dashboards.
*   **Multi-Chain Support**: Deployed on BNB Testnet and MegaETH Testnet.

---

## 7. Vision & Roadmap
Our goal is to become the **Truth Layer of the Internet**.
*   **Q1 2026**: Mainnet launch on Base.
*   **Q2 2026**: Integration with ZK-Coprocessors (Brevis/Axiom) for trustless settlement of DeFi events.
*   **Q3 2026**: Institutional "Walled Garden" vaults with ZK-KYC compliance hooks.

---

## 8. Why Base?
Base is the ideal home for Sooth due to its:
1.  **Low Latency & Fees**: Essential for high-frequency prediction trading.
2.  **Ecosystem Synergy**: Deep USDC liquidity and proximity to Farcaster for social market discovery.
3.  **Developer Experience**: Robust tooling that aligns with our vision for high-speed, verifiable infrastructure.

---

**Contact Info:**  
[Project Lead Name]  
[Telegram/Discord Handle]  
[Email]
