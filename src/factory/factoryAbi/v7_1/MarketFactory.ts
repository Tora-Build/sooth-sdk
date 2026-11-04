/** GENERATED from historical sooth-factory (now sooth-factory-archive) 9edac2036184bb5860b958fb739d5698f0e2afa4:sdk/abi.json.
 * Interface: sooth-factory-v7.1; bundle keccak256: 0x45eff5ba71a0edb8bcc1a4a8146f1450b7db7b8ce34371d4e8b53f8317642869.
 * Verified against bundled bytes; historical upstream git objects are not verified.
 * Regenerate with node src/factory/factoryAbi/regenerate.mjs
 */
export const MarketFactoryAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'truth_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amm_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'ammVault_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'book_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'bookVault_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'roles_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'admittedProfileHash',
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
    name: 'allowedCreators',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowedTokens',
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
        type: 'bool',
        internalType: 'bool',
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
    name: 'ammFeeVault',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAmmFeeVault',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bookFeeVault',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IBookFeeVault',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'createMarket',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IMarketFactory.MarketParams',
        components: [
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
            name: 'tokenA',
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
          {
            name: 'maxInputNative',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'quoteDeadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'expectedAmmVersion',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'expectedBookVersion',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'expectedAmmHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'expectedBookHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'resolutionTermsHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'expectedProfileHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'expectedInvalidationBuffer',
            type: 'uint64',
            internalType: 'uint64',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'lpPositionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'creationPaused',
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
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'hashMarketTerms',
    inputs: [
      {
        name: 'creator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IMarketFactory.MarketParams',
        components: [
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
            name: 'tokenA',
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
          {
            name: 'maxInputNative',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'quoteDeadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'expectedAmmVersion',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'expectedBookVersion',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'expectedAmmHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'expectedBookHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'resolutionTermsHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'expectedProfileHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'expectedInvalidationBuffer',
            type: 'uint64',
            internalType: 'uint64',
          },
        ],
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
    name: 'isPaused',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'marketTermsHash',
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
        name: 'lpPositionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'tokenA',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'tokenADecimals',
        type: 'uint8',
        internalType: 'uint8',
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
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nodeRoles',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract INodeRoles',
      },
    ],
    stateMutability: 'view',
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
    name: 'permissionlessCreation',
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
    name: 'predictMarketAddress',
    inputs: [
      {
        name: 'creator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IMarketFactory.MarketParams',
        components: [
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
            name: 'tokenA',
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
          {
            name: 'maxInputNative',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'quoteDeadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'expectedAmmVersion',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'expectedBookVersion',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'expectedAmmHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'expectedBookHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'resolutionTermsHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'expectedProfileHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'expectedInvalidationBuffer',
            type: 'uint64',
            internalType: 'uint64',
          },
        ],
      },
      {
        name: 'nonce',
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
    name: 'setAdjudicatorAllowed',
    inputs: [
      {
        name: 'adjudicator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allowed',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setCreationPaused',
    inputs: [
      {
        name: 'paused',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setCreatorAllowed',
    inputs: [
      {
        name: 'creator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allowed',
        type: 'bool',
        internalType: 'bool',
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
    name: 'setPermissionlessCreation',
    inputs: [
      {
        name: 'allowed',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setTokenAllowed',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allowed',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
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
    type: 'event',
    name: 'CreationPauseSet',
    inputs: [
      {
        name: 'paused',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CreatorAdmission',
    inputs: [
      {
        name: 'creator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'allowed',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
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
        name: 'lpPositionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketCommitted',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'termsHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'profileHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'ammVersion',
        type: 'uint32',
        indexed: false,
        internalType: 'uint32',
      },
      {
        name: 'bookVersion',
        type: 'uint32',
        indexed: false,
        internalType: 'uint32',
      },
      {
        name: 'ammHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'bookHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
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
        name: 'tokenA',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'tokenADecimals',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
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
        name: 'lpPositionId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
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
    name: 'PermissionlessCreationSet',
    inputs: [
      {
        name: 'allowed',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProfileAdmission',
    inputs: [
      {
        name: 'adjudicator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'profileHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TokenAdmission',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'allowed',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
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
    name: 'CreationClosed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Domain',
    inputs: [],
  },
  {
    type: 'error',
    name: 'FailedDeployment',
    inputs: [],
  },
  {
    type: 'error',
    name: 'FundingLimit',
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
    name: 'InvalidAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidBuffer',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidProfile',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSchedule',
    inputs: [],
  },
  {
    type: 'error',
    name: 'QuoteExpired',
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
    name: 'StaleConfig',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TokenNotAllowed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TransferAmountMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Unauthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnsupportedDecimals',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroLiquidity',
    inputs: [],
  },
] as const;
