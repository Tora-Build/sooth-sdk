# Decision: UserOrdersPanel in Finalized Markets

## Context
In the Pro trading interface, the `UserOrdersPanel` displays a user's active orders, spot sells, and claimable fills. We needed to decide whether to keep, remove, or simplify this panel when a market reaches the "Finalized" stage.

## Decision
**Option A: Keep**

## Reasoning
1.  **Collateral Recovery:** In an on-chain orderbook model, open orders lock user funds (USDC for bids, Shares for asks). Market finalization typically does *not* automatically iterate through and cancel all individual user orders due to gas block limits. Therefore, users **must** manually cancel their open orders to retrieve their locked collateral.
2.  **Claiming Fills:** Users may have "pending" (unclaimed) fills from trades that occurred prior to finalization. These funds are held in the contract until claimed. The `UserOrdersPanel` provides the necessary "Claim" functionality.
3.  **Consistency:** Removing the panel would trap user funds and hide the mechanism to recover them. Keeping it ensures users have full control over their assets regardless of market state.

## Implementation
- The `UserOrdersPanel` will remain visible in the finalized view.
- No changes to the component logic are required for this phase, as the existing "Cancel" and "Claim" functions are sufficient.
