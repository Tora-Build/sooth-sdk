# Meeting Prep: Sooth Protocol x Brevis Support

## 1. Sooth Protocol: The Elevator Pitch
**Sooth Protocol** is the first "Open-End" prediction market, designed to eliminate standard liquidity fragmentation and LP toxicity issues. Unlike traditional markets with fixed expiration dates, Sooth markets utilize unified **Singleton Liquidity Vaults** and remain continuously open until an event occurs. To protect Liquidity Providers from latency arbitrage (LVR), Sooth employs **Retroactive Finality**: a mechanism that allows trading to continue seamlessly, but uses ZK proofs to economically "rewind" any trades that occurred after the true event timestamp. This guarantees a fair, trustless, and highly liquid trading environment.

## 2. Telegram Introduction Message
*Context: You are introducing Sooth to the Brevis founder. Goal is to secure a technical partnership meeting.*

**Draft:**

> "Hi [Name], working on **Sooth Protocol** – a prediction market using a "Retroactive Settlement" model to prevent LVR (latency arbitrage).
>
> We're looking for a ZK Coprocessor to handle two key functions:
> 1.  **Trustless Settlement**: Reading historical logs to "rewind" trades off-chain.
> 2.  **ZK Adjudication**: Proving on-chain events for automatic market resolution.
>
> Brevis seems like the right architecture for this. Would love to sync on technical feasibility and see if we can build this on your stack. Are you free next week?"

---

## 3. Meeting Talking Points

### A. The "Sooth" Context (The Problem)
*   **Problem 1: Latency Arbitrage (LVR)**. Bots trade against stale prices before oracles update.
*   **Problem 2: Oracle Centralization**. Prediction markets rely on subjective committees (UMA, Kleros) which are slow and can be bribed.

### B. The "Brevis" Fit (The Solution)

#### Use Case 1: Settlement Engine (The "Rewind")
*   **Concept**: When an event happens at time $T$, we economically "rewind" the market state.
*   **Brevis Role**:
    1.  Read historical `TradeExecuted` logs.
    2.  Filter out trades $> T$.
    3.  Compute net PnL and post a ZK Proof of user balances.
*   **Why Brevis**: We need trustless access to *historical* chain data. Only a ZK Coprocessor can do this cheaply.

#### Use Case 2: ZK Adjudicator (The "Truth")
*   **Concept**: Markets should resolve *deterministically* based on on-chain facts, using Brevis as a "Trustless Adjudicator". We define two types:

    **Type A: ZK-Rule (Internal State)**
    *   **Logic**: Proves a condition based purely on raw storage slots / logs.
    *   **Example**: "Did the Aave Lending Pool emit a `Paused` event?" or "Did this wallet address send > 100 ETH?"
    *   **Brevis Role**: Direct read of historical chain state $\to$ ZK Proof.

    **Type B: ZK-Oracle (Computed Logic)**
    *   **Logic**: Aggregates data feeds (e.g., Chainlink) to prove a complex derivative fact.
    *   **Example**: "Was the Time-Weighted Average Price (TWAP) of ETH > $3000 over the last 7 days?"
    *   **Brevis Role**: Ingests 100s of Chainlink updates $\to$ Computes TWAP off-chain $\to$ Proves result. This replaces expensive on-chain TWAP oracles.

*   **Value**: This creates **"Instant Verification" markets**. No 2-hour challenge period. Result is proven mathematically.

### C. Technical Asks / Next Steps
*   **Feasibility Check**:
    *   "Can Brevis efficiently ingest ~100k events for a single proof generation?"
    *   "What is the latency for proof generation? (Our settlement is asynchronous, so 10-20 mins is fine)."
*   **Integration Support**:
    *   "Does the Brevis SDK support bespoke logic (custom circuits) or is it generic queries?"
    *   "Is there a grant program or potential for a pilot implementation?"

### D. Backup Synergies
*   **ZK Adjudication**: Using Brevis to prove "Event X happened on Chain Y" (e.g., A lending protocol paused, or a wallet balance crossed a threshold) to resolve markets automatically.
*   **Compliance**: Using Brevis to analyze a user's *historical* wallet activity for "Risk Scoring" before allowing them into KYC'd Institutional Vaults.
