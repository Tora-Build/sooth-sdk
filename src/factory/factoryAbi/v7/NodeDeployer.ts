/** GENERATED from historical sooth-factory (now sooth-factory-archive) 1aa5fc80e7e4e14df5a4141c3195fd2ee4b302ef:sdk/abi.json.
 * Interface: sooth-factory-v7; bundle keccak256: 0xbbb80127a1464f7f8a754d71ea4dd825664c9892762b57a880258fd3d090025a.
 * Verified against bundled bytes; historical upstream git objects are not verified.
 * Regenerate with node src/factory/factoryAbi/regenerate.mjs
 */
export const NodeDeployerAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'factory_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'registry_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'releaseId_',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'requestHash_',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'activated',
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
    name: 'committedRequestHash',
    inputs: [],
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
    name: 'complete',
    inputs: [
      {
        name: 'request',
        type: 'tuple',
        internalType: 'struct NodeTypes.Request',
        components: [
          {
            name: 'releaseId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'userSalt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'requester',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'nodeAdmin',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bookToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'ammSurplusRecipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'expiry',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'expectedBookPolicyVersion',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'expectedBookPolicyHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'ammConfig',
            type: 'tuple',
            internalType: 'struct IAmmFeeVault.AmmConfig',
            components: [
              {
                name: 'feeBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'capitalBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'lpBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'resolutionBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'operatorBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'operatorRecipient',
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
        name: 'a',
        type: 'tuple',
        internalType: 'struct NodeTypes.Addresses',
        components: [
          {
            name: 'roles',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'book',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'amm',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'ammVault',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bookVault',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'marketFactory',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'positionManager',
            type: 'address',
            internalType: 'address',
          },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'componentRuntimeHashes',
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
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'deployed',
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
    name: 'factory',
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
    name: 'prepare',
    inputs: [
      {
        name: 'request',
        type: 'tuple',
        internalType: 'struct NodeTypes.Request',
        components: [
          {
            name: 'releaseId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'userSalt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'requester',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'nodeAdmin',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bookToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'ammSurplusRecipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'expiry',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'expectedBookPolicyVersion',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'expectedBookPolicyHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'ammConfig',
            type: 'tuple',
            internalType: 'struct IAmmFeeVault.AmmConfig',
            components: [
              {
                name: 'feeBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'capitalBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'lpBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'resolutionBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'operatorBps',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'operatorRecipient',
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
        name: 'a',
        type: 'tuple',
        internalType: 'struct NodeTypes.Addresses',
        components: [
          {
            name: 'roles',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'book',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'amm',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'ammVault',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'bookVault',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'marketFactory',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'positionManager',
            type: 'address',
            internalType: 'address',
          },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'prepared',
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
    name: 'registry',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract ReleaseRegistry',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'releaseId',
    inputs: [],
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
    name: 'verifyWiring',
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
    type: 'event',
    name: 'RuntimeCodeCommitted',
    inputs: [
      {
        name: 'component',
        type: 'uint8',
        indexed: true,
        internalType: 'uint8',
      },
      {
        name: 'instance',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'runtimeHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AlreadyDeployed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ChildDeploymentFailed',
    inputs: [
      {
        name: 'child',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'InitCodeTooLarge',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidInitialState',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidRelease',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidRequest',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidRuntimeCode',
    inputs: [
      {
        name: 'component',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidWiring',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Unauthorized',
    inputs: [],
  },
] as const;
