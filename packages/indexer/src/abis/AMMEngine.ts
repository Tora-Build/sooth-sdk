export const AMMEngineAbi = [
  {
    type: "event",
    name: "PositionTraded",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "market", type: "address", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "deltaShares", type: "int256", indexed: false },
      { name: "cost", type: "uint256", indexed: false },
      { name: "newQYes", type: "uint256", indexed: false },
      { name: "newQNo", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProceedsLocked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "market", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "unlockTime", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BalanceCredited",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newAvailableBalance", type: "uint256", indexed: false },
      { name: "newLockedBalance", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LockedBalanceReduced",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newLockedBalance", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LockEntryRemoved",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "market", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "unlockTime", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProceedsClaimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "market", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LocksProcessed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "count", type: "uint256", indexed: false },
      { name: "totalUnlocked", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PositionSettled",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "market", type: "address", indexed: true },
      { name: "winningOutcome", type: "uint8", indexed: false },
      { name: "yesShares", type: "uint256", indexed: false },
      { name: "noShares", type: "uint256", indexed: false },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RouterUpdated",
    inputs: [
      { name: "router", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "BalanceUsed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newAvailableBalance", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WalletPull",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LiquidityIncreased",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "deltaLiquidity", type: "uint256", indexed: false },
      { name: "newLiquidity", type: "uint256", indexed: false },
    ],
  },
] as const;
