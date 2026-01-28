# Learnings: Finalized Markets UI Audit

## UI Improvements
- **Settlement Card Standardization:** We aligned the Pro page settlement card with the `AMMSettlementCard` design. This consistency helps users recognize the "Finalized" state across different trading interfaces.
- **Visual Hierarchy:** Using a grid layout for "Winning Outcome" and "Payout" makes the most important information (what happened and what do I get) immediately visible.
- **Badges & Icons:** Distinct icons (Trophy vs Clock) and badges (Finalized vs Settled) clearly communicate the market state.

## Technical Insights
- **Orderbook vs AMM Redemption:** While the UI looks similar, the underlying redemption mechanisms differ.
    - AMM uses `AMMEngine.settlePosition`.
    - Orderbook (Pro) uses `TickBookVault.redeemResolved`.
    - This prevents us from simply reusing the `AMMSettlementCard` component directly without refactoring it to handle both logic paths.
- **Order Lifecycle:** In the TickBook model, orders are not automatically cancelled upon finalization. This necessitates keeping the `UserOrdersPanel` active so users can manually cancel open orders to retrieve their locked collateral.

## Future Considerations
- **Unified Settlement Component:** A future refactor could create a generic `SettlementCard` that accepts a `onRedeem` callback and `payoutAmount` prop, decoupling the UI from the specific contract logic.
- **Auto-Cancellation:** Investigating if `redeemResolved` could be upgraded to auto-cancel user orders (gas permitting) would improve UX by removing the manual cancellation step.
