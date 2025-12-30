# TickBook Protocol V8.1: Hybrid Concentrated Orderbook

## 1. Vision & Architecture
The TickBook has evolved from a basic orderbook into a **Hybrid Concentrated Orderbook**. It leverages Sooth's 10,000-tick bitmap architecture to provide professional-grade trading primitives: **Limit Orders (Ranged)** and **Market Orders (Amount-Based)**.

### Core Innovation: The Unified Book
Unlike traditional markets, YES and NO depth are unified into a single coordinate system.
- **Single Source of Depth**: A single heatmap ($L$) represents the total inventory for the entire market pair.
- **Symmetrical Pricing**: Every tick represents $P(YES)$ and $1-P(YES)$ simultaneously.
- **Directional Sweeping**: Market orders simply sweep the unified book **Up** (to buy YES) or **Down** (to buy NO).

## 2. Protocol Refinement (Maker/Taker Model)
We have moved away from "LP" terminology to a professional **Maker/Taker** exchange model.

| Actor | Action | Contract Method | Description |
|---|---|---|---|
| **Maker** | Place Limit | `placeLimitOrder` | Provide inventory across a price range (Point or Range). |
| **Maker** | Cancel Order | `cancelLimitOrder` | Withdraw inventory and reclaim tokens. |
| **Taker** | Execute Market | `executeMarketOrder` | Immediate fill for a dollar amount with slippage protection. |

## 3. Technical Implementation Details

### A. Concentrated Ranges
Limit orders are not restricted to single prices. Makers can "map" the market by providing depth across broad or narrow ranges.
- **Asymmetrical Funding**: The protocol automatically determines if YES, NO, or both tokens are needed based on the range relative to the current price.
- **Inventory Efficiency**: $O(1)$ discovery of active ticks using the TickBitmap library.

### B. Execution Logic
Market orders sweep through the `_tickDepth` mapping.
- **Virtual Reserves**: Each tick acts as a micro-AMM with linear bonding curve properties.
- **Taker Fees**: A 0.2% (20bps) fee is charged on takers, which accumulates as yield for makers.

## 4. Frontend: The Pro Terminal
The "Pro" interface (`/pro`) has been refactored into a high-performance trading terminal:
- **Dual-Mode Panel**: Toggle between **Limit (Ranged)** and **Market** execution.
- **Tick Map (10,000)**: A high-fidelity heatmap of order depth across the entire probability spectrum.
- **Tick Ladder**: A vertical price-depth ladder for precision execution analysis.
- **Orderbook Depth Chart**: Visualizes the cumulative "walls" of YES and NO depth.

## 5. Verification & QA
The protocol refactor has been verified through a complete test suite:
- **`TickBook.t.sol`**: Unit tests for point orders, range orders, and market order execution (4/4 PASS).
- **`V8Integration.t.sol`**: Full lifecycle E2E tests including splitting, trading, and settlement (6/6 PASS).

---
**Status**: V8.1 Protocol Refactor Complete
**Date**: December 25, 2025
**Engineering**: Sooth Alpha Team

