// LaunchpadEngine ABI — regenerated from deployed bytecode at
// 0xEfe2D076f380649d7B6ACF7C20eEc5d5614D6E0b (Base Sepolia, chain 84532)
// Generated: 2026-04-05 via `cast selectors`
//
// 3 selectors could not be identified and are omitted:
//   0x40790471 — view, no inputs, returns uint256 (604800 = 7 days)
//   0xae1aa989 — nonpayable, takes uint64
//   0xeb26a728 — view, takes (address,address,bytes,uint256,uint64,uint64)

export const LaunchpadEngineABI = [
  // ── Functions ──────────────────────────────────────────────────────

  {
    type: 'function',
    name: 'createMarket',
    inputs: [
      { name: 'question', type: 'string', internalType: 'string' },
      { name: 'startTime', type: 'uint64', internalType: 'uint64' },
      { name: 'deadline', type: 'uint64', internalType: 'uint64' },
      { name: 'adjudicator', type: 'address', internalType: 'address' },
      { name: 'bBase', type: 'uint256', internalType: 'uint256' },
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
      // 0 = binary market, > 0 = scalar-option market (strike S in WAD)
      { name: 'strike', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [
      { name: 'market', type: 'address', internalType: 'address' },
      { name: 'lpToken', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'markets',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'creator', type: 'address', internalType: 'address' },
      { name: 'lpToken', type: 'address', internalType: 'address' },
      { name: 'bBase', type: 'uint256', internalType: 'uint256' },
      {
        name: 'creatorDeposit',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'graduatedAt', type: 'uint64', internalType: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allMarkets',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarkets',
    inputs: [],
    outputs: [{ name: '', type: 'address[]', internalType: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarketCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLPToken',
    inputs: [{ name: 'market', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isGraduated',
    inputs: [{ name: 'market', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isTrialExpiredWithoutGraduation',
    inputs: [{ name: 'market', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'trialEndTimes',
    inputs: [{ name: 'market', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint64', internalType: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'creatorNonce',
    inputs: [{ name: 'creator', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'defaultTrialPeriod',
    inputs: [],
    outputs: [{ name: '', type: 'uint64', internalType: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isPaused',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'notifyGraduation',
    inputs: [{ name: 'market', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setDefaultTrialPeriod',
    inputs: [{ name: 'period', type: 'uint64', internalType: 'uint64' }],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'unpause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── Immutables / Config ────────────────────────────────────────────

  {
    type: 'function',
    name: 'ammEngine',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'feeRouter',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'truthMarketImpl',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'orderEngine',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'adjudicatorRegistry',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'baseToken',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'pure',
  },

  // ── Ownable ────────────────────────────────────────────────────────

  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
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
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── Events ─────────────────────────────────────────────────────────

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

  // ── Errors ─────────────────────────────────────────────────────────

  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotFeeRouter',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AlreadyGraduated',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
  },
  {
    type: 'function',
    name: 'dismissMarket',
    inputs: [{ name: 'market', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimRefund',
    inputs: [{ name: 'market', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'LPRedeemed',
    inputs: [
      { name: 'market', type: 'address', indexed: true, internalType: 'address' },
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      { name: 'usdcAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
] as const;
