/** GENERATED from historical sooth-factory (now sooth-factory-archive) 9edac2036184bb5860b958fb739d5698f0e2afa4:sdk/abi.json.
 * Interface: sooth-factory-v7.1; bundle keccak256: 0x45eff5ba71a0edb8bcc1a4a8146f1450b7db7b8ce34371d4e8b53f8317642869.
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
