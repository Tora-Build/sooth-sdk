# TruthMarket State Machine

> Analysis of market lifecycle states and potential issues

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
                        │
                        │ [veto()]
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
| Veto possible | No (nothing to veto) | Yes | No |
| Redemption allowed | No | Yes* | Yes |
| Reversible | N/A | Yes (via veto) | No |

---

## Potential Issue: Premature Redemption

### Current Behavior

`isSettled()` returns `true` for both `SETTLED` and `FINALIZED`:

```solidity
function isSettled() external view override returns (bool) {
    return state == MarketState.SETTLED || state == MarketState.FINALIZED;
}
```

Collateralizer allows redemption when `isSettled()` is true:

```solidity
function redeem(...) {
    require(isMarketSettled(market), "Collateralizer: not settled");
    // ... transfers USDC
}
```

### Attack Scenario

```
1. Adjudicator settles: outcome = YES (state → SETTLED)
2. YES holders redeem immediately → USDC transferred out
3. Guardian vetoes → state reverts to SETTLING, outcome cleared
4. Adjudicator re-settles: outcome = NO
5. NO holders try to redeem → INSUFFICIENT USDC (already paid to YES holders)
```

### Impact

- Collateralizer becomes insolvent
- Correct winners cannot redeem
- Incorrect winners profit from wrong settlement

### Potential Fixes

**Option 1: Only allow redemption in FINALIZED state**

```solidity
// Add new function to TruthMarket
function isFinalized() external view returns (bool) {
    return state == MarketState.FINALIZED;
}

// Update Collateralizer
function redeem(...) {
    require(ITruthMarket(market).isFinalized(), "Collateralizer: not finalized");
    // ...
}
```

Pros: Simple, clean
Cons: Users must wait for veto window to close

**Option 2: Time-locked redemption**

```solidity
function redeem(...) {
    require(isMarketSettled(market), "...");
    require(
        block.timestamp > ITruthMarket(market).settlementTime() + VETO_WINDOW,
        "Collateralizer: veto window active"
    );
    // ...
}
```

Pros: Automatic after veto window
Cons: Requires new state variable (`settlementTime`)

**Option 3: Reserve funds during veto window**

Track redemptions during SETTLED state. If veto occurs, either:
- Claw back funds (complex, may fail)
- Mark as protocol debt

Pros: Allows early redemption
Cons: Complex, potential bad debt

### Recommendation

**Option 1** is cleanest. The veto window exists precisely to prevent premature payouts. Users can wait for finalization.

---

## Questions to Consider

1. What is the expected veto window duration?
2. Should there be a "fast finalize" path if guardian explicitly approves?
3. Should redemption be allowed during SETTLED if user accepts the risk?
4. How does this interact with the trial period mechanism?

---

*Document created: 2026-01-24*
*Status: Under review*
