export const TickBookPoolManagerAbi = [
  {
    type: "event",
    name: "MarketRegistered",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "market", type: "address", indexed: false },
      { name: "yesToken", type: "address", indexed: false },
      { name: "noToken", type: "address", indexed: false },
      { name: "hook", type: "address", indexed: false },
    ],
  },
  // V9.9.6 uses OrderPlaced instead of RangeOrderPlaced
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
] as const;
