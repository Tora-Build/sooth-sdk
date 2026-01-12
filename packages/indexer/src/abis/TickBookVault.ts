export const TickBookVaultAbi = [
  {
    type: "event",
    name: "UsdcDeposited",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "usdcAmountAsset", type: "uint256", indexed: false },
      { name: "usdcAmountWad", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UsdcWithdrawn",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "usdcAmountWad", type: "uint256", indexed: false },
      { name: "usdcAmountAsset", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UsdcReserved",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amountWad", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UsdcReleased",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amountWad", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UsdcSpentToMarket",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "market", type: "address", indexed: true },
      { name: "amountWad", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UsdcSpentFromAvailable",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "market", type: "address", indexed: true },
      { name: "amountWad", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UsdcCredited",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amountWad", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OutcomeCredited",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "sharesWad", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OutcomeLocked",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "sharesWad", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OutcomeUnlocked",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "sharesWad", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OutcomeTransferred",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "sharesWad", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RedeemedResolved",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "payoutWad", type: "uint256", indexed: false },
      { name: "yesBurned", type: "uint256", indexed: false },
      { name: "noBurned", type: "uint256", indexed: false },
    ],
  },
] as const;
