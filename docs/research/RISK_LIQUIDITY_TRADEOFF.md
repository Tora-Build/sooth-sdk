# Risk-Liquidity Trade-off in Prediction Markets

**Date:** 2025-11-30  
**Status:** Research Finding  
**Impact:** Critical for risk management and LP protection

---

## Executive Summary

This document analyzes a critical trade-off discovered during the Monad testnet deployment: **higher risk markets receive more liquidity, which paradoxically increases the vault's maximum loss exposure**. While this design improves user experience and market efficiency, it creates significant risk management implications that must be carefully considered for mainnet deployment.

---

## The Observation

During the Monad testnet deployment configuration, we observed that markets classified as "HIGH" risk were allocated significantly more liquidity than "LOW" risk markets:

| Market              | Risk Level | bParam (Liquidity) | Ratio vs LOW |
| ------------------- | ---------- | ------------------ | ------------ |
| BTC Price Market    | **LOW**    | 43,281 mUSDC       | 1.0x         |
| ETH Gas Market      | **LOW**    | 43,281 mUSDC       | 1.0x         |
| Monad Launch Market | **MEDIUM** | 72,135 mUSDC       | 1.67x        |
| Sooth TVL Market    | **HIGH**   | 100,989 mUSDC      | 2.33x        |
| Monad Top 10 Market | **HIGH**   | 129,843 mUSDC      | 3.0x         |

**Initial Question:** Why would we allocate MORE capital to HIGHER risk markets?

---

## The Rationale

### 1. Risk ≠ Danger in This Context

The "risk level" classification has a dual meaning:

- **Traditional Finance Interpretation:** Risk = Probability of loss → Reduce exposure
- **Prediction Market Interpretation:** Risk = Expected volatility & activity → Need deeper liquidity

### 2. What "HIGH Risk" Really Means

HIGH risk markets are characterized by:

- **Higher uncertainty** in outcomes (more controversial)
- **Higher expected trading volume** (more popular)
- **Higher price volatility** (rapid opinion changes)
- **Higher potential for manipulation** (if liquidity is insufficient)

### 3. Why More Liquidity is Needed

The LMSR (Logarithmic Market Scoring Rule) AMM uses the `b` parameter to control market depth:

```
Cost Function: C(q) = b × ln(e^(qYes/b) + e^(qNo/b))
```

**Higher b parameter:**

- Flatter cost curve
- More shares needed to move price
- Lower slippage per trade
- Better prices for traders
- Harder to manipulate

**Lower b parameter:**

- Steeper cost curve
- Fewer shares needed to move price
- Higher slippage per trade
- Worse prices for traders
- Easier to manipulate

### 4. User Experience Consideration

For a popular, high-volume market with LOW liquidity:

- Traders face massive slippage
- Large trades become impractical
- Price discovery becomes inefficient
- Market becomes less useful

For the same market with HIGH liquidity:

- Smooth trading experience
- Large trades possible
- Efficient price discovery
- Market serves its purpose

---

## The Hidden Cost: Maximum Loss Exposure

### The Mathematical Relationship

From `SoothRiskManager.sol`:

```solidity
// Step 1: Calculate maximum loss per market
uint256 Lmax = (T + B) / K;

// Step 2: Calculate global b parameter
uint256 bGlobal = Lmax * 1.4427;

// Step 3: Calculate market-specific b parameter
uint256 bMarket = bGlobal * riskMultiplier;
```

**Risk class multipliers:**

```
LOW:      0.6x → bMarket = bGlobal × 0.6
MEDIUM:   1.0x → bMarket = bGlobal × 1.0
HIGH:     1.4x → bMarket = bGlobal × 1.4
CRITICAL: 1.8x → bMarket = bGlobal × 1.8
```

### Reverse Engineering Maximum Loss

If we reverse the formula:

```
bMarket = Lmax × 1.4427 × riskMultiplier
→ Lmax = bMarket / (1.4427 × riskMultiplier)
```

**For Monad markets:**

| Market                | bParam  | Multiplier | **Implied Lmax** | **Max Loss** |
| --------------------- | ------- | ---------- | ---------------- | ------------ |
| BTC Price (LOW)       | 43,281  | 0.6x       | ~50,000 mUSDC    | **~50k**     |
| Monad Launch (MEDIUM) | 72,135  | 1.0x       | ~50,000 mUSDC    | **~50k**     |
| Sooth TVL (HIGH)      | 100,989 | 1.4x       | ~50,000 mUSDC    | **~50k**     |
| Monad Top 10 (HIGH)   | 129,843 | 1.8x       | ~50,000 mUSDC    | **~50k**     |

**Wait, they all have the same Lmax?**

Not quite. The issue is that each market is using a **different effective bGlobal**:

```
Effective bGlobal = bMarket / riskMultiplier

LOW market:  43,281 / 0.6 = 72,135
MEDIUM:      72,135 / 1.0 = 72,135
HIGH (TVL):  100,989 / 1.4 = 72,135
HIGH (Top10): 129,843 / 1.8 = 72,135
```

So they're all calibrated to the same global risk budget. **However**, the actual exposure differs:

### The Real Exposure Difference

The vault's exposure to a market isn't just Lmax—it's the **actual locked exposure** based on trading activity:

```solidity
// SoothVault.sol
mapping(uint256 => uint256) public lockedExposure;
```

**Key insight:** Markets with higher `b` parameters can:

1. **Absorb more trading volume** before reaching price extremes
2. **Accumulate larger positions** (more qYes or qNo)
3. **Create larger unrealized P&L** for the vault
4. **Require more capital reserves** to maintain

### Concrete Example

Consider two scenarios where traders buy YES shares:

**LOW risk market (b = 43,281):**

```
Initial: qYes = 0, qNo = 0, price = 50%
After 10,000 YES shares bought:
  qYes = 10,000
  New price ≈ 61%
  Vault exposure ≈ 4,800 USDC
```

**HIGH risk market (b = 129,843):**

```
Initial: qYes = 0, qNo = 0, price = 50%
After 10,000 YES shares bought:
  qYes = 10,000
  New price ≈ 54%
  Vault exposure ≈ 5,200 USDC
```

The HIGH risk market:

- Moves price less (better UX)
- But accumulates exposure more slowly
- Can absorb much larger trades before hitting limits
- **Potentially accumulates much larger total exposure**

---

## The Complete Trade-off Matrix

### HIGH Risk Markets (e.g., "Monad Top 10")

**Advantages:**

- ✅ **Superior liquidity** (b = 129,843)
- ✅ **Low slippage** → Better trader experience
- ✅ **Can handle large trades** → More market participation
- ✅ **Harder to manipulate** → More reliable prices
- ✅ **Higher expected volume** → More trading fees for LPs
- ✅ **Better price discovery** → More useful market

**Disadvantages:**

- ❌ **Higher capital requirements** → Needs larger vault
- ❌ **Larger potential exposure** → More locked capital
- ❌ **Higher maximum loss** → If settlement goes wrong
- ❌ **More LP risk** → Losses are shared proportionally
- ❌ **Requires better risk monitoring** → More complex management

### LOW Risk Markets (e.g., "BTC Price")

**Advantages:**

- ✅ **Lower capital requirements** → Smaller vault needed
- ✅ **Lower maximum loss** → Safer for LPs
- ✅ **Less exposure accumulation** → More predictable risk
- ✅ **Simpler risk management** → Easier to monitor

**Disadvantages:**

- ❌ **Lower liquidity** (b = 43,281)
- ❌ **Higher slippage** → Worse trader experience
- ❌ **Limited trade sizes** → Discourages large participants
- ❌ **Easier to manipulate** → Less reliable prices
- ❌ **Lower expected volume** → Fewer fees for LPs
- ❌ **Worse price discovery** → Less useful market

---

## Risk Management Implications

### 1. Adjudicator Quality is Critical

The maximum loss scenario occurs when:

- A market settles to an unexpected outcome
- The vault is holding a large opposite position
- LPs must absorb the loss

**Example worst case:**

```
Market: "Monad Top 10" (HIGH risk, b = 129,843)
Vault position: -50,000 YES shares (sold to traders)
Expected outcome: NO (price = 20%)
Actual settlement: YES (adjudicator error/manipulation)

Vault loss: ~40,000 mUSDC
LP impact: All LPs share this loss proportionally
```

**Mitigation:**

- Use high-quality, tamper-resistant adjudicators (Chainlink, UMA, ZK proofs)
- Implement multi-sig or governance for controversial markets
- Add dispute periods and appeal mechanisms
- Consider adjudicator insurance or bonds

### 2. Capital Adequacy Requirements

The vault must maintain sufficient reserves:

```
Required Reserves ≥ Σ(lockedExposure_i) for all active markets
```

**For Monad deployment:**

```
If all 5 markets are active and near max exposure:
Total required ≈ 5 × 50,000 = 250,000 mUSDC minimum
```

**Considerations:**

- Higher risk markets lock more capital
- Need buffer for withdrawals
- Must handle concurrent worst cases (K parameter)

### 3. Dynamic Risk Adjustment

The `SoothRiskManager` already implements dynamic `bGlobal` updates:

```solidity
function updateGlobalB() external {
    uint256 T = vault.getTreasuryBalance();
    uint256 B = vault.getLiquidBufferBalance();
    uint256 K = globalRisk.maxConcurrentWorstCase;

    uint256 Lmax = (T + B) / K;
    uint256 newB = Lmax * 1.4427;

    globalRisk.bGlobal = newB;
}
```

**This means:**

- As vault TVL grows → bGlobal increases → All markets get more liquidity
- As vault TVL shrinks → bGlobal decreases → All markets get less liquidity
- Automatic scaling with available capital

**Potential enhancement:**

- Monitor actual exposure vs. allocated exposure per market
- Dynamically adjust risk multipliers based on market behavior
- Implement circuit breakers for extreme scenarios

### 4. LP Communication and Transparency

LPs need to understand the risk they're taking:

**Key metrics to display:**

- Total vault TVL
- Total locked exposure
- Available buffer
- Per-market exposure
- **Risk-adjusted exposure** (exposure × risk multiplier)
- Historical P&L by market
- Adjudicator track record

---

## Testnet vs. Mainnet Considerations

### Testnet (Current Monad Deployment)

**Appropriate to:**

- ✅ Allocate aggressive liquidity to HIGH risk markets
- ✅ Test system under stress conditions
- ✅ Learn what breaks before real money is involved
- ✅ Experiment with different risk multipliers
- ✅ Validate adjudicator reliability

**Goals:**

- Discover edge cases
- Test capital efficiency
- Validate risk formulas
- Stress test infrastructure

### Mainnet (Future Production)

**Must consider:**

- ⚠️ Real LP capital at risk
- ⚠️ Adjudicator failure has real costs
- ⚠️ Regulatory implications
- ⚠️ Reputation risk
- ⚠️ Insurance and backstops

**Potential safeguards:**

1. **Conservative initial multipliers:**

   ```
   LOW:      0.8x (instead of 0.6x)
   MEDIUM:   1.0x (unchanged)
   HIGH:     1.2x (instead of 1.4x)
   CRITICAL: 1.5x (instead of 1.8x)
   ```

2. **Per-market exposure caps:**

   ```solidity
   mapping(uint256 => uint256) public maxExposurePerMarket;

   function checkExposureLimit(uint256 marketId) internal view {
       require(
           lockedExposure[marketId] <= maxExposurePerMarket[marketId],
           "Market exposure limit reached"
       );
   }
   ```

3. **Insurance fund:**

   - Allocate % of trading fees to insurance reserve
   - Use to cover adjudicator failures
   - Protects LP capital

4. **Gradual rollout:**

   - Start with LOW risk markets only
   - Add MEDIUM after proven track record
   - Add HIGH only with robust adjudication

5. **Governance controls:**
   - DAO votes on risk multipliers
   - Community oversight of HIGH risk markets
   - Emergency pause mechanisms

---

## Recommendations

### For Current Testnet Deployment

1. ✅ **Keep current configuration** - It's appropriate for testing
2. ✅ **Monitor exposure closely** - Track actual vs. theoretical limits
3. ✅ **Document all settlements** - Build adjudicator reliability data
4. ✅ **Test edge cases** - Deliberately create stress scenarios
5. ✅ **Measure slippage** - Validate that HIGH risk markets perform better

### For Future Mainnet Deployment

1. 🔴 **Start conservative** - Use lower risk multipliers initially
2. 🔴 **Implement exposure caps** - Hard limits per market
3. 🔴 **Require adjudicator bonds** - Skin in the game for settlement providers
4. 🔴 **Build insurance fund** - Protect LPs from adjudicator failures
5. 🔴 **Add monitoring dashboard** - Real-time risk metrics for LPs
6. 🔴 **Implement circuit breakers** - Auto-pause on extreme scenarios
7. 🔴 **Gradual risk escalation** - Prove LOW/MEDIUM work before adding HIGH

### For Risk Management System

1. 📊 **Track realized vs. theoretical exposure** - Validate formulas
2. 📊 **Monitor correlation** - Do multiple markets move together?
3. 📊 **Stress test scenarios** - What if K markets all go wrong?
4. 📊 **Adjudicator scoring** - Track accuracy, speed, disputes
5. 📊 **LP behavior analysis** - How do LPs react to losses?

---

## Conclusion

The risk-liquidity trade-off is **fundamental to prediction market design**:

> **More liquidity = Better UX = Higher risk exposure**

This is not a bug—it's an intentional design choice that must be carefully managed:

- **HIGH risk markets NEED more liquidity** to function properly
- **But this exposes the vault to larger potential losses**
- **The trade-off is justified IF:**
  - Adjudicators are highly reliable
  - Risk management is robust
  - LPs are properly compensated (fees)
  - Capital reserves are adequate

**For testnet:** The current aggressive allocation is appropriate and valuable for learning.

**For mainnet:** We must implement additional safeguards to protect LP capital while still providing good UX.

The key is **not to avoid the trade-off**, but to **manage it intelligently** through:

- High-quality adjudication
- Dynamic risk adjustment
- Transparent LP communication
- Appropriate capital reserves
- Insurance mechanisms

---

## References

- `contracts/core/SoothRiskManager.sol` - Risk calculation implementation
- `contracts/core/SoothVault.sol` - Exposure tracking
- `docs/BMARKET_LIQUIDITY_RELATIONSHIPS.md` - Liquidity mechanics
- `markets.json` - Monad testnet configuration
- LMSR paper: Hanson, R. (2003). "Combinatorial Information Market Design"

---

**Author:** Research Team  
**Reviewed By:** Protocol Team  
**Next Review:** After testnet data collection (2-4 weeks)
