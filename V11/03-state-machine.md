# TruthMarket State Machine

> Market lifecycle states, transitions, and redemption gating

## State Enum

```solidity
enum MarketState {
    LIVE,       // Trading active
    SETTLING,   // Awaiting adjudicator decision (only explicit after veto)
    SETTLED,    // Outcome submitted, veto window open
    FINALIZED   // Permanent, irreversible
}
```

## State Transitions

```
state variable value:

LIVE ──[settle()]──► SETTLED ──[finalize()]──► FINALIZED
                        │                          │
                        │ [veto()]                 └──► Redemption enabled
                        ▼
                    SETTLING ──[settle()]──► SETTLED ──► ...
```

## Key Insight: "Virtual" Settling State

The `SETTLING` enum value is **only explicitly set after a veto**.

Normal flow skips it entirely: `LIVE → SETTLED → FINALIZED`.

```solidity
function isSettling() external view returns (bool) {
    return (state == MarketState.LIVE && block.timestamp >= deadline) ||
           state == MarketState.SETTLING;
}
```

| Scenario | `state` variable | `isSettling()` returns |
|----------|------------------|------------------------|
| Before deadline | `LIVE` | `false` |
| After deadline, before settle | `LIVE` | `true` (virtual) |
| After veto | `SETTLING` | `true` (explicit) |
| After settle | `SETTLED` | `false` |

## Role Actions by State

| State | Adjudicator | Guardian |
|-------|-------------|----------|
| LIVE | `settle()` (early settlement) | - |
| SETTLING | `settle()` | - |
| SETTLED | `finalize()` | `veto()` |
| FINALIZED | - | - |

## State Comparison

| Property | SETTLING | SETTLED | FINALIZED |
|----------|----------|---------|-----------|
| Outcome known | No | Yes | Yes |
| Trading | Stopped | Stopped | Stopped |
| Veto possible | No | Yes | No |
| Redemption allowed | No | No | **Yes** |
| Reversible | N/A | Yes (via veto) | No |

---

## Finalization-Gated Redemption

### Design Rationale

Redemption is **only allowed after FINALIZED**, not during SETTLED.

This prevents a veto-window insolvency attack:

```
WITHOUT GATING (vulnerable):
1. Adjudicator settles: outcome = YES
2. YES holders redeem immediately → USDC drained
3. Guardian vetoes → back to SETTLING
4. Adjudicator re-settles: outcome = NO
5. NO holders try to redeem → INSUFFICIENT USDC

WITH GATING (safe):
1. Adjudicator settles: outcome = YES
2. Redemption blocked (not FINALIZED)
3. Guardian vetoes → back to SETTLING
4. Adjudicator re-settles: outcome = NO
5. Adjudicator finalizes
6. NO holders redeem → full USDC available
```

### Implementation

```solidity
// TruthMarket.sol
function isFinalized() external view returns (bool) {
    return state == MarketState.FINALIZED;
}

// Collateralizer.sol
function redeem(...) {
    require(ITruthMarket(market).isFinalized(), "Collateralizer: not finalized");
    // ...
}
```

### Affected Contracts

All redemption/payout paths now require `FINALIZED`:

| Contract | Function | Gating |
|----------|----------|--------|
| Collateralizer | `redeem()` | `isFinalized()` |
| Collateralizer | `redeemOutcome()` | `isFinalized()` |
| AMMEngine | `settlePosition()` | `isFinalized()` |
| TickBookVault | `redeemResolved()` | `isFinalized()` |

---

## Complete Flow Example

```
1. Creator creates market (state = LIVE)
2. Trading occurs on AMM and TickBook
3. Deadline passes (isSettling() returns true, but state still LIVE)
4. Adjudicator calls settle(outcome, tStar) → state = SETTLED
5. Veto window begins
   - Guardian can veto() → state = SETTLING, repeat from step 4
   - No veto? Continue...
6. Adjudicator calls finalize() → state = FINALIZED
7. Redemption enabled:
   - Collateralizer.redeem() for outcome tokens
   - AMMEngine.settlePosition() for AMM positions
   - TickBookVault.redeemResolved() for orderbook fills
```

---

*Last Updated: 2026-01-25*
*Status: Implemented & Tested*
