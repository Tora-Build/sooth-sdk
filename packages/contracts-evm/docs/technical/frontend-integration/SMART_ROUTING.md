# Smart Routing & Unified Ladder Design

**Status**: Implemented
**Deployment**: Frontend Only (`apps/web`)
**Component**: `LimitOrderForm.tsx`
**Related**: `ORDERBOOK_INTEGRATION.md`

## 1. Context & Objective

The Goal is to provide a "Unified Ladder" trading experience. Users should not need to choose between "Market Order" (AMM) and "Limit Order" (Orderbook) if their intent is simply to "buy at price X or better".

If a user places a Limit Order that is aggressive enough to cross the current market spread, they should instantly receive the best available price—whether that comes from the Orderbook or the AMM.

## 2. Architecture

### Client-Side Router

Unlike systems with a `UniversalRouter` smart contract, Sooth implements this logic entirely on the **frontend**. This avoids extra gas costs and contract complexity while providing immediate user feedback.

> [!NOTE] > **Constraint**: This is a **Binary Choice** router. It routes the _entire_ order to either the AMM or the Orderbook. It does **not** currently support "Hybrid Execution" (splitting an order between both venues).

```mermaid
graph TD
    User[User Inputs Price X] --> Check{Is Crossing Market?}
    Check -- No --> Passive[Route to Orderbook]
    Check -- Yes --> Compare{AMM vs Book Price}
    Compare -- AMM Better --> ExecAMM[Execute Market Order (AMM)]
    Compare -- Book Better --> ExecBook[Execute Limit Order (Orderbook)]

    style ExecAMM fill:#e1f5fe,stroke:#01579b
    style ExecBook fill:#e8f5e9,stroke:#1b5e20
```

## 3. Detailed Logic

### A. Crossing Detection

First, we determine if the order is "Proactive" (willing to execute now) or "Passive" (providing liquidity).

- **Buy Order**: `Limit Price >= Market Price`
- **Sell Order**: `Limit Price <= Market Price`

_Note: If `Market Price` is unavailable, we default to Passive._

### B. Price Comparison

If the order is **Proactive**, we compare the execution price between the two venues.

**Key Concept: Inversion for Selling**
The Orderbook matches strictly on YES tokens.

- **Selling YES** effectively means "Buying NO".
- **Buying NO** on the book is matched against **Bids for YES**.
- Therefore, the "Best Price" for a Sell YES order is the **Best YES Bid**.

| Action       | AMM Price Source  | Orderbook Source        | "Better" Means   |
| :----------- | :---------------- | :---------------------- | :--------------- |
| **Buy YES**  | `market.priceYes` | Best **Ask** (Low)      | Lower is Better  |
| **Sell YES** | `market.priceYes` | Best **Bid** (High)     | Higher is Better |
| **Buy NO**   | `market.priceNo`  | Best **Bid** (inverted) | Lower is Better  |

### C. Execution Path

#### 1. Route to AMM (`trade`)

- **Trigger**: AMM Price is better than Book Price OR Book is empty.
- **Function**: `useTrade().trade(outcome, amount)`
- **Slippage**: Uses standard slippage settings (e.g., 0.5%).
- **UX**: User sees "⚡ Smart Route: Executing via AMM".

#### 2. Route to Orderbook (`placeOrder`)

- **Trigger**: Book Price is better than AMM Price OR Order is Passive.
- **Function**: `useLimitOrder().placeOrder(outcome, price, amount)`
- **UX**: User sees "📋 Limit orders wait in orderbook".

## 4. Implementation Details

### Variables in `LimitOrderForm.tsx`

```typescript
// 1. Determine Best Book Price
const bestAsk = asks[0] ? parseFloat(asks[0].yesPrice) : null;
const bestBid = bids[0] ? parseFloat(bids[0].yesPrice) : null;

let bestBookPrice = isBuyingYes ? bestAsk : bestBid;

// Invert for display/comparison if viewing the NO side
if (bestBookPrice !== null && outcome === 1) {
  bestBookPrice = 1 - bestBookPrice;
}

// 2. Check Crossing
const isCrossingMarket = currentMarketPrice
  ? orderType === "buy"
    ? priceNum >= currentMarketPrice
    : priceNum <= currentMarketPrice
  : false;

// 3. Compare Venues
const ammIsBetter =
  bestBookPrice === null ||
  (currentMarketPrice !== undefined &&
    (orderType === "buy"
      ? currentMarketPrice < bestBookPrice
      : currentMarketPrice > bestBookPrice));
```

### Handicap Pricing

To encourage liquidity provision inside the spread, the default "Reference Price" in the form is set to the **Orderbook's Best Price** (Handicap), not the AMM price.

- If Buying: Default to Best Ask.
- If Selling: Default to Best Bid.

## 5. Verification Checklist

- [x] **Passive Orders**: Place Buy Limit $0.10 below market -> Uses `placeOrder`.
- [x] **Crossing Orders**: Place Buy Limit $0.10 above market -> Uses `trade` (if AMM cheaper).
- [x] **Empty Book**: Always routes crossing orders to AMM.
- [x] **Sell Side**: Verify 'Sell' logic correctly identifies High Bids as the target.

## 6. Universal Router (Hybrid Execution) - Protocol Implemented

To achieve true "Unified Liquidity" (Split Execution), where a single order can sweep the Orderbook AND fill the remainder from the AMM, the `SoothRouter` contract has been implemented.

### A. Protocol Layer: `SoothRouter.sol`

A stateless helper contract that acts as a facade for the TraderVault to enable atomic execution.

**Features:**

1.  **Atomic Execution**: Performs funds pulling, Orderbook matching, AMM trading, and Share delivery in a single transaction.
2.  **Safety**:
    - **"Fill or Kill"** logic for the Orderbook portion (prevents resting orders that fail to take liquidity).
    - **Decimal Scaling**: Automatically handles conversion between Asset decimals (e.g., USDC 6) and Internal decimals (18).
    - **Refunds**: Automatically refunds any unused USDC to the user.

**Implemented Interface (`contracts/router/SoothRouter.sol`):**

```solidity
interface ISoothRouter {
    struct RouteParams {
        uint256 amountToBook; // 18 decimals
        uint256 amountToAMM;  // 18 decimals
        uint256 limitPrice;   // 18 decimals
        uint256 minOutput;    // Slippage protection (optional/future)
    }

    /**
     * @notice Executing a Hybrid Order
     * 1. Pulls USDC from User (scaled down to asset decimals)
     * 2. Places Fill-or-Kill Limit Order for `amountToBook`
     * 3. Trades against AMM for `amountToAMM`
     * 4. Transfers all acquired shares to User
     * 5. Refunds excess USDC
     */
    function executeHybridOrder(
        address market,
        uint8 outcome,
        RouteParams calldata params
    ) external returns (uint256 totalShares);
}
```

### B. Frontend Layer: Integration Pending

The frontend needs to be updated to utilize the `SoothRouter`.

**Integration Steps:**

1.  **Split Calculation**:
    - Client-side logic to determine `amountToBook` based on `orders` (Orderbook) state.
    - Remainder becomes `amountToAMM`.
2.  **Contract Interaction**:
    - Call `SoothRouter.executeHybridOrder` instead of `TraderVault.trade/placeOrder`.
3.  **Approval Flow**:
    - **Important**: User must `approve` the `SoothRouter` contract for USDC, not just the TraderVault.

### C. Implementation Status

- [x] Create `packages/contracts-evm/contracts/router/SoothRouter.sol`.
- [x] Implement `executeHybridOrder`.
- [x] Add tests in `packages/contracts-evm/test/Router.t.sol` (Verified).
- [ ] Deploy Router to Testnet.
- [ ] Update Frontend `deployments.json` and ABI.
- [ ] Refactor `LimitOrderForm.tsx` to use the Router.
