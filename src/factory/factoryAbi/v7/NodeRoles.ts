/** GENERATED from historical sooth-factory (now sooth-factory-archive) 1aa5fc80e7e4e14df5a4141c3195fd2ee4b302ef:sdk/abi.json.
 * Interface: sooth-factory-v7; bundle keccak256: 0xbbb80127a1464f7f8a754d71ea4dd825664c9892762b57a880258fd3d090025a.
 * Verified against bundled bytes; historical upstream git objects are not verified.
 * Regenerate with node src/factory/factoryAbi/regenerate.mjs
 */
export const NodeRolesAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'admin_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'authority_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'activationGate_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptNodeAdmin',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptProtocolAuthority',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'activationGate',
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
    name: 'cancelNodeAdminTransfer',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelProtocolAuthorityTransfer',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'nodeAdmin',
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
    name: 'pendingNodeAdmin',
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
    name: 'pendingProtocolAuthority',
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
    name: 'proposeNodeAdmin',
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
    name: 'proposeProtocolAuthority',
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
    name: 'protocolAuthority',
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
    name: 'NodeAdminProposed',
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
    name: 'NodeAdminTransferred',
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
    name: 'ProtocolAuthorityProposed',
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
    name: 'ProtocolAuthorityTransferred',
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
    type: 'error',
    name: 'NodeNotActive',
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
