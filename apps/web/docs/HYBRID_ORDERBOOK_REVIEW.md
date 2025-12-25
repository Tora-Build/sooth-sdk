# Hybrid Concentrated Orderbook Review (v8.1)

## Overview
This document details the transition from an AMM-centric liquidity model to a **Hybrid Concentrated Orderbook** for the TickBook venue. The core "magic" of Sooth—10,000 discrete probability ticks—is now exposed through professional trading primitives: **Limit Orders** (ranged) and **Market Orders** (amount-based).

## 1. Key Terminology Shift
We have moved away from "Liquidity Provision" (LP) terminology to a clearer **Maker/Taker** model.

| Legacy (AMM) | New (Hybrid Orderbook) | Description |
|---|---|---|
| `addLiquidityRange` | `placeLimitOrder` | Maker provides inventory across a specific price range. |
| `removeLiquidityRange` | `cancelLimitOrder` | Maker withdraws inventory from a range. |
| `swap` | `executeMarketOrder` | Taker executes an immediate fill against existing limit orders. |
| `liquidity` | `orderDepth` | The total volume available at a specific tick. |
| `provider` | `maker` | The actor providing depth to the book. |

## 2. Technical Implementation
The underlying math remains the **Continuous Linear Tick** engine (concentrated liquidity), but the interface now matches standard exchange behavior.

### A. Limit Orders as Price Ranges
A "Limit Order" in TickBook is not just a single price point; it is a **Concentrated Range**.
- **Point Order**: `tickLower == tickUpper` (e.g., "Sell YES at exactly 60%").
- **Range Order**: `tickLower < tickUpper` (e.g., "Sell YES between 60% and 65%").
- **Efficiency**: Makers only provide the tokens needed for their range. Above current price = YES only; below = NO only; straddling = Mixed.

### B. Market Orders as Volume Sweeps
A "Market Order" specifies a dollar amount (or token amount) and a `limitTick` (slippage protection).
- **Execution**: The engine "sweeps" through the ticks, consuming maker depth until the order is filled or the `limitTick` is reached.
- **Gas**: $O(1)$ discovery using the bitmap library to find the next active tick.

## 3. UI/UX: The Pro Terminal
The "Pro" page has been refactored into a 4-pane layout to support this hybrid model:
1. **Maker Panel**: Place ranged limit orders (e.g., "Provide YES depth from 55% to 60%").
2. **Tick Map**: Heatmap visualization of order depth across all 10,000 ticks.
3. **Tick Ladder**: Vertical depth chart for point-by-point execution analysis.
4. **Market Panel**: Execute immediate fills (Market Orders) with slippage control.

## 4. Economic Incentives
- **Maker Inventory**: Makers earn yield from the 0.2% taker fee (implemented via yield accumulation).
- **Hybrid Advantage**: Combines the precision of an Orderbook with the passive efficiency of an AMM.

## 5. Review Items
- [ ] **Naming Accuracy**: Does "Limit Order" clearly convey the ranged nature to pro traders?
- [ ] **Asymmetrical Funding**: Is it clear to makers why they only need one token type for "Out of the Money" orders?
- [ ] **Taker Fees**: Is the 20bps fee competitive for pro market sweeping?

---
*Drafted: December 25, 2025*

