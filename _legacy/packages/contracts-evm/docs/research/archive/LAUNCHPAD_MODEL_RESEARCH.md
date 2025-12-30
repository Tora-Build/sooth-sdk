# Prediction Market Launchpad Model Research

**Date:** 2025-12-14  
**Status:** Primary Research  
**Author:** DeFi Research Agent  

---

## Executive Summary

This document explores a fundamental architectural pivot for Sooth Protocol: from a **centralized LP pool model** (global GovernorVault) to a **permissionless launchpad model** inspired by pump.fun. The goal is to enable anyone to create prediction markets with standardized configurations, bootstrap liquidity through trading fees, and reward early participants as both traders and LPs.

### Key Innovations Proposed
1. **Per-Market Governor** — Lightweight, self-contained liquidity per market
2. **Internal Market Phase** — Early traders earn LP rewards proportional to fee contribution
3. **Graduation Mechanism** — Market "graduates" when liquidity threshold reached
4. **Fee-Only Liquidity Growth** — Post-graduation, no external LP needed
5. **Adjudicator Marketplace** — Creators choose from verified adjudicators
6. **Open-End vs Fixed-End Choice** — Creator decides expiration model

---

## 1. Prior Art Analysis

### 1.1 pump.fun (Solana Memecoins)

**Model:**
- Anyone creates token with bonding curve
- Price = `n² / 16000` (supply-based)
- Graduation at ~$69k market cap
- Migrates to Raydium DEX (now PumpSwap)
- LP tokens burned (liquidity locked forever)

**Key Learnings:**
| Feature | Application to Sooth |
|---------|---------------------|
| Permissionless creation | ✅ Anyone creates markets |
| Bonding curve bootstrap | ✅ LMSR already a bonding curve |
| Graduation threshold | ✅ `maxLoss` or liquidity cap |
| LP lock on graduation | ⚠️ Consider for creator alignment |
| Fee-free migration | ✅ Orderbook activation = "migration" |

**What pump.fun doesn't do:**
- No oracle/settlement mechanism
- No outcome tokens (just price speculation)
- No LP rewards for early traders

---

### 1.2 friend.tech (Social Tokens)

**Model:**
- Users issue "keys" on bonding curve
- Price = `n² / 16000` (same as pump.fun)
- 10% transaction fee (5% creator, 5% protocol)
- Points system for early users → airdrop

**Key Learnings:**
| Feature | Application to Sooth |
|---------|---------------------|
| Early user points | ✅ Fee contribution = LP shares |
| Revenue share to creator | ✅ Creator fee split |
| Continuous fee stream | ✅ Post-graduation fee accrual |
| Points → token airdrop | ⚠️ Consider for governance |

**Sustainability Concern:**
friend.tech saw 95%+ activity decline after initial hype. Key lesson: **fee-only models need real utility, not just speculation.**

---

### 1.3 Polymarket + UMA Oracle

**Model:**
- Optimistic oracle (propose → challenge → vote)
- Whitelist of experienced proposers (MOOV2)
- Disputes resolved by UMA token holders

**Key Learnings:**
| Feature | Application to Sooth |
|---------|---------------------|
| Oracle separation | ✅ Adjudicator as separate module |
| Whitelist proposers | ⚠️ Verified adjudicator registry |
| Dispute mechanism | ✅ Staking + slashing for adjudicators |
| Governance attack risk | ⚠️ Avoid pure token voting |

**Vulnerability:**
March 2025 attack showed large token holders can manipulate outcomes. Sooth should consider **reputation-weighted** or **multi-sig adjudicators** rather than pure token voting.

---

### 1.4 Zeitgeist (Polkadot Prediction Markets)

**Model:**
- Permissionless creation with 1000 ZTG bond
- Creator provides initial liquidity
- DLMSR-based AMM (dynamic liquidity)
- Retroactive review for harmful markets

**Key Learnings:**
| Feature | Application to Sooth |
|---------|---------------------|
| Creation bond | ✅ Skin in the game for creators |
| Creator-provided liquidity | ❌ We want fee-bootstrapped |
| DLMSR | ✅ Already using continuous LMSR |
| Retroactive review | ⚠️ Consider for adjudicator disputes |

---

## 2. Proposed Architecture: Sooth Launchpad

### 2.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MARKET LIFECYCLE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   [CREATE]          [INTERNAL]           [GRADUATE]      [SETTLED]  │
│      │                   │                    │              │      │
│   Creator            Traders              Orderbook       Payout    │
│   deploys            trade AMM            activates       claims    │
│   market             earn LP%             liquidity                 │
│                      via fees             locked                    │
│                                                                      │
│   bBase = config     b grows via          b = final       funds     │
│   maxLoss = config   fee accrual          no external LP  released  │
│   adjudicator set    proceeds locked      OB fees split             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Market States

```solidity
enum MarketState {
    Internal,    // AMM-only, early traders earn LP shares
    Graduated,   // Orderbook active, no new LP deposits
    Settled,     // Outcome resolved, claims open
    Expired      // Time-locked expiration (optional)
}
```

---

## 3. Configuration Parameters

### 3.1 Fixed at Creation (Immutable)

| Parameter | Example | Description |
|-----------|---------|-------------|
| `bBase` | 1000 USDC | Initial liquidity depth |
| `maxLoss` | 693 USDC | Maximum LP exposure (`bBase × ln(2)`) |
| `internalFeeBps` | 500 (5%) | AMM fee during Internal phase |
| `externalFeeBps` | 200 (2%) | AMM fee after Graduation |
| `orderbookFeeBps` | 100 (1%) | Orderbook fee (post-graduation) |
| `graduationThreshold` | 10,000 USDC | Cumulative fee accrual to graduate |
| `adjudicator` | address | Contract or EOA for resolution |
| `question` | string | Market question hash |
| `outcomes` | string[] | Outcome labels |
| `isOpenEnd` | bool | True = no expiration, False = fixed end |
| `expiration` | uint256 | Unix timestamp (if fixed-end) |

### 3.2 Dynamic During Lifecycle

| Parameter | Formula | Notes |
|-----------|---------|-------|
| `b` | `bBase + reserves × reserveFactor` | Grows with fees |
| `reserves` | `Σ fees - Σ payouts` | Net LP P&L |
| `lpShares[user]` | Proportional to fee contribution | Internal phase only |
| `totalLpShares` | `Σ lpShares` | Denominator for payouts |

---

## 4. Internal Market Phase

### 4.1 Fee-as-LP Mechanism

During the Internal phase, every trade fee contributes to:
1. **Market liquidity** (`reserves ↑ → b ↑`)
2. **Trader's LP share** (proportional to fee paid)

```solidity
function _recordFeeContribution(address trader, uint256 feeAmount) internal {
    uint256 newShares = feeAmount; // 1:1 for simplicity (or weighted)
    lpShares[trader] += newShares;
    totalLpShares += newShares;
}
```

**Example:**
- Alice trades, pays 50 USDC fee → earns 50 LP shares
- Bob trades, pays 100 USDC fee → earns 100 LP shares
- Total LP shares: 150
- Alice's LP ownership: 50/150 = 33.3%
- Bob's LP ownership: 100/150 = 66.7%

### 4.2 Proceeds Lock (GameFi Element)

To prevent hit-and-run (trade → immediate profit extraction):

| Action | Consequence |
|--------|-------------|
| BUY | Shares credited immediately |
| SELL | Proceeds locked until Graduation or Settlement |

This aligns trader incentives with market success:
- If market graduates, they get USDC + LP share
- If market fails (no graduation), proceeds may be forfeited or time-unlocked

**Optional Twist:** Proceeds could be converted to LP shares instead of locked USDC, forcing even deeper alignment.

### 4.3 Why No Orderbook in Internal Phase?

| Reason | Explanation |
|--------|-------------|
| Liquidity fragmentation | OB competes with AMM for thin liquidity |
| LP share fairness | Hard to attribute "fee contribution" from OB matches |
| Graduation incentive | OB is the reward for reaching threshold |
| MEV reduction | Simpler attack surface during bootstrap |

---

## 5. Graduation Mechanism

### 5.1 Trigger Conditions

```solidity
function canGraduate() public view returns (bool) {
    return reserves >= graduationThreshold && state == MarketState.Internal;
}

function graduate() external {
    require(canGraduate(), "Not ready");
    state = MarketState.Graduated;
    orderbookEnabled = true;
    
    // Lock liquidity permanently (pump.fun style)
    liquidityLocked = true;
    
    emit MarketGraduated(address(this), reserves, totalLpShares);
}
```

### 5.2 What Changes at Graduation

| Before (Internal) | After (Graduated) |
|-------------------|-------------------|
| AMM only | AMM + Orderbook |
| 5% fee | 2% fee (example) |
| Trades earn LP shares | Trades don't earn LP |
| Proceeds locked | Proceeds flow normally |
| No LP withdrawal | LP can claim post-settlement |

### 5.3 LP Share Finalization

At graduation, LP share allocation is **frozen**:

```solidity
mapping(address => uint256) public finalLpShares; // snapshot at graduation

function graduate() external {
    // ... graduation logic ...
    
    // Snapshot LP shares
    for each contributor:
        finalLpShares[contributor] = lpShares[contributor];
}
```

Post-graduation, `lpShares` mapping is no longer updated.

---

## 6. Post-Graduation Liquidity Model

### 6.1 Fee Distribution

```
                    ┌────────────────┐
                    │   Trade Fee    │
                    │   (2% AMM)     │
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌─────────┐   ┌─────────┐   ┌─────────┐
        │   LP    │   │ Creator │   │Protocol │
        │  (60%)  │   │  (20%)  │   │  (20%)  │
        └─────────┘   └─────────┘   └─────────┘
```

**LP Share:**
- Accrues to `reserves`, increasing `b`
- On settlement, distributed pro-rata to LP shareholders

**Creator Share:**
- Immediate transfer or vesting
- Incentivizes question quality and marketing

**Protocol Share:**
- Treasury for development/governance
- Could be burned or redistributed

### 6.2 No New LP Deposits

This is the key innovation:

```solidity
function deposit() external {
    require(state == MarketState.Internal, "LP closed after graduation");
    // ... deposit logic for Internal phase ...
}
```

After graduation:
- Liquidity grows **only** from trading fees
- No external capital injection needed
- Market is self-sustaining or dies

---

## 7. Settlement & Payout

### 7.1 Adjudicator Flow

```
┌──────────┐     ┌─────────────┐     ┌────────────┐
│  Market  │────►│ Adjudicator │────►│ Settlement │
│ (waiting)│     │  (resolve)  │     │  (payout)  │
└──────────┘     └─────────────┘     └────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Outcome = 0 or 1│
              │ (or INVALID)    │
              └─────────────────┘
```

### 7.2 Payout Distribution

```solidity
function claim() external {
    require(state == MarketState.Settled, "Not settled");
    
    uint256 traderPayout = _calculateTraderPayout(msg.sender);
    uint256 lpPayout = _calculateLpPayout(msg.sender);
    
    _transfer(msg.sender, traderPayout + lpPayout);
}

function _calculateLpPayout(address user) internal view returns (uint256) {
    if (totalLpShares == 0) return 0;
    
    // LP gets share of final reserves (after trader payouts)
    uint256 lpPoolValue = finalReserves; // could be 0 or positive
    return (finalLpShares[user] * lpPoolValue) / totalLpShares;
}
```

### 7.3 LP P&L Scenarios

| Scenario | Reserves | LP Payout | Trader Payout |
|----------|----------|-----------|---------------|
| Market profitable | +5000 | 5000 pro-rata | Normal |
| Market breakeven | 0 | 0 | Normal |
| Market loss (limited) | -500 | 0 (LP absorbed loss) | Normal |

**Key:** LP's maximum loss is capped at `bBase` (initial liquidity).

---

## 8. Adjudicator Separation

### 8.1 Adjudicator Interface

```solidity
interface IAdjudicator {
    function resolve(bytes32 marketId) external returns (uint8 outcome);
    function canResolve(bytes32 marketId) external view returns (bool);
    function disputePeriod() external view returns (uint256);
}
```

### 8.2 Adjudicator Types

| Type | Description | Trust Model |
|------|-------------|-------------|
| **EOA** | Single address | Centralized, fast |
| **Multisig** | N-of-M signers | Semi-decentralized |
| **Optimistic Oracle** | Propose → dispute → vote | Decentralized, slow |
| **ZK Oracle (Brevis)** | On-chain proof of off-chain data | Trustless, limited scope |
| **AI Agent** | LLM-based resolution | Experimental |

### 8.3 Adjudicator Registry (Optional)

```solidity
contract AdjudicatorRegistry {
    struct Adjudicator {
        address addr;
        uint256 stake;
        uint256 successfulResolutions;
        uint256 disputes;
        bool verified;
    }
    
    mapping(address => Adjudicator) public adjudicators;
    
    function register(uint256 stakeAmount) external {
        // Stake tokens to become adjudicator
        // Slashed if disputes are upheld
    }
}
```

### 8.4 Creator Choice Matrix

| Creator Type | Recommended Adjudicator | Rationale |
|--------------|------------------------|-----------|
| First-time | Verified multisig | Safety, reputation |
| Power user | Own EOA or custom | Speed, control |
| DAO | On-chain governance | Decentralization |
| Sports/crypto | ZK oracle | Trustless, automatable |

---

## 9. Open-End vs Fixed-End Markets

### 9.1 Trade-offs

| Aspect | Open-End | Fixed-End |
|--------|----------|-----------|
| **Liquidity lock** | Until settlement (indefinite) | Until expiration |
| **Creator control** | Lower (can't force end) | Higher (auto-expire) |
| **Trader psychology** | Long-term holders | Event-driven traders |
| **Oracle timing** | Resolution whenever | Must resolve by expiry |
| **LP risk** | Exposure indefinite | Exposure bounded |

### 9.2 Hybrid Model

Allow creators to choose, with safeguards:

```solidity
struct MarketConfig {
    bool isOpenEnd;
    uint256 expiration;           // 0 if open-end
    uint256 maxDuration;          // Failsafe for open-end (e.g., 5 years)
    uint256 internalPhaseTimeout; // Auto-expire internal phase if no graduation
}
```

### 9.3 Internal Phase Expiration

For failed markets (never graduated):

```solidity
function expireInternalPhase() external {
    require(state == MarketState.Internal, "Not internal");
    require(block.timestamp > createdAt + internalPhaseTimeout, "Not expired");
    
    state = MarketState.Expired;
    
    // Release locked funds
    // Option A: Return to traders
    // Option B: Distribute to LP shareholders
    // Option C: Burn / send to treasury
}
```

**Recommendation:** Return to traders (locked proceeds) + creator (initial bond).

---

## 10. Orderbook Activation

### 10.1 Why Gate Orderbook on Graduation?

| Reason | Explanation |
|--------|-------------|
| **Liquidity depth** | OB needs sufficient `b` to avoid manipulation |
| **Fee structure** | OB fees can be lower post-graduation (established market) |
| **Reward isolation** | Internal phase LP rewards are AMM-only |
| **Complexity reduction** | Simpler UX during bootstrap |

### 10.2 Orderbook Fee Split (Post-Graduation)

```
                    ┌────────────────┐
                    │  Orderbook Fee │
                    │    (1% per)    │
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌─────────┐   ┌─────────┐   ┌─────────┐
        │   LP    │   │ Creator │   │Protocol │
        │  (50%)  │   │  (25%)  │   │  (25%)  │
        └─────────┘   └─────────┘   └─────────┘
```

---

## 11. Economic Analysis

### 11.1 Graduation Economics

**Example Market:**
- `bBase` = 1,000 USDC
- `internalFeeBps` = 500 (5%)
- `graduationThreshold` = 10,000 USDC fees

**To Graduate:**
```
Required trading volume = 10,000 / 0.05 = 200,000 USDC
```

**LP Share Distribution:**
- Early traders who paid 10,000 USDC in fees own 100% of LP
- Post-graduation fees accrue to their LP shares

### 11.2 Creator Incentives

| Phase | Creator Revenue |
|-------|-----------------|
| Internal | 0% (all fees → LP pool + liquidity) |
| Graduated | 20% of fees (example) |
| Settlement | Nothing (or % of LP pool if creator contributed) |

**Skin in the Game:**
Require creation bond (e.g., 100 USDC) that:
- Returns on graduation
- Forfeits on expiration without graduation
- Slashed if adjudicator disputes

### 11.3 LP Risk/Reward

| Scenario | LP Outcome |
|----------|------------|
| Market graduates + profitable | Fee contribution + share of reserves |
| Market graduates + unprofitable | Fee contribution - max(bBase) loss |
| Market expires (no graduation) | Forfeited (or partial return) |
| Settlement payout | Pro-rata of final reserves |

---

## 12. Security Considerations

### 12.1 Attack Vectors

| Attack | Mitigation |
|--------|------------|
| **Wash trading** | Fees are real cost; attacker loses money |
| **Front-running graduation** | Graduation is permissionless; no special benefit |
| **Adjudicator manipulation** | Staking + slashing + registry reputation |
| **Creator rug** | Bond forfeiture + no creator fee in Internal phase |
| **LP extraction** | LP locked until settlement; no withdrawals |

### 12.2 Invariants

```solidity
// Must always hold:
assert(reserves >= -bBase);                    // LP loss capped
assert(totalLpShares == sum(lpShares[*]));     // Share accounting
assert(state != Graduated || reserves >= graduationThreshold);
```

---

## 13. Open Questions

### 13.1 Design Decisions Needed

| Question | Options | Recommendation |
|----------|---------|----------------|
| LP share weighting | 1:1 with fees, or time-weighted? | 1:1 (simple) |
| Failed market funds | Return to traders, creator, or burn? | Return to traders |
| Creator fee in Internal | 0% or small % (e.g., 1%)? | 0% (max LP incentive) |
| Graduation trigger | Auto or manual? | Auto (anyone can call) |
| Multiple adjudicators | Single or committee? | Single (simplicity) |

### 13.2 Research Needed

1. **Optimal graduation threshold** — What fee accrual indicates "healthy" market?
2. **Internal phase timeout** — How long before auto-expire (30 days? 90 days?)
3. **Fee curve during Internal** — Fixed 5% or decreasing as `b` grows?
4. **Cross-chain deployment** — Same config or chain-specific parameters?

---

## 14. Implementation Roadmap

### Phase 1: Core Contracts
- [ ] `LaunchpadMarket.sol` — Per-market governor + AMM + LP tracking
- [ ] `LaunchpadFactory.sol` — Permissionless market creation
- [ ] `AdjudicatorRegistry.sol` — Optional adjudicator verification

### Phase 2: Graduation + Orderbook
- [ ] Orderbook integration (gated by `state == Graduated`)
- [ ] Fee split logic (LP / Creator / Protocol)
- [ ] Graduation event + snapshot

### Phase 3: Settlement + Payouts
- [ ] Adjudicator callback interface
- [ ] LP payout distribution
- [ ] Expired market cleanup

### Phase 4: UI/UX
- [ ] Market creation wizard
- [ ] LP share dashboard
- [ ] Adjudicator selection

---

## 15. Summary

The **Sooth Launchpad Model** transforms the protocol from a centralized LP pool into a permissionless prediction market factory where:

1. **Anyone creates markets** with standardized configs
2. **Early traders become LPs** through fee contribution
3. **Markets graduate** when liquidity threshold reached
4. **Post-graduation liquidity** grows only from trading fees
5. **Adjudicators are modular** — creator's choice
6. **Open-End or Fixed-End** — creator's choice

This model aligns incentives across creators, traders, and LPs while maintaining capital efficiency and reducing centralization risk.

---

## References

1. pump.fun — Bonding curve memecoin launchpad
2. friend.tech — Social token bonding curves + revenue share
3. Polymarket + UMA — Optimistic oracle separation
4. Zeitgeist — Permissionless prediction markets with creator bonds
5. Kash — Custom AMM bonding curves for prediction markets

---

## 16. Design Decisions (Updated 2025-12-14)

Based on stakeholder feedback, the following design decisions have been finalized:

### 16.1 Hybrid Permission Model (Morpho-Style)

Inspired by **Morpho Vault V2**, Sooth adopts a **permissionless + curated registry** model:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HYBRID PERMISSION MODEL                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   PERMISSIONLESS LAYER          CURATED REGISTRY LAYER              │
│   ─────────────────────         ──────────────────────              │
│   • Anyone creates markets      • Official adjudicator registry     │
│   • Anyone trades               • Verified market badges            │
│   • Anyone deploys adjudicator  • Featured markets (UI promotion)   │
│   • No approval needed          • Reputation scores                 │
│                                                                      │
│   [Wild West]                   [Trust Signals]                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Registry Contract:**
```solidity
contract SoothRegistry {
    // Permissionless: anyone can register
    mapping(address => bool) public isRegisteredAdjudicator;
    mapping(address => bool) public isRegisteredMarket;
    
    // Curated: governance-controlled
    mapping(address => bool) public isVerifiedAdjudicator;
    mapping(address => bool) public isFeaturedMarket;
    
    // Reputation
    mapping(address => uint256) public adjudicatorScore;
    mapping(address => uint256) public creatorScore;
}
```

### 16.2 Creator Deposit: USDC with Liquidity Leverage

**Decision:** Creators deposit USDC to fund market liquidity. Using **1.44x liquidity leverage**, creators get more liquidity depth than they deposit:

```
Deposit $693 → Get $1,000 liquidity depth (b)
Leverage Factor = 1 / ln(2) ≈ 1.44x
```

**Tier Options:**

| Tier | Liquidity (b) | Deposit Required | Graduation (2× b fees) |
|------|---------------|------------------|------------------------|
| **Micro** | $100 | **$69** | $200 |
| **Small** | $1,000 | **$693** | $2,000 |
| **Medium** | $10,000 | **$6,930** | $20,000 |
| **Large** | $100,000 | **$69,300** | $200,000 |

```solidity
uint256 constant LN2_WAD = 693_147_180_559_945_309; // ln(2) in WAD

function depositForTier(uint256 b) public pure returns (uint256) {
    return (b * LN2_WAD) / WAD;  // deposit = b × 0.693
}

function feeToLiquidityBoost(uint256 fee) public pure returns (uint256) {
    return (fee * WAD) / LN2_WAD;  // $1 fee → $1.44 liquidity
}
```

**Rationale:**
- Capital efficient — 100% of deposit is at-risk capital
- Deposit = maxLoss (what creator can lose)
- Every $1 in fees adds $1.44 to liquidity depth
- No SOOTH token requirement — USDC only

### 16.3 LP Vault with Exchange Rate (ERC4626-Inspired)

**Decision:** LP shares are managed via an **LP Vault** with exchange rate mechanics:
- ✅ Transferable (tradeable on secondary markets)
- ✅ `exchangeRate()` increases as fees accrue (30% of post-grad fees)
- ❌ No `deposit()` function (LP shares earned via fees only)
- ❌ No `withdraw()` function (redeemable only at settlement)

```solidity
contract MarketLPVault {
    IERC20 public asset;           // USDC
    uint256 public totalAssets;    // Grows with 30% of external fees
    uint256 public totalSupply;    // Fixed after graduation
    
    function exchangeRate() public view returns (uint256) {
        if (totalSupply == 0) return 1e18;
        return (totalAssets * 1e18) / totalSupply;
    }
    
    function accrueFeesToVault(uint256 amount) external onlyMarket {
        totalAssets += amount;  // No new LP tokens, rate increases
    }
    
    function redeem(uint256 shares) external returns (uint256) {
        require(market.state() == Settled, "Not settled");
        uint256 assets = (shares * totalAssets) / totalSupply;
        _burn(msg.sender, shares);
        return assets;
    }
}
```

**Key Difference from ERC4626:**
| ERC4626 Vault | Sooth LP Vault |
|---------------|----------------|
| `deposit(assets)` → shares | ❌ No deposit |
| `withdraw(shares)` → assets | ❌ No withdraw |
| `redeem(shares)` → assets | ✅ Only at settlement |
| `exchangeRate()` | ✅ Increases with 30% of fees |
| `transfer(to, amount)` | ✅ Enabled |

**Rationale:**
- Exchange rate reflects accrued fee value
- Tradeable on DEXs at fair value based on exchangeRate
- 30% of external fees grow vault (not liquidity pool)
- LP Vault assets are **safe** from maxLoss exposure

### 16.4 Graduation Time Threshold: 5 Days

**Decision:** Markets must graduate within **5 days** or expire.

```solidity
uint256 constant GRADUATION_DEADLINE = 5 days;

function checkExpiry() external {
    if (state == MarketState.Internal && 
        block.timestamp > createdAt + GRADUATION_DEADLINE) {
        _expireMarket();
    }
}
```

**Rationale:**
- Creates urgency (racing mechanic)
- Prevents zombie markets lingering
- Fast iteration — failed ideas fail fast
- Aligns with memecoin launch velocity
- 5 days is enough for viral topics, filters slow ones

### 16.5 Adjudicator: Contract Only (No EOA)

**Decision:** All adjudicators MUST be contracts implementing `IAdjudicator`.

```solidity
interface IAdjudicator {
    function resolve(address market) external returns (uint8 outcome);
    function canResolve(address market) external view returns (bool);
    function disputePeriod() external view returns (uint256);
    
    // Required for registry verification
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// In market creation:
function createMarket(..., address adjudicator) external {
    require(adjudicator.code.length > 0, "Adjudicator must be contract");
    require(
        IAdjudicator(adjudicator).supportsInterface(type(IAdjudicator).interfaceId),
        "Invalid adjudicator interface"
    );
    // ...
}
```

**Rationale:**
- Contracts are auditable (code is public)
- Enables complex resolution logic (multisig, oracle, ZK proof)
- Prevents single-key rugs
- Interface enforcement ensures compatibility

### 16.6 No Lock-on-Sell Before Graduation

**Decision:** During Internal phase, sell proceeds are **NOT locked**.

```
INTERNAL PHASE:
  BUY  → Shares credited immediately
  SELL → USDC credited immediately (no lock)
  
POST-GRADUATION:
  Lock-on-Sell rules may apply (TBD per market config)
```

**Rationale:**
- Removes friction for early traders
- Enables rapid position cycling (good for volume/fees)
- LP share incentive is sufficient alignment
- Lock-on-Sell can be optional post-graduation

---

## 17. Gaming Mechanics: The Graduation Race

### 17.1 The Core Game

Markets compete for attention by racing to graduation. The mechanics:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THE GRADUATION RACE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   DAY 0        DAY 3         DAY 5         DAY 7                    │
│   ─────        ─────         ─────         ─────                    │
│   Market A     ████░░░░      █████████     ✅ GRADUATED             │
│   Market B     ██░░░░░░      ███░░░░░░     ███████░░  (racing)      │
│   Market C     █░░░░░░░      █░░░░░░░░     ❌ EXPIRED               │
│                                                                      │
│   [Progress bar = cumulative fees / graduation threshold]           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 17.2 Creator Self-Trading Incentive

**Observation:** Creators are incentivized to self-trade to graduate faster.

**Is this bad?** Not necessarily.

| Aspect | Analysis |
|--------|----------|
| **Fee cost** | Self-trading costs real fees (5%), creator loses money |
| **Volume signal** | High volume attracts real traders (social proof) |
| **LP share dilution** | Creator earns LP shares proportional to fees paid |
| **Gaming limit** | Creator can't profit from fees they pay themselves |

**The Math (Updated with Liquidity Leverage):**
```
Creator selects: $1,000 liquidity tier
Creator deposits: $693 (= $1,000 × 0.693)
Graduation needs: $2,000 in fees (2× b)

Self-trade to graduate:
  Volume needed: $2,000 / 5% = $40,000
  Fee paid: $2,000
  Net cost: $2,000 (289% of deposit!)
  
This is economically irrational — creator pays 2.89× their deposit just to graduate.
Creator only profits if market generates organic volume.
```

**Conclusion:** With 2× b graduation threshold, self-trading is **economically irrational**. Creators cannot profitably self-trade to graduation.

### 17.3 Racing Leaderboard

A UI element showing the "hottest" markets in the graduation race:

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏁 GRADUATION RACE LEADERBOARD                                     │
├─────────────────────────────────────────────────────────────────────┤
│  #1  🔥 "Will ETH hit $5k by Q1 2026?"   [████████░░] 82% - 2d left │
│  #2  🚀 "Aliens disclosed in 2025?"       [██████░░░░] 61% - 4d left │
│  #3  ⚡ "Trump wins 2028 primary?"        [████░░░░░░] 43% - 5d left │
│  #4  📊 "BTC > $200k this cycle?"         [███░░░░░░░] 31% - 6d left │
│  #5  🎮 "GTA6 delayed again?"             [██░░░░░░░░] 22% - 6d left │
├─────────────────────────────────────────────────────────────────────┤
│  💀 RECENTLY EXPIRED (RIP)                                          │
│      "Solana flips ETH" - 12% at expiry                             │
│      "Vitalik joins Solana" - 3% at expiry                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 17.4 Viral Loop Mechanics

**How creators attract traders (and why self-trading bootstraps):**

```
┌────────────────────────────────────────────────────────────────┐
│                     VIRAL LOOP                                  │
│                                                                 │
│   Creator self-trades                                           │
│         │                                                       │
│         ▼                                                       │
│   Market shows activity ──────► Appears on leaderboard         │
│         │                              │                        │
│         ▼                              ▼                        │
│   Social proof ◄────────────── Real traders join               │
│         │                              │                        │
│         ▼                              ▼                        │
│   Creator shares on Twitter ──► More visibility                │
│         │                              │                        │
│         ▼                              ▼                        │
│   Market graduates ◄─────────── Volume snowball                │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 17.5 Anti-Gaming Measures (If Needed)

If self-trading becomes problematic, consider:

| Measure | Description | Trade-off |
|---------|-------------|-----------|
| **Cooldown** | Min 1 hour between trades from same address | Slows bots, may slow legit traders |
| **Whale cap** | Max 10% of graduation threshold from single address | Prevents single-party graduation |
| **Decay** | Older trades contribute less to graduation % | Favors recent activity |
| **Sybil detection** | On-chain clustering analysis | Complex, may have false positives |

**Recommendation:** Start with NO anti-gaming (let market dynamics play out). Add measures only if abuse is observed.

### 17.6 Multi-Market Competition Dynamics

When multiple markets compete for the same topic:

```
Example: Three creators make "ETH to $5k" markets

Market A: Creator seeds with $200 self-trade, gets early traction
Market B: Creator seeds with $500, aggressive Twitter campaign
Market C: No seeding, organic only

Likely outcome:
  - B graduates first (highest effort + spend)
  - A may graduate second (slower but viable)
  - C expires (insufficient bootstrap)
  
Winner: B's LP shareholders get all the post-graduation fee revenue
Losers: C's traders get refunds, creator loses bond
```

**This is intentional design.** Competition for hot topics incentivizes:
1. Creator effort (marketing, question quality)
2. Capital commitment (self-trading as bootstrap)
3. Speed (first to graduate captures attention)

---

## 18. Updated Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SOOTH LAUNCHPAD V3                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐            │
│   │    USDC     │      │   Registry  │      │ Adjudicator │            │
│   │  (deposit)  │      │  (Curated)  │      │  Contracts  │            │
│   └──────┬──────┘      └──────┬──────┘      └──────┬──────┘            │
│          │                    │                    │                    │
│          │ deposit            │ verify             │ resolve            │
│          ▼                    ▼                    ▼                    │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    LaunchpadFactory                              │  │
│   │  createMarket(tierIndex, initialYesBps, adjudicator, question)  │  │
│   └─────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                   │
│                                     ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    LaunchpadMarket                               │  │
│   │                                                                  │  │
│   │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │  │
│   │  │   LMSR AMM  │   │  Orderbook  │   │  LP Vault   │            │  │
│   │  │  (always)   │   │ (post-grad) │   │ (4626-ish)  │            │  │
│   │  └─────────────┘   └─────────────┘   └─────────────┘            │  │
│   │                                                                  │  │
│   │  State: INTERNAL ──► GRADUATED ──► SETTLED                      │  │
│   │         (5 day max)   (orderbook)   (payouts)                   │  │
│   │                                                                  │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   Flow:                                                                 │
│   1. Creator selects tier + deposits USDC (1.44x liquidity leverage)   │
│   2. Traders trade AMM, earn LP tokens (via fees)                      │
│   3. Race to graduation (5 day deadline, 2× b in fees)                 │
│   4. Graduation: orderbook activates, 50/30/20 fee split               │
│   5. Settlement: LP Vault + pool remainder distributed                 │
│                                                                         │
│   Liquidity Leverage: deposit × 1.44 = liquidity depth (b)             │
│   Fee Boost: $1 fee → $1.44 added to b                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 19. Final Design Decisions (Ready for Implementation)

**Status:** ✅ All decisions finalized (2025-12-14)

### Core Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creator deposit | **USDC only** | No SOOTH bond required |
| Deposit amount | `b × 0.693` | 1.44x liquidity leverage |
| Liquidity tiers | **Fixed** | $100, $1k, $10k, $100k |
| Graduation threshold | **2× b** in fees | |
| Graduation deadline | **5 days** | |
| Internal fee | **5%** | 100% → b growth |
| External AMM fee | **1%** | 50/30/20 split |
| External OB fee | **0.5%** | 50/30/20 split |
| Fee-to-b math | `delta_b = fee / 0.693` | Always safe (LMSR guarantee) |

### Fee Split (Post-Graduation)

| Destination | Share | Purpose |
|-------------|-------|---------|
| **Liquidity (b)** | 50% | Increases AMM depth, AT RISK of maxLoss |
| **LP Vault** | 30% | Increases exchangeRate, SAFE from maxLoss |
| **Protocol** | 20% | Treasury → redistributed to creators/adjudicators |

### Settlement & Expiry

| Scenario | Outcome |
|----------|---------|
| Market graduates + settles normally | Winning traders paid, LP Vault redeemable, 20% profit → protocol |
| Market graduates + early truth | Normal settlement (already graduated) |
| Market expires (no graduation) | Creator deposit refunded, LP fees refunded |
| Truth known before graduation | Market fails → same as expiry (full refunds) |

### Other Decisions

| Decision | Value |
|----------|-------|
| Open-end vs Fixed-end | **Creator's choice** at creation |
| LP share mechanics | ERC4626-style LP Vault with `exchangeRate()` |
| Adjudicator type | Contract only (`IAdjudicator` interface) |
| Lock-on-Sell (internal) | No lock |
| Permission model | Permissionless + curated registry (Morpho-style) |

**All decisions finalized. Ready for contract interface spec.**

---

## References

1. pump.fun — Bonding curve memecoin launchpad
2. friend.tech — Social token bonding curves + revenue share
3. Polymarket + UMA — Optimistic oracle separation
4. Zeitgeist — Permissionless prediction markets with creator bonds
5. Kash — Custom AMM bonding curves for prediction markets
6. **Morpho Vault V2** — Permissionless + curated registry hybrid model

---

*Research Status: ✅ All design decisions finalized. Ready for contract interface spec.*
