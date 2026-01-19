export const TickBookPoolManagerAbi = [
  {
    type: "event",
    name: "MarketRegistered",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "market", type: "address", indexed: false },
      { name: "yesToken", type: "address", indexed: false },
      { name: "noToken", type: "address", indexed: false },
    ],
  },
  // V10: RangeOrderPlaced (may exist on older deployments)
  {
    type: "event",
    name: "RangeOrderPlaced",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "orderId", type: "uint256", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "tickLower", type: "uint16", indexed: false },
      { name: "tickUpper", type: "uint16", indexed: false },
      { name: "liquidity", type: "uint256", indexed: false },
      { name: "collateralReserved", type: "uint256", indexed: false },
      { name: "crossingFilled", type: "uint256", indexed: false },
      { name: "crossingCost", type: "uint256", indexed: false },
    ],
  },
  // V10: OrderPlaced (current primary event)
  {
    type: "event",
    name: "OrderPlaced",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "orderId", type: "uint256", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "tickLower", type: "uint16", indexed: false },
      { name: "tickUpper", type: "uint16", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
      { name: "filledShares", type: "uint256", indexed: false },
      { name: "filledCost", type: "uint256", indexed: false },
      { name: "restingShares", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RangeOrderCancelled",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "orderId", type: "uint256", indexed: true },
      { name: "collateralReleased", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RangeOrderClosed",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "orderId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "MarketOrderFilled",
    inputs: [
      { name: "taker", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "sharesRequested", type: "uint256", indexed: false },
      { name: "sharesFilled", type: "uint256", indexed: false },
      { name: "totalCost", type: "uint256", indexed: false },
      { name: "startTick", type: "uint16", indexed: false },
      { name: "endTick", type: "uint16", indexed: false },
      { name: "refunded", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OrdersCrossed",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "newOrderId", type: "uint256", indexed: false },
      { name: "newOutcome", type: "uint8", indexed: false },
      { name: "crossedShares", type: "uint256", indexed: false },
      { name: "newOrderCost", type: "uint256", indexed: false },
      { name: "oppositeOrderCost", type: "uint256", indexed: false },
      { name: "crossTick", type: "uint16", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FillsClaimed",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "orderId", type: "uint256", indexed: true },
      { name: "filledShares", type: "uint256", indexed: false },
      { name: "collateralUsedWad", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TickCrossed",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "tick", type: "uint16", indexed: false },
      { name: "liquidityDelta", type: "int128", indexed: false },
    ],
  },
  // V9.9.7: Spot Sell Events
  {
    type: "event",
    name: "SpotSellPlaced",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "sellId", type: "uint256", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "tickLower", type: "uint16", indexed: false },
      { name: "tickUpper", type: "uint16", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SpotSellCancelled",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "sellId", type: "uint256", indexed: true },
      { name: "sharesReturned", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SpotSellFilled",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "sellId", type: "uint256", indexed: true },
      { name: "sharesFilled", type: "uint256", indexed: false },
      { name: "proceeds", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SpotSellClosed",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "sellId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "UserOrderRemoved",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "orderId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UserSpotSellRemoved",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "sellId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SpotSellIdRemovedAtTick",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "tick", type: "uint16", indexed: false },
      { name: "sellId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TotalLiquidityReduced",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "previousTotal", type: "uint256", indexed: false },
      { name: "newTotal", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ActiveLiquidityUpdated",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "previousActive", type: "uint128", indexed: false },
      { name: "newActive", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PendingRefundsCleared",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PooledRefundsClaimed",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "refund", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AutoClaimExecuted",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "ordersClaimed", type: "uint256", indexed: false },
      { name: "totalShares", type: "uint256", indexed: false },
      { name: "totalCollateralUsed", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UnifiedCrossing",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "newOrderId", type: "uint256", indexed: true },
      { name: "newOutcome", type: "uint8", indexed: false },
      { name: "spotFilled", type: "uint256", indexed: false },
      { name: "rangeFilled", type: "uint256", indexed: false },
      { name: "spotCost", type: "uint256", indexed: false },
      { name: "rangeCost", type: "uint256", indexed: false },
      { name: "crossTick", type: "uint16", indexed: false },
    ],
  },
] as const;
