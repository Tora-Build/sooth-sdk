/** GENERATED from sooth-factory 1aa5fc80e7e4e14df5a4141c3195fd2ee4b302ef:sdk/abi.json.
 * Interface: sooth-factory-v7; bundle keccak256: 0xbbb80127a1464f7f8a754d71ea4dd825664c9892762b57a880258fd3d090025a.
 * Regenerate with node src/factory/factoryAbi/regenerate.mjs /path/to/sooth-factory
 */
export const BookFeeVaultAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'init',
        type: 'tuple',
        internalType: 'struct IBookFeeVault.Init',
        components: [
          {
            name: 'engine',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'marketFactory',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'roles',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'baseToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'surplusRecipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'maxFeeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'initialConfig',
            type: 'tuple',
            internalType: 'struct IBookFeeVault.BookConfig',
            components: [
              {
                name: 'feeBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'resolutionBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'protocolBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'protocolRecipient',
                type: 'address',
                internalType: 'address',
              },
            ],
          },
        ],
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
        internalType: 'enum IBookFeeVault.Bucket',
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
    name: 'baseToken',
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
    name: 'baseTokenDecimals',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
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
    name: 'claimResolutionFees',
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
    name: 'claimTimeoutRefund',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'payer',
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
    name: 'configByVersion',
    inputs: [
      {
        name: 'version',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IBookFeeVault.BookConfig',
        components: [
          {
            name: 'feeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'resolutionBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'protocolBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'protocolRecipient',
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
    name: 'configHash',
    inputs: [
      {
        name: 'version',
        type: 'uint32',
        internalType: 'uint32',
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
        internalType: 'struct IBookFeeVault.BookConfig',
        components: [
          {
            name: 'feeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'resolutionBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'protocolBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'protocolRecipient',
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
    name: 'depositRevenue',
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
      {
        name: 'feePayer',
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
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'engine',
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
    name: 'marketConfigVersion',
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
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'marketFactory',
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
    name: 'marketLiabilitiesOf',
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
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'maxFeeBps',
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
    name: 'publishBookConfig',
    inputs: [
      {
        name: 'config',
        type: 'tuple',
        internalType: 'struct IBookFeeVault.BookConfig',
        components: [
          {
            name: 'feeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'resolutionBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'protocolBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'protocolRecipient',
            type: 'address',
            internalType: 'address',
          },
        ],
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'refundableResolutionOf',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'payer',
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
    name: 'registerMarket',
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
      {
        name: 'decimals',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'expectedVersion',
        type: 'uint32',
        internalType: 'uint32',
      },
      {
        name: 'resolutionRecipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'roles',
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
    name: 'surplusRecipient',
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
    name: 'sweepUnattributedSurplus',
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
    name: 'venue',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
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
        name: 'venue',
        type: 'uint8',
        indexed: true,
        internalType: 'uint8',
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
        internalType: 'uint8',
      },
      {
        name: 'recipient',
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
      {
        name: 'configHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
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
        internalType: 'uint8',
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
        internalType: 'uint8',
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
    name: 'MarketFinalized',
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
        internalType: 'uint8',
      },
      {
        name: 'settlementKind',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
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
        name: 'venue',
        type: 'uint8',
        indexed: true,
        internalType: 'uint8',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'configVersion',
        type: 'uint32',
        indexed: false,
        internalType: 'uint32',
      },
      {
        name: 'resolutionRecipient',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RevenueDeposited',
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
        internalType: 'uint8',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'feePayer',
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
    name: 'SurplusSwept',
    inputs: [
      {
        name: 'venue',
        type: 'uint8',
        indexed: true,
        internalType: 'uint8',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'recipient',
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
    name: 'AlreadyRegistered',
    inputs: [],
  },
  {
    type: 'error',
    name: 'DepositAmountMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Insolvent',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidConfig',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidPhase',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidToken',
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
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ResolutionForfeited',
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
    name: 'TransferAmountMismatch',
    inputs: [],
  },
] as const;
