export const LaunchpadEngineAbi = [
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "initialLiquidity", type: "uint256", indexed: false },
      { name: "deposit", type: "uint256", indexed: false },
      { name: "lpTokens", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MarketGraduated",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "totalFeesAccrued", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PositionTraded",
    inputs: [
      { name: "trader", type: "address", indexed: true },
      { name: "market", type: "address", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "deltaShares", type: "int256", indexed: false },
      { name: "cost", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LPRedeemed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "market", type: "address", indexed: true },
      { name: "lpAmount", type: "uint256", indexed: false },
      { name: "usdcAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LiquidityIncreased",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "lpTokens", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FeeDistributedPreGrad",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "totalFee", type: "uint256", indexed: false },
      { name: "toBBase", type: "uint256", indexed: false },
      { name: "lpTokensMinted", type: "uint256", indexed: false },
      { name: "trader", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "FeeDistributedPostGrad",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "totalFee", type: "uint256", indexed: false },
      { name: "toBBase", type: "uint256", indexed: false },
      { name: "toLPYield", type: "uint256", indexed: false },
      { name: "toProtocol", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LPBalanceUpdated",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "delta", type: "int256", indexed: false },
      { name: "newBalance", type: "uint256", indexed: false },
      { name: "totalSupply", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LPYieldPoolUpdated",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "amountUsdc", type: "uint256", indexed: false },
      { name: "newTotal", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FeesAccrued",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "amountUsdc", type: "uint256", indexed: false },
      { name: "totalAccrued", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BaseLiquidityIncreased",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "amountWad", type: "uint256", indexed: false },
      { name: "newBBase", type: "uint256", indexed: false },
      { name: "newBCurrent", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GraduationProgressUpdated",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "feesAccruedWad", type: "uint256", indexed: false },
      { name: "thresholdWad", type: "uint256", indexed: false },
    ],
  },
] as const;
