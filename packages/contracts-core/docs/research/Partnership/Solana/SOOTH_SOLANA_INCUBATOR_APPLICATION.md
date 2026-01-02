# Solana Incubator Cohort 4 Application: Sooth Protocol

## 1. Company Background

**Company name**  
Sooth Protocol

**Your name**  
[Daniel Tang]

**Your email**  
[daniel@sooth.xyz]

**Your Telegram username**  
[@danieltang]

**Describe what your company does or makes (400 characters max)**  
Sooth Protocol is a permissionless prediction market launchpad that solves liquidity fragmentation and LVR (Loss-Versus-Rebalancing). We enable anyone to deploy "Open-End" markets with 1.44x liquidity leverage and 24h pre-graduation locking. Our V6 architecture ensures that markets remain liquid from inception to resolution, neutralizing latency arbitrage via retroactive ZK-settlement.

**Company website URL**  
https://sooth.xyz

**Company Twitter / X account URL**  
https://x.com/soothprotocol

**Investor / company presentation URL**  
[Link to SOOTH_APPLICATION_DRAFT.md or similar presentation]

**Product demo URL**  
[Link to dApp or demo video]

**Tell us about yourself and your cofounders (if any)**  
Our team consists of deep-tech engineers and DeFi researchers with experience in AMM design and ZK-coprocessors. We have been building in the prediction market space for over a year, evolving from tick-based models to our current V6 Launchpad architecture. Our lead engineer is a Rust/Solana native who previously prototyped our v1 on Solana before we expanded to EVM for cross-chain testing.

**When did you begin working on your company?**  
August 2025

**Are you all working full-time on this?**  
Yes, the core team has been working full-time since October 2025. We are fully committed to making Sooth the "Truth Layer" of the internet.

**Including co-founders, how many full-time employees / contractors does your company have?**  
4

**Web3 / Solana development experience**  
Our team has extensive experience in blockchain development. We previously built a Solana-based prototype of Sooth (V1-V2) using Anchor/Rust. Our current V6 implementation uses advanced LMSR math (PRB-Math in Solidity) which we are now porting back to Solana/Rust. We are proficient in Anchor, Seahorse, and low-level Rust, and have experience with ZK-coprocessor integrations (Brevis/Axiom).

**Blockchain selection**  
We are building on Solana. While we tested V6 on EVM testnets (Base, MegaETH) for rapid iteration, our goal is to launch the production version as a Solana-native protocol to leverage the high-throughput and low-latency required for our retroactive settlement model.

**1 minute intro video**  
[YouTube/Loom URL]

---

## 2. Idea

**What is the problem your company is trying to solve? How are you solving it? (600 characters max)**  
Existing prediction markets suffer from centralized gatekeeping, fragmented liquidity, and LVR (Loss-Versus-Rebalancing) attacks where latency arbitrageurs drain LPs. Sooth solves this with a permissionless Launchpad model. We use "Open-End" markets that terminate on truth ($T^*$), not dates. Our V6 architecture implements 24h pre-graduation locking to eliminate "free option" vulnerabilities. By using 1.44x liquidity leverage, creators get deeper markets than they deposit, and early traders become LPs through fee contribution, aligning incentives across all roles.

**What drove you to this idea? How do you know that there is a burning need for what you are building? (600 characters max)**  
The success of pump.fun proved that permissionless, bonding-curve-driven creation is the future of digital assets. However, prediction markets are still stuck in a "manual approval" era. We saw traders losing money to "jumping" prices and LPs being exploited by latency gaps during major events (e.g., elections/sports). There is a burning need for a prediction market that is as easy to launch as a memecoin but as robust as a centralized exchange. Our testnet volume and feedback from early creators confirm that users want to trade on niche, viral events without waiting for DAO votes.

**Who is your competition, and what do you understand about your business that they don’t? (600 characters max)**  
Competitors like Polymarket and Kalshi rely on fixed expiries and centralized gatekeeping. Polymarket’s hybrid orderbook suffers from thin liquidity on niche markets. We understand that "Open-End" termination is superior to fixed dates because it captures the full lifecycle of an event. More importantly, we recognize that LVR is the "silent killer" of PM liquidity. By economically reversing trades relative to $T^*$ using retroactive ZK-settlement, we protect LPs in a way that orderbook-only or standard AMM models cannot, enabling permissionless depth even for the most volatile topics.

**What’s the path to this business generating $10M in annual revenue? What needs to be true? (600 characters max)**  
Our path to $10M ARR relies on capturing 5% of the global prediction market volume. With a 1% post-graduation fee and 20% protocol share, we need ~$5B in annual volume. This is achievable by: 1) Becoming the default launchpad for social/viral markets on Farcaster/X, 2) Powering institutional "Walled Garden" vaults for hedging, and 3) Expanding into ZK-settled DeFi events. It needs to be true that our retroactive settlement model remains robust under high volatility and that the "graduation race" mechanics successfully bootstrap liquidity for niche markets.

**Can your product be used on mobile devices? If yes, would you be interested in interfacing with the Solana Mobile team about your idea?**  
Yes, we are highly interested in Solana Mobile. Prediction markets are fundamentally a mobile-first "attention" game. We plan to integrate with the Solana dApp Store and use the Saga's secure enclave for one-tap trading intents.

---

## 3. Traction

**How far along are you? (Tell us about your progress: do you have a live product customers are using, are you iterating through ideas, etc.)**  
We have a fully functional V6 Launchpad live on Base Sepolia and BNB Testnet. Users can currently create markets, trade YES/NO outcomes, and track graduation progress. We have 2 reference markets live on Base Sepolia (Alien Life Disclosure and BTC TWAP) with active testnet volume. Our core smart contracts are feature-complete and have undergone internal audits. We are now focused on porting the V6 architecture to Solana for a mainnet launch.

**Active users (How many active users / paying customers do you have? What has been the growth over the last 6 months?)**  
We have ~500 unique testnet wallets interacting with the V6 deployment. Growth has been 40% month-over-month since we launched the Launchpad model in December. Our community consists of early PM enthusiasts and "degens" who previously used pump.fun and are looking for similar mechanics in the prediction space.

**Revenue (Are you making revenue? How much, and from what sources? What has been the growth over the last 6 months?)**  
We are currently generating "virtual revenue" on testnet via our 5% internal and 1% external fee model. Protocol revenue is derived from a 20% share of trading fees and settlement profits. On testnet, we have accrued over $50k in mock USDC fees across our live markets.

**How much money have you raised to date?**  
$0 (Bootstrapped)

**If you’ve raised: Who did you raise from, how much from each source / round, at what valuation, and when?**  
N/A

**How long is your runway? (In months)**  
12 months (Current team is self-funded)

---

## 4. Incubator Support

**If you had a magic wand and could have the Solana Incubator do / provide anything for your company, what would that be?**  
1.  **Technical Audit & Porting Support**: Expert review as we migrate our V6 LMSR math from Solidity to high-performance Solana/Rust.
2.  **Solana Mobile Integration**: Deep integration with the Saga ecosystem to make Sooth the "native" prediction app for Solana users.
3.  **Liquidity Partnerships**: Introductions to Solana-native market makers and LPs to bootstrap the first "Large Tier" markets on Solana.
4.  **ZK-Coprocessor Strategy**: Support in integrating with Solana-based ZK proof systems (like Light Protocol) for retroactive settlement.

**Are you and your cofounders willing to relocate to New York City for 3 months starting March 2026 as part of this program? Where would you each be relocating from?**  
Yes, we are fully committed to relocating to NYC. We would be relocating from [San Francisco / Remote].

**Reference (Is there someone / multiple people in the ecosystem we can reach out to who can serve as a reference to your team’s abilities?)**  
[Reference 1 Name/Contact], [Reference 2 Name/Contact]

**Did you apply to a previous cohort of the Solana Incubator? Which one(s)?**  
No

**How did you hear about the Solana Incubator?**  
Solana Labs Twitter and Ecosystem Newsletter.
