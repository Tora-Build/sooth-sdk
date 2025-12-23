# Modular Venue Stack — Design Review

**Reviewed**: 2024-12-23  
**Document under review**: `MODULAR_VENUE_STACK.md` (draft from conversation `bc-bd91fb1d-9131-4a02-ab23-796ae3498028`)  
**Status**: Review Notes

---

## Executive Summary

The Modular Venue Stack proposal represents a significant architectural evolution for Sooth Protocol. It cleanly separates the monolithic `SoothMarketBase` into distinct, purpose-built layers:

- **TruthMarket**: Lifecycle and settlement source of truth
- **AMMEngine**: LMSR-based position domain (non-transferable)
- **OBVenue**: Token-based tick book (transferable ERC20s)
- **TraderVaultLite**: Optional custody helper

The key architectural decision — **making AMM positions and OB tokens intentionally non-fungible** — is correct and well-justified. This prevents lock-bypass and retro-settlement escape vectors that would arise from fungibility.

**Overall Assessment**: Strong foundation. Ready for interface formalization with some gaps to address before implementation.

---

## Strengths

### 1. Non-Fungible Domain Decision
The explicit rejection of fungibility between AMM and OB outputs is the right call. The document correctly identifies that if tokens were fungible:
- Lock-on-sell could be bypassed by selling on OB
- Retro-settlement (T\*-based adjustments) could be escaped
- The protocol's risk management invariants would be broken

### 2. Clean Four-Layer Separation
The separation into TruthMarket / AMMEngine / OBVenue / TraderVaultLite creates:
- Clear security boundaries (OB bug doesn't brick AMM)
- Independent upgradeability (deploy new OBVenue without migrating markets)
- Reduced contract size (current `SoothMarketBase` is approaching 24KB limit)

### 3. Pull-First Lifecycle Gating
Correctness does not depend on hooks:
```solidity
require(ITruthMarket(market).isLive() && !isSettled(), "Market not live");
```
Hooks are optional caching/indexing optimizations. This is the safest pattern.

### 4. Minimal Standard Interfaces
The drafted interfaces are appropriately small:
- `ITruthMarket`: 4 functions (isLive, isSettled, winningOutcome, tStar)
- `IOBVenue`: registration surface
- `IFeePolicy`: parameter provider only (venue enforces collection)

### 5. Self-Registration Pattern
Registration authority recommendation (market self-registers or via `operator()`) prevents third-party spoof attacks where someone registers a fake market to phish users.

### 6. Linear Probability Ticks
The math is sound:
- Tick `i` → probability `p = i/N`
- Ratio `R = (N-i)/i`
- Guarantees uniform probability steps regardless of nonlinear ratio

---

## Gaps / Open Questions

### 1. AMM↔OB Bridge (Deferred but Undefined)

**Current state**: "Any bridge between the two domains is an explicit, policy-heavy adapter (optional; not assumed here)."

**Questions**:
- Is the bridge truly out of scope, or should constraints be documented even if implementation is deferred?
- What would a minimal bridge look like? (e.g., "convert AMM position to OB tokens after unlock")
- Should the interfaces include extension points for a future bridge?

**Recommendation**: Add a "Future Work" section with bridge constraints sketch.

---

### 2. OB Collateralization Details

**Current state**: `Collateralizer` module is mentioned but not fully specified.

**Questions**:
- Who holds the USDC backing split/merge? A separate contract? The OBVenue? The TruthMarket?
- If `merge()` is locked (per our discussion), where is that lock enforced?
- Does `Collateralizer` need to query `TruthMarket.isSettled()` before allowing merge?

**Recommendation**: Define `ICollateralizer` interface with:
```solidity
interface ICollateralizer {
    function split(uint256 usdcAmount) external;
    function merge(uint256 amount) external; // may be locked
    function redeem(uint256 winningTokenAmount) external; // post-settlement
}
```

---

### 3. OB Token Redemption Flow Post-Settlement

**Current state**: Not addressed.

**Questions**:
- After `TruthMarket.isSettled() == true`, how do OB token holders convert winning tokens → USDC?
- Does redemption go through `Collateralizer.redeem()`?
- Is redemption delayed until settlement-root finalization (for T\*-based adjustment)?
- What happens to resting liquidity in the OBVenue at settlement? Auto-withdrawal? User-triggered?

**Recommendation**: Add a "Settlement Flow" section covering:
1. Trading stops (`isLive = false`)
2. Makers withdraw resting liquidity
3. Token holders call `redeem()` (possibly after delay)
4. Settlement-root claims (if applicable)

---

### 4. Fee Accounting Mechanics

**Current state**: `IFeePolicy.quoteObFeeBps()` returns `(feeBps, recipient)`.

**Questions**:
- Are fees collected per-swap or accrued?
- How are accrued fees claimed? By whom?
- Is there a protocol split vs. market-creator split vs. maker-rebate?
- Are fees collected in USDC or in outcome tokens?

**Recommendation**: Extend the fee section with:
```solidity
interface IOBVenue {
    function claimFees(bytes32 marketKey, address recipient) external returns (uint256 amount);
    function accruedFees(bytes32 marketKey, address recipient) external view returns (uint256);
}
```

---

### 5. Missing `IAMMEngine` Interface

**Current state**: `ITruthMarket` and `IOBVenue` are drafted, but `IAMMEngine` is not.

**Questions**:
- Is the AMM engine intentionally Sooth-internal (no standard interface)?
- If non-Sooth AMMs should also be supported, what minimal interface would they need?
- Should `IAMMEngine` expose `executePosition()`, `getPrice()`, `lockDuration()`?

**Recommendation**: Either:
- Explicitly state AMM is Sooth-internal (out of scope for standardization), or
- Draft a minimal `IAMMEngine` interface for completeness

---

## Suggested Additions

### 1. Settlement Flow for OB Domain

Add a section documenting the end-to-end flow:

```
1. TruthMarket.finalizeResolution(outcome, tStar)
   → isLive = false, isSettled = true

2. OBVenue: trading disabled
   → swap() reverts with "Market not live"

3. Makers: withdraw resting liquidity
   → withdrawLiquidity(marketKey, tick) returns tokens

4. Token holders: redeem
   → Collateralizer.redeem(winningTokenAmount)
   → May be locked until settlement-root finalization

5. Settlement-root claims (if applicable)
   → claimSettlementRoot(market, batchId, proof) for T*-based adjustments
```

---

### 2. Invariant Assertions

Document the key invariants the system must maintain:

| Invariant | Description |
|-----------|-------------|
| **Token symmetry** | `totalSupply(obYES) == totalSupply(obNO)` (from split/merge) |
| **Conservation in OBVenue** | `sum(ticks[i].askYES) + balances held by users == totalSupply(obYES)` |
| **Collateral backing** | `Collateralizer.usdcBalance >= totalSupply(obYES)` |
| **No orphan liquidity** | After settlement, all resting liquidity is withdrawable |

---

### 3. Security Considerations

Add a "Security Model" section addressing:

| Threat | Mitigation |
|--------|------------|
| Malicious market (lies about `isLive`) | OBVenue should be tolerant of stale state; worst case is trading stops unexpectedly, not loss of funds |
| Compromised Collateralizer | Collateralizer holds USDC; if compromised, redemption fails. Consider upgradeable proxy with timelock. |
| Malicious fee policy | FeePolicy only returns parameters; venue enforces. Max fee cap in venue (e.g., 10%) prevents extraction. |
| Spoof registration | Self-registration or operator-only authorization prevents third-party registration of fake markets. |

---

### 4. Phased Next Steps

Restructure "Suggested next steps" with priorities:

**Phase 1: Interface Formalization**
1. Finalize `ITruthMarket`, `IOBVenue`, `IFeePolicy`, `ICollateralizer` interfaces
2. Decide on `IAMMEngine` scope (internal vs. standardized)
3. Define registration authority rules

**Phase 2: OB Token Domain**
1. Implement `Collateralizer` (split/merge/redeem with optional locks)
2. Implement `OBVenue` core (tick book, swap, liquidity management)
3. Implement fee collection and claim flows

**Phase 3: Integration**
1. Integrate with existing `TruthMarket` (LaunchpadMarket or equivalent)
2. Frontend routing (display unified price, route to best venue)
3. Arbitrage bot support (AMM ↔ OB price convergence)

**Phase 4: Optional Bridge**
1. Design AMM position → OB token bridge (if needed)
2. Define bridge constraints (unlock period, conversion mechanics)

---

## Action Items

| Priority | Item | Owner | Status |
|----------|------|-------|--------|
| P0 | Finalize `ICollateralizer` interface (including lock semantics) | TBD | Open |
| P0 | Document settlement/redemption flow for OB domain | TBD | Open |
| P1 | Decide if `IAMMEngine` should be standardized | TBD | Open |
| P1 | Add invariant assertions to spec | TBD | Open |
| P1 | Add security considerations section | TBD | Open |
| P2 | Define fee claim mechanics | TBD | Open |
| P2 | Sketch AMM↔OB bridge constraints (even if deferred) | TBD | Open |

---

## References

- Original discussion: `bc-bd91fb1d-9131-4a02-ab23-796ae3498028`
- Related: [`DYNAMIC_OB_FEES.md`](./DYNAMIC_OB_FEES.md) (fee model research)
- Related: [`STAKING_DESIGN.md`](./STAKING_DESIGN.md) (guardian/LP staking)
- Current implementation: [`SoothMarketBase.sol`](../../contracts/core/SoothMarketBase.sol)
