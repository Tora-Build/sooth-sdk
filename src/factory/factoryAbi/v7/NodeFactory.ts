/** GENERATED from historical sooth-factory (now sooth-factory-archive) 1aa5fc80e7e4e14df5a4141c3195fd2ee4b302ef:sdk/abi.json.
 * Interface: sooth-factory-v7; bundle keccak256: 0xbbb80127a1464f7f8a754d71ea4dd825664c9892762b57a880258fd3d090025a.
 * Verified against bundled bytes; historical upstream git objects are not verified.
 * Regenerate with node src/factory/factoryAbi/regenerate.mjs
 */
export const NodeFactoryAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'registry_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approveRequest',
    inputs: [
      {
        name: 'hash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approvedRequests',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
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
    name: 'beginNode',
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
        name: 'id',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'deployer',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'completeNode',
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
        name: 'id',
        type: 'bytes32',
        internalType: 'bytes32',
      },
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
    name: 'nodeCount',
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
    name: 'nodeDeployer',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
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
    name: 'nodeId',
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
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nodeIdAt',
    inputs: [
      {
        name: 'index',
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
    name: 'pendingDeployer',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
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
    name: 'pendingRequestHash',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
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
    name: 'predictNode',
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
        name: 'deployer',
        type: 'address',
        internalType: 'address',
      },
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
    name: 'requestHash',
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
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'revokeRequest',
    inputs: [
      {
        name: 'hash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'NodeCreated',
    inputs: [
      {
        name: 'nodeId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'releaseId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'nodeAdmin',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'protocolAuthority',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'bookToken',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'deployer',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'roles',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'book',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'amm',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'ammVault',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'bookVault',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'marketFactory',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'NodePrepared',
    inputs: [
      {
        name: 'nodeId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'requestHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'deployer',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RequestApproval',
    inputs: [
      {
        name: 'authority',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'requestHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'approved',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
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
    name: 'NodeAlreadyExists',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Unauthorized',
    inputs: [],
  },
] as const;
