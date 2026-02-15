export const SoothBookAbi = [
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "collateral", type: "address", indexed: false },
      { name: "yesToken", type: "address", indexed: false },
      { name: "noToken", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OrderPlaced",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "side", type: "uint8", indexed: false },
      { name: "tick", type: "uint16", indexed: false },
      { name: "maker", type: "address", indexed: true },
      { name: "amount", type: "uint128", indexed: false },
      { name: "escrow", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OrderFilled",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "takerSide", type: "uint8", indexed: false },
      { name: "yesTick", type: "uint16", indexed: false },
      { name: "noTick", type: "uint16", indexed: false },
      { name: "taker", type: "address", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "amount", type: "uint128", indexed: false },
      { name: "surplus", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OrderCancelled",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "side", type: "uint8", indexed: false },
      { name: "tick", type: "uint16", indexed: false },
      { name: "maker", type: "address", indexed: true },
      { name: "amount", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Minted",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Merged",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Redeemed",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MarketResolved",
    inputs: [
      { name: "marketKey", type: "bytes32", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
    ],
  },
] as const;
