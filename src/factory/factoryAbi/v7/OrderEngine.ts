/** GENERATED from historical sooth-factory (now sooth-factory-archive) 1aa5fc80e7e4e14df5a4141c3195fd2ee4b302ef:sdk/abi.json.
 * Interface: sooth-factory-v7; bundle keccak256: 0xbbb80127a1464f7f8a754d71ea4dd825664c9892762b57a880258fd3d090025a.
 * Verified against bundled bytes; historical upstream git objects are not verified.
 * Regenerate with node src/factory/factoryAbi/regenerate.mjs
 */
export const OrderEngineAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'creator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'advanceHead',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
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
      {
        name: 'maxSteps',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'head',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'baseToken',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC20',
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
    name: 'cancel',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
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
        name: 'cancelledOrderId',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelById',
    inputs: [
      {
        name: 'id',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimDeferred',
    inputs: [],
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
    name: 'deferredOf',
    inputs: [
      {
        name: 'user',
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
    name: 'feeVault',
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
    name: 'fillCount',
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
    name: 'getBalance',
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
        name: 'market',
        type: 'address',
        internalType: 'address',
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
    name: 'getInventory',
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
        name: 'yesOwned',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'noOwned',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'yesReserved',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'noReserved',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'cashReserved',
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
        name: 'priceTick',
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
    name: 'getNet',
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
        name: '',
        type: 'int256',
        internalType: 'int256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOrder',
    inputs: [
      {
        name: 'id',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'tuple',
        internalType: 'struct IOrderEngine.OrderView',
        components: [
          {
            name: 'market',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'maker',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'action',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'outcome',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'yesTick',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'amount',
            type: 'uint128',
            internalType: 'uint128',
          },
          {
            name: 'expiry',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'cashReserved',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOrderCash',
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
    name: 'getOrdersAtTick',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
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
    name: 'getShareBacking',
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
    name: 'getSupplies',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'yesSupply',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'noSupply',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'invalidRemainderOf',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
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
    name: 'merge',
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
        name: 'minTokenOut',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'validUntil',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: 'collateral',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'placeOrder',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'p',
        type: 'tuple',
        internalType: 'struct IOrderEngine.OrderParams',
        components: [
          {
            name: 'outcome',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'action',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'priceTick',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'amount',
            type: 'uint128',
            internalType: 'uint128',
          },
          {
            name: 'matchLimit',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'validUntil',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'expiry',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'rest',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'postOnly',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'maxTokenIn',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'minTokenOut',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'tuple',
        internalType: 'struct IOrderEngine.OrderResult',
        components: [
          {
            name: 'filled',
            type: 'uint128',
            internalType: 'uint128',
          },
          {
            name: 'orderId',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'tokenIn',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'tokenOut',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'fee',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
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
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'initialPrice',
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
    name: 'requireBeforeDeadline',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'settlePosition',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'payout',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'shareUnit',
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
    name: 'split',
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
        name: 'maxTokenIn',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'validUntil',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: 'collateral',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'totalDeferred',
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
    type: 'event',
    name: 'DeferredClaimed',
    inputs: [
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
    type: 'event',
    name: 'HeadAdvanced',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
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
        name: 'head',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'InvalidRemainderChanged',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'halfNativeUnit',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'InventoryChanged',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'yesOwned',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'noOwned',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'yesReserved',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'noReserved',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'cashReserved',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MakerCancelProgress',
    inputs: [
      {
        name: 'market',
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
        name: 'nextCursor',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'cancelledOrderId',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
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
        name: 'baseToken',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'initialPrice',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Merged',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
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
      {
        name: 'collateral',
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
        name: 'market',
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
        name: 'orderId',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'amount',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'cashRefund',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OrderExecuted',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'action',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'outcome',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'filled',
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
      {
        name: 'tokenIn',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'tokenOut',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'fee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OrderFilled',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'orderId',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'taker',
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
        name: 'yesTick',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'settlementType',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'remaining',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'cashReserved',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OrderPlaced',
    inputs: [
      {
        name: 'market',
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
        name: 'orderId',
        type: 'uint64',
        indexed: true,
        internalType: 'uint64',
      },
      {
        name: 'action',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'outcome',
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
        name: 'amount',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'expiry',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'cashReserved',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PayoutDeferred',
    inputs: [
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
    type: 'event',
    name: 'PositionSettled',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'payout',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Split',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
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
      {
        name: 'collateral',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AmountTooLarge',
    inputs: [],
  },
  {
    type: 'error',
    name: 'CashLimit',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientInventory',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidExpiry',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidOrderTerms',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidShareAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSide',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidTick',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MarketAlreadyRegistered',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MarketNotActive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MarketNotLive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MarketNotSettled',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotAuthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NothingDeferred',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NothingFilled',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NothingToCancel',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NothingToRedeem',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderNotFound',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PayoutFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PostOnlyWouldTrade',
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
    name: 'TickOutOfRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TransferAmountMismatch',
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
