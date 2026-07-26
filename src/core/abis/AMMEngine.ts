// AMMEngine v0.2.1 — complete ABI (constructor, functions, events, custom errors).
// Vendored from the canonical sooth-core artifact and verified against deployed
// Ethereum Sepolia bytecode at 0x1Bab97dBCE105E8715A29B33cd18F0d8B9871383 on 2026-07-27.
export const AMMEngineABI = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_baseToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_launchpadEngine',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_orderEngine',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_feeRouter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_lockDuration',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'baseToken',
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
    type: 'function',
    name: 'claimAdjudicatorFees',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'amount',
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
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'feeRouter',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IFeeRouter',
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
    name: 'getMarketCollateral',
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
    name: 'getMarketLockedLiability',
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
    name: 'getPendingLocks',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'totalLocked',
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
    name: 'increaseLiquidityFromCreator',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'additionalB',
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
      {
        name: 'initialQYes',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'initialQNo',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'creatorDeposit',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'launchpadEngine',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract ILaunchpadEngine',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lockDuration',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lpTokens',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
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
    name: 'mintLPTokens',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'orderEngine',
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
    name: 'postSettlementRoot',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'merkleRoot',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'recordOrderEngineFeeRevenue',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'setLPToken',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'lpToken',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setProtocolTreasury',
    inputs: [
      {
        name: 'treasury',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'settlePositionRetroactive',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'adjustedPayout',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'merkleProof',
        type: 'bytes32[]',
        internalType: 'bytes32[]',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'settlementRoots',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
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
    type: 'event',
    name: 'AdjudicatorFeesClaimed',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'adjudicator',
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
    name: 'InvalidatedLiabilityRestored',
    inputs: [
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
    name: 'LPMinted',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'to',
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
        name: 'newTotalSupply',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LPRedeemed',
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
        name: 'lpAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'tokenAmount',
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
    name: 'LiquidityIncreasedFromCreator',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'additionalB',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'depositRequired',
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
    name: 'LockEntryRemoved',
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
    name: 'LockEntryVoided',
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
        name: 'expiry',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
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
    name: 'MarketInitialized',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'initialLiquidity',
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
    name: 'PositionSettledRetroactive',
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
        name: 'adjustedPayout',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'reclaimedLocks',
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
    name: 'ProtocolFeesClaimed',
    inputs: [
      {
        name: 'treasury',
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
    name: 'ProtocolTreasuryUpdated',
    inputs: [
      {
        name: 'treasury',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SettlementRootPosted',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'merkleRoot',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AlreadySettledRetroactive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'CostTooHigh',
    inputs: [],
  },
  {
    type: 'error',
    name: 'DeadlinePassed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientLP',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientMarketCollateral',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientMarketNo',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientMarketYes',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientNoShares',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientYesShares',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidLockDuration',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidMaxClaims',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidMerkleProof',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidOutcome',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LPTokenAlreadySet',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MarketNotLive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MustUseRetroactiveSettlement',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NegativeCost',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NegativeInput',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoLocks',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoPosition',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoSettlementRoot',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoUnlockedProceeds',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NonPositiveInput',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotAuthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotFinalized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NothingToClaim',
    inputs: [],
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
    name: 'Paused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'RedeemNotAvailable',
    inputs: [],
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
  {
    type: 'error',
    name: 'SettlementRootAlreadyPosted',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SlippageExceeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TrialEndedNotGraduated',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnsupportedDecimals',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroBaseToken',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroDelta',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroFeeRouter',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroLaunchpadEngine',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroLiquidity',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroMarket',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroOrderEngine',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroTreasury',
    inputs: [],
  },
] as const;
