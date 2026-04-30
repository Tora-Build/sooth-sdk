export const AMMEngineABI = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_usdc',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_owner',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimUnlocked',
    inputs: [
      {
        name: 'maxClaims',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'totalUnlocked',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimProtocolFees',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'claimed',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getBalances',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'available',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'locked',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getClaimableAmount',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'claimable',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'nextUnlock',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'nextAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLiquidity',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLockQueue',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'entries',
        type: 'tuple[]',
        internalType: 'struct IAMMEngine.LockEntry[]',
        components: [
          {
            name: 'amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'expiry',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'market',
            type: 'address',
            internalType: 'address',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarketState',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'qYes',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'qNo',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPosition',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'yesShares',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'noShares',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPositionQuote',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'outcome',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'deltaShares',
        type: 'int256',
        internalType: 'int256',
      },
    ],
    outputs: [
      {
        name: 'cost',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'fee',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'netAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'newPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'increaseLiquidity',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'deltaLiquidity',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'initializeMarket',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'initialLiquidity',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'protocolTreasury',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'redeemLP',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'lpAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'tokenAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'router',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setRouter',
    inputs: [
      {
        name: '_router',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'settleLockedProceeds',
    inputs: [
      {
        name: 'maxEntries',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'released',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'voided',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getTradeLog',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'entries',
        type: 'tuple[]',
        internalType: 'struct AMMEngine.TradeEntry[]',
        components: [
          {
            name: 'absDelta',
            type: 'uint128',
            internalType: 'uint128',
          },
          {
            name: 'costOrProceeds',
            type: 'uint128',
            internalType: 'uint128',
          },
          {
            name: 'timestamp',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'outcome',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'isBuy',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'settlePosition',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'payout',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'spendBalanceFor',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'spent',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'tradePositions',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'outcome',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'deltaShares',
        type: 'int256',
        internalType: 'int256',
      },
      {
        name: 'maxCostOrMinProceeds',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'actualCost',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'tradePositionsFor',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'outcome',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'deltaShares',
        type: 'int256',
        internalType: 'int256',
      },
      {
        name: 'maxCostOrMinProceeds',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'fee',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'actualCost',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [
      {
        name: 'newOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'usdc',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC20',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'BalanceUsed',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'remaining',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityIncreased',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'deltaLiquidity',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newLiquidity',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LocksProcessed',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'count',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'totalUnlocked',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionSettled',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'winningOutcome',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'yesShares',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'noShares',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'payout',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionTraded',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'outcome',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'deltaShares',
        type: 'int256',
        indexed: false,
        internalType: 'int256',
      },
      {
        name: 'cost',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newQYes',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newQNo',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProceedsClaimed',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProceedsLocked',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'unlockTime',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RouterUpdated',
    inputs: [
      {
        name: 'router',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WalletPull',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  // ── AMMEngine custom errors (zero-arg) ──────────────────────────────────
  // Mirrored from packages/contracts-core (Tora-Build/sooth-core @ develop)
  // src/AMMEngine.sol so viem can decode reverts surfaced through
  // tradePositions / claim / settle. Without these, viem reports
  // "Encoded error signature 0x… not found on ABI" and the trading panel
  // shows a meaningless decode error instead of the real reason.
  { type: 'error', name: 'ZeroBaseToken', inputs: [] },
  { type: 'error', name: 'ZeroLaunchpadEngine', inputs: [] },
  { type: 'error', name: 'ZeroMarket', inputs: [] },
  { type: 'error', name: 'ZeroLiquidity', inputs: [] },
  { type: 'error', name: 'AlreadyInitialized', inputs: [] },
  { type: 'error', name: 'InvalidMaxClaims', inputs: [] },
  { type: 'error', name: 'NoLocks', inputs: [] },
  { type: 'error', name: 'NoUnlockedProceeds', inputs: [] },
  { type: 'error', name: 'NotFinalized', inputs: [] },
  { type: 'error', name: 'NoPosition', inputs: [] },
  { type: 'error', name: 'InvalidOutcome', inputs: [] },
  { type: 'error', name: 'NotInitialized', inputs: [] },
  { type: 'error', name: 'Paused', inputs: [] },
  { type: 'error', name: 'ZeroDelta', inputs: [] },
  { type: 'error', name: 'MarketNotLive', inputs: [] },
  { type: 'error', name: 'InsufficientYesShares', inputs: [] },
  { type: 'error', name: 'InsufficientNoShares', inputs: [] },
  { type: 'error', name: 'InsufficientMarketYes', inputs: [] },
  { type: 'error', name: 'InsufficientMarketNo', inputs: [] },
  { type: 'error', name: 'CostTooHigh', inputs: [] },
  { type: 'error', name: 'SlippageExceeded', inputs: [] },
  { type: 'error', name: 'NotAuthorized', inputs: [] },
  { type: 'error', name: 'ZeroFeeRouter', inputs: [] },
  { type: 'error', name: 'DeadlinePassed', inputs: [] },
  { type: 'error', name: 'InsufficientLP', inputs: [] },
  { type: 'error', name: 'NothingToClaim', inputs: [] },
  { type: 'error', name: 'LPTokenAlreadySet', inputs: [] },
  { type: 'error', name: 'RedeemNotAvailable', inputs: [] },
  { type: 'error', name: 'ZeroTreasury', inputs: [] },
  { type: 'error', name: 'TrialEndedNotGraduated', inputs: [] },
  { type: 'error', name: 'MustUseRetroactiveSettlement', inputs: [] },
  { type: 'error', name: 'NoSettlementRoot', inputs: [] },
  { type: 'error', name: 'InvalidMerkleProof', inputs: [] },
  { type: 'error', name: 'SettlementRootAlreadyPosted', inputs: [] },
  { type: 'error', name: 'AlreadySettledRetroactive', inputs: [] },
  { type: 'error', name: 'UnsupportedDecimals', inputs: [] },
  { type: 'error', name: 'InsufficientMarketCollateral', inputs: [] },
  { type: 'error', name: 'InvalidLockDuration', inputs: [] },
] as const;
