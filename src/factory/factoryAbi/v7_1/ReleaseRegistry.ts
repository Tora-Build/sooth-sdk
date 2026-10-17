/** GENERATED from sooth-factory 9edac2036184bb5860b958fb739d5698f0e2afa4:sdk/abi.json.
 * Interface: sooth-factory-v7.1; bundle keccak256: 0x45eff5ba71a0edb8bcc1a4a8146f1450b7db7b8ce34371d4e8b53f8317642869.
 * Regenerate with node src/factory/factoryAbi/regenerate.mjs /path/to/sooth-factory
 */
export const ReleaseRegistryAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'owner_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptProtocolOwner',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'activeBookPolicyVersion',
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
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bookPolicy',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
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
        internalType: 'struct NodeTypes.BookPolicy',
        components: [
          {
            name: 'protocolAuthority',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bookSurplusRecipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'maxBookFeeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'bookConfig',
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bookPolicyHash',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
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
    name: 'cancelProtocolOwnerTransfer',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'creationCode',
    inputs: [
      {
        name: 'releaseId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'child',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'creationCodeHash',
    inputs: [
      {
        name: 'releaseId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'child',
        type: 'uint8',
        internalType: 'uint8',
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
    name: 'pendingProtocolOwner',
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
    name: 'proposeProtocolOwner',
    inputs: [
      {
        name: 'next',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'protocolOwner',
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
    name: 'publishBookPolicy',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'policy',
        type: 'tuple',
        internalType: 'struct NodeTypes.BookPolicy',
        components: [
          {
            name: 'protocolAuthority',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bookSurplusRecipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'maxBookFeeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'bookConfig',
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
    name: 'publishRelease',
    inputs: [
      {
        name: 'releaseId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'sourceRevision',
        type: 'bytes20',
        internalType: 'bytes20',
      },
      {
        name: 'manifestHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'truthImplementation',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'deployerCreationHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'code',
        type: 'tuple[6]',
        internalType: 'struct ReleaseRegistry.CodeInput[6]',
        components: [
          {
            name: 'chunks',
            type: 'address[]',
            internalType: 'address[]',
          },
          {
            name: 'creationHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'length',
            type: 'uint32',
            internalType: 'uint32',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'release',
    inputs: [
      {
        name: 'releaseId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct ReleaseRegistry.Release',
        components: [
          {
            name: 'exists',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'revoked',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'sourceRevision',
            type: 'bytes20',
            internalType: 'bytes20',
          },
          {
            name: 'manifestHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'truthImplementation',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'truthCodeHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'deployerCreationHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'revokeRelease',
    inputs: [
      {
        name: 'releaseId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setStablecoin',
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
    name: 'supportedStablecoins',
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
    name: 'validateActiveBookPolicy',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'version',
        type: 'uint32',
        internalType: 'uint32',
      },
      {
        name: 'expectedHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct NodeTypes.BookPolicy',
        components: [
          {
            name: 'protocolAuthority',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bookSurplusRecipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'maxBookFeeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'bookConfig',
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'validateBookPolicy',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'version',
        type: 'uint32',
        internalType: 'uint32',
      },
      {
        name: 'expectedHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct NodeTypes.BookPolicy',
        components: [
          {
            name: 'protocolAuthority',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bookSurplusRecipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'maxBookFeeBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'bookConfig',
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
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'BookPolicyPublished',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'version',
        type: 'uint32',
        indexed: true,
        internalType: 'uint32',
      },
      {
        name: 'policyHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolOwnerProposed',
    inputs: [
      {
        name: 'current',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'proposed',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolOwnerTransferred',
    inputs: [
      {
        name: 'previous',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'current',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ReleasePublished',
    inputs: [
      {
        name: 'releaseId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'sourceRevision',
        type: 'bytes20',
        indexed: false,
        internalType: 'bytes20',
      },
      {
        name: 'manifestHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ReleaseRevoked',
    inputs: [
      {
        name: 'releaseId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'StablecoinAdmission',
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
    name: 'InvalidBookPolicy',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidCode',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidRelease',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StaleBookPolicy',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Unauthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
] as const;
