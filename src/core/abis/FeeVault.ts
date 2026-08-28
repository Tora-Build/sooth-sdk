// FeeVault v0.4.0 — complete ABI (constructor, functions, events, custom errors).
// Vendored from the canonical sooth-core artifact at 59e1658 (solc 0.8.33) and
// verified against the deployed CREATE3 address
// 0x71054f3E009A422518dF59dce07e189296394CA2 (Ethereum Sepolia + MegaETH
// Testnet, 2026-08-28): local creation bytecode is a byte-for-byte prefix of
// the on-chain init code, and the source is Etherscan-verified on both chains.
// FeeVault replaces FeeRouter on core >= 0.4.0 (dual-token venues, versioned
// MarketFeeConfig, per-bucket claim accounting). FeeRouterABI remains for the
// 0.2.1 nodes.
export const FeeVaultABI = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_ammEngine',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_orderEngine',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_launchpadEngine',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_treasury',
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
    name: 'accountOf',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'bucket',
        type: 'uint8',
        internalType: 'enum IFeeVault.Bucket',
      },
      {
        name: 'token',
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
    name: 'activeConfigVersion',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'activeGraduationBps',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint16',
        internalType: 'uint16',
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
        internalType: 'address',
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
      {
        name: 'token',
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
    name: 'claimLPDividend',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'token',
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
      {
        name: 'token',
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
    name: 'configOf',
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
        type: 'tuple',
        internalType: 'struct IFeeVault.MarketFeeConfig',
        components: [
          {
            name: 'preGradFeeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'postGradFeeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'graduationBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'deadlineCap',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'topUpsEnabled',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'ammToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bookToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'ammSplitBps',
            type: 'uint16[4]',
            internalType: 'uint16[4]',
          },
          {
            name: 'bookSplitBps',
            type: 'uint16[4]',
            internalType: 'uint16[4]',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeBpsOf',
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
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'finalize',
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
    name: 'graduationProgress',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'accruedWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'thresholdWad',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isMintingOpen',
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
    name: 'launchpadEngine',
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
    name: 'lpEntitlementOf',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'holder',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'token',
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
    name: 'marketState',
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
        type: 'uint8',
        internalType: 'enum IFeeVault.MarketState',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'notifyDeposit',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'venue',
        type: 'uint8',
        internalType: 'enum IFeeVault.Venue',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'preBalance',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'credited',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'notifyLPBurn',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'holder',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'lpAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'supplyBeforeBurn',
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
    name: 'publishConfig',
    inputs: [
      {
        name: 'config',
        type: 'tuple',
        internalType: 'struct IFeeVault.MarketFeeConfig',
        components: [
          {
            name: 'preGradFeeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'postGradFeeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'graduationBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'deadlineCap',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'topUpsEnabled',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'ammToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bookToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'ammSplitBps',
            type: 'uint16[4]',
            internalType: 'uint16[4]',
          },
          {
            name: 'bookSplitBps',
            type: 'uint16[4]',
            internalType: 'uint16[4]',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'version',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registerMarket',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'graduationThresholdWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'supportsTStarSnapshot',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [],
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
    name: 'reportPreGradFee',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'feeWad',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'graduated',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'supportsTStarSnapshotOf',
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
    name: 'sweepSurplus',
    inputs: [
      {
        name: 'token',
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
    name: 'totalLiabilitiesOf',
    inputs: [
      {
        name: 'token',
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
    name: 'treasury',
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
    type: 'event',
    name: 'Claimed',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'bucket',
        type: 'uint8',
        indexed: true,
        internalType: 'enum IFeeVault.Bucket',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'account',
        type: 'address',
        indexed: false,
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
    name: 'ConfigPublished',
    inputs: [
      {
        name: 'version',
        type: 'uint32',
        indexed: true,
        internalType: 'uint32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'DepositShortfall',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'venue',
        type: 'uint8',
        indexed: true,
        internalType: 'enum IFeeVault.Venue',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'expected',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'credited',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeeDistributed',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'venue',
        type: 'uint8',
        indexed: true,
        internalType: 'enum IFeeVault.Venue',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'bucket',
        type: 'uint8',
        indexed: false,
        internalType: 'enum IFeeVault.Bucket',
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
    name: 'GraduationTriggered',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'accruedWad',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'thresholdWad',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LPBurnRecorded',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'holder',
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
        name: 'supplyBeforeBurn',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketFinalized',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'settlementKind',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'adjudicatorRedirected',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketRegistered',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'configVersion',
        type: 'uint32',
        indexed: true,
        internalType: 'uint32',
      },
      {
        name: 'graduationThresholdWad',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'supportsTStarSnapshot',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
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
    name: 'SurplusSwept',
    inputs: [
      {
        name: 'token',
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
    name: 'AdjudicatorRedirected',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AlreadyGraduated',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AlreadyRegistered',
    inputs: [],
  },
  {
    type: 'error',
    name: 'DeadlineBeyondCap',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InfiniteDeadline',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidConfig',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidToken',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoActiveConfig',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotAuthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotFinalizable',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotRegistered',
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
] as const;
