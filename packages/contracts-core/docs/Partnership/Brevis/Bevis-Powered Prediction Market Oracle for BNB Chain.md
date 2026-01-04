# **Brevis-Powered Prediction Market Oracle for BNB Chain**

### **Submitted by: Brevis** 

### **Contact: Michael Dong, Founder & CEO, [mdong@brevis.network](mailto:mdong@brevis.network), [t.me/no89thkey](http://t.me/no89thkey)**

### **X: [https://x.com/brevis\_zk](https://x.com/brevis_zk)**

## **1\. Introduction**

Prediction markets thrive on one foundation: **credible, verifiable, and timely data resolution of diverse and complex data**. Yet existing oracles were never designed for this level of flexibility. They are optimized for standardized feeds (like asset prices) but fall short when markets depend on complex, bespoke, or hybrid data such as on-chain behavioral metrics or off-chain real-world events.

Brevis proposes a **next-generation, ZK-powered oracle architecture** that combines the scalability of optimistic designs with the **mathematical certainty of zero-knowledge proofs (ZKPs)**. This oracle will enable BNB Chain prediction markets to resolve any event (on-chain or off-chain) trust-freely, instantly verifiable on-chain, and at a fraction of the cost.

## **2\. Challenges with Existing Oracles**

### **Always-On Cost and Latency**

Traditional oracles such as Chainlink or Band require continuous data feeds, regardless of whether markets are actively consuming them. This “always-on” model is both expensive and inefficient. Each data update incurs validator consensus and gas overhead, resulting in significant latency and cost for event settlement.

### **Limited Data Types**

Existing oracles mainly support **structured, standardized data** like price feeds, averages, and volatility metrics. They cannot easily handle **derived, contextual, or historical** data, even when that data already lives fully on-chain. For instance:

* *“What was PancakeSwap’s total trading volume last week?”*

* *“How many new tokens launched on BNB Chain in the past 30 days?”*

Even though these are verifiable on-chain facts, there is currently no practical way for a smart contract to access and prove them without a centralized indexer or oracle operator.

### **Off-Chain Data Trust Problem**

For subjective or off-chain events such as “Binance listed XYZ token” or “CPI data released at 3.1%”, current oracle systems rely on **human-driven validators** to attest to web content or official announcements. This introduces subjectivity, attack surfaces, and complex dispute resolution layers.

## **3\. Brevis-Powered Trust-free Oracle Architecture**

Our proposed solution for BNB Chain prediction markets is an on-demand **oracle** powered by **Brevis**’s product suite: Brevis ZK Data Coprocessor, ZKTLS Coprocessor, and Pico ZKVM. Together, these components form a unified oracle framework capable of **verifying any computation or data source, on-chain or off-chain,  directly within smart contracts**.

### **On-Chain Data Oracle: Verifiable Historical & Derived Data**

For all on-chain data, off-chain **validators are FUNDAMENTALLY unnecessary**. The data already exists publicly on BNB Chain or other blockchains. The problem is *visibility and computation cost*. Though unintuitive, smart contracts cannot natively query historical or aggregated on-chain data due to storage and computation gas limits.

Brevis solves this with its **ZK Data Coprocessor \+ Pico ZKVM**, which attest to and execute arbitrary computations over on-chain states and generates **cryptographic proofs** that:

* The computation inputs are derived from authentic on-chain data.  
* The computation itself was done correctly.

The verification cost on BNB Chain or really any chain is minimal (constant gas), and the proofs are fully **trust-free**.

**Example: PancakeSwap Volume Oracle**  
Brevis currently powers PancakeSwap Infinity’s dynamic trading fee plugin by generating ZK proofs of individual trading volumes and fee tiers. This same mechanism can directly resolve **prediction markets** tied to on-chain metrics. E.g., “Will PancakeSwap reach $X trading volume this week?” or “How many unique traders will interact with Pool Y?”

Because the proof comes from on-chain data, **no human resolution or validator quorum is required**.

Brevis’s on-chain data engine is already live with major partners including **PancakeSwap, MetaMask, Linea, Usual, OpenEden**, and others, demonstrating scalability across diverse workloads.

### **Off-Chain Public Data Oracle: zkTLS-Verified Web Evidence**

For external events, Brevis introduces the **zkTLS Coprocessor \+ Pico ZKVM solution**, which proves that data fetched from a web source (e.g., `https://www.census.gov/` for CPI) is:

* **Authentic:** fetched through a genuine TLS session from the target domain.

* **Untampered:** cryptographically proven identical to the original source content.

* **Interpretable:** processed by a zkVM to extract relevant data (e.g., CPI \= 3.1%).

This enables on-chain smart contracts to trust results **mathematically, not socially**. No multi-party vote, dispute, or subjective judgment is required unless the source itself becomes unavailable.

**Example:**  
When a CPI release webpage is published, Brevis zkTLS fetches and proves the page authenticity. Pico zkVM then parses the HTML or JSON to extract the numeric CPI value. The proof of both the fetch and computation is verified on-chain, delivering a **trustless, single-step resolution** for prediction markets dependent on real-world data.

### **Off-Chain Private Data Oracle: Zero-Knowledge Computation Proofs**

For prediction markets relying on **private algorithms or confidential datasets**, Brevis provides a ZK-based solution that ensures **verifiable execution without disclosure**. There is fundamentally no other solution that can do this. 

**Example: Kaito Mindshare Prediction Market**

**We are currently working on this with Kaito now.** 

Kaito computes project “mindshare” using proprietary algorithms and private data sources. Polymarket is implementing a new type of market for traders to trade mindshares. However, traditional oracles cannot validate such outcomes since validators would need to access internal and confidential logic. Traders will obviously be hesitant to rely on Kaito themselves due to potential conflict of interests. 

With Brevis, Kaito can commit the hash (verifier key) of their algorithm and data sources on-chain. When publishing mindshare scores, Kaito also submits a ZK proof showing that:

* The result was generated from the committed algorithm.

* No manual changes or external tampering occurred.

This allows prediction markets to confidently trade on such metrics while preserving full privacy and verifiability. This is widely applicable for many use cases such as prediction markets involving Binance internal data and metrics. 

## **4\. Performance, Scalability, and Security**

All proofs are generated off-chain using **Brevis Pico zkVM**, which is benchmarked as one of the **fastest single-GPU proving systems** capable of 99.6% real-time Ethereum block proofs. This ensures scalability even at peak market loads. On-chain cost is minimal as we have proven in our numerous adoption use cases. 

## **5\. Developer Integration & Composability**

* **Vendor-Neutral API & SDKs:** Brevis offers a uniformed API for on-chain result resolution. 

* **Composable Oracle Framework:** Developers can select from:

  * ZK Data Coprocessor (for historical/derived on-chain data)

  * zkTLS Coprocessor (for verifiable web data)

  * ZKVM for computation on top of any data

* **Hybrid Controller:** A routing layer automatically determines the appropriate resolution path per market type.

This aligns directly with the RFP’s requirement for a **hybrid architecture and vendor-neutral API**.

## **6\. Benefits & Alignment with RFP Objectives**

| BNB Chain Objective | Brevis Solution |
| ----- | ----- |
| **Reduce cost & latency** | On-demand ZK computation avoids always-on oracle costs; optimistic fast path with fallback proofs. |
| **Ensure trusted provenance** | zkTLS \+ ZK Data Coprocessor guarantee mathematical authenticity of both on-chain and off-chain sources. |
| **Maintain market integrity** | End-to-end cryptographic verifiability eliminates human bias and collusion risk. |
| **Scalable & decentralized** | Proof generation decentralized across Brevis provers; on-chain verification lightweight. |
| **Rapid product iteration** | Plug-and-play SDK and programmable oracle templates for custom market creation. |

## **7\. Deployment & Next Steps**

The Brevis-powered oracle transforms BNB Chain into the **home of programmable, verifiable prediction markets,** capable of resolving any event, any data, from any source, with cryptographic certainty and minimal cost.

We are excited to collaborate with the BNB Chain team to deploy this system natively on **BSC and opBNB**, making them the first blockchains with **fully ZK-verifiable prediction oracles**.

