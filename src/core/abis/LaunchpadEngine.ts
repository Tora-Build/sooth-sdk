// LaunchpadEngine v0.2.1 — complete ABI (constructor, functions, events, custom errors).
// Vendored from the canonical sooth-core artifact and verified against deployed
// Ethereum Sepolia bytecode at 0x8B44C61692461496043257f1605E8Af73Dcd952b on 2026-07-27.
export const LaunchpadEngineABI = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_baseToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_truthMarketImpl',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_adjudicatorRegistry',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_ammEngine',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_feeRouter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_orderEngine',
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
    name: 'adjudicatorRegistry',
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
    name: 'allMarkets',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'ammEngine',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAMMEngine',
      },
    ],
    stateMutability: 'view',
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
    name: 'createMarket',
    inputs: [
      {
        name: 'question',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'startTime',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'deadline',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'adjudicator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'bBase',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'initialProbabilityWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'adjudicatorConfig',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
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
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'creatorNonce',
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
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'defaultTrialPeriod',
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
    name: 'getLPToken',
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
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarketCount',
    inputs: [],
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
    name: 'getMarkets',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address[]',
        internalType: 'address[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'invalidationBuffer',
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
    name: 'isGraduated',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isPaused',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isTrialExpiredWithoutGraduation',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'markets',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'creator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'lpToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'bBase',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'creatorDeposit',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'graduatedAt',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'notifyGraduation',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
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
        internalType: 'contract IOrderEngine',
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
    name: 'pause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'predictMarketAddress',
    inputs: [
      {
        name: '_creator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_adjudicator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_question',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'nonce',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_startTime',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: '_deadline',
        type: 'uint64',
        internalType: 'uint64',
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
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setDefaultTrialPeriod',
    inputs: [
      {
        name: 'period',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setInvalidationBuffer',
    inputs: [
      {
        name: 'buffer',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [],
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
    name: 'trialEndTimes',
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
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'truthMarketImpl',
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
    name: 'unpause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'DefaultTrialPeriodUpdated',
    inputs: [
      {
        name: 'period',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'InvalidationBufferUpdated',
    inputs: [
      {
        name: 'buffer',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LPTokenCreated',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'lpToken',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketCreated',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'creator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'question',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
      {
        name: 'startTime',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'deadline',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'bBase',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'adjudicator',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'lpToken',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'nonce',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketGraduated',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'timestamp',
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
    name: 'ProtocolPaused',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolUnpaused',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AlreadyGraduated',
    inputs: [],
  },
  {
    type: 'error',
    name: 'CloneArgumentsTooLong',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Create2EmptyBytecode',
    inputs: [],
  },
  {
    type: 'error',
    name: 'DeadlineInPast',
    inputs: [],
  },
  {
    type: 'error',
    name: 'DepositTooSmall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'FailedDeployment',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientBalance',
    inputs: [
      {
        name: 'balance',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'needed',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidBuffer',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidProbability',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidTrialPeriod',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NegativeInput',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NonPositiveInput',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotApprovedAdjudicator',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotFeeRouter',
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
    name: 'StartAfterDeadline',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StartInPast',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAdjudicator',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroBaseToken',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroLiquidity',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroTruthMarketImpl',
    inputs: [],
  },
] as const;
