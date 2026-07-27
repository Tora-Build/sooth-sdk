// SoothBook v0.2.1 — complete ABI (constructor, functions, events, custom errors).
// Vendored from the canonical sooth-core artifact and verified against deployed
// Ethereum Sepolia bytecode at 0x20c0a274aB8D90452859809B3804Ef2cFA595132 on 2026-07-27.
export const SoothBookABI = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_baseToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_orderEngine',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_feeRouter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_registrar',
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
    name: 'buyNo',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'tick',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'amount',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'escrow',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'matchLimit',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'buyYes',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'tick',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'amount',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'escrow',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'matchLimit',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancel',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'side',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'tick',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelById',
    inputs: [
      {
        name: 'orderId',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'getBalance',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'yes',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'no',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBestTick',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'side',
        type: 'uint8',
        internalType: 'uint8',
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
    name: 'getCollateralBacking',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        internalType: 'bytes32',
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
    name: 'getImpliedPrice',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'yesPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'noPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getImpliedPriceByKey',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'yesPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'noPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMinRestingOrder',
    inputs: [
      {
        name: 'tick',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOrdersAtTick',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'side',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'tick',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    outputs: [
      {
        name: 'totalAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'orderCount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPosition',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'yesShares',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'noShares',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isMarketRegistered',
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
    name: 'marketAddresses',
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
    name: 'marketKeys',
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
    name: 'merge',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'amount',
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
    name: 'registerMarketFromEngine',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registeredMarkets',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registrar',
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
    name: 'renounceOwnership',
    inputs: [],
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
    type: 'event',
    name: 'DustOrderSkipped',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'side',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'tick',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'escrow',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Merged',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'user',
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
    type: 'event',
    name: 'Minted',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'user',
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
    type: 'event',
    name: 'OrderCancelled',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'side',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'tick',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'maker',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'orderId',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OrderFilled',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'takerSide',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'yesTick',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'noTick',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'taker',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'maker',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'surplus',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'makerOrderId',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OrderPlaced',
    inputs: [
      {
        name: 'marketKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'side',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'tick',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'maker',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'escrow',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'orderId',
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
  {
    type: 'error',
    name: 'AmountTooSmallForBaseTokenDecimals',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientShares',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidTick',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MarketAlreadyExists',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MarketNotActive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotAuthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderNotActive',
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
    name: 'TickOutOfRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnsupportedBaseTokenDecimals',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroValue',
    inputs: [],
  },
] as const;
