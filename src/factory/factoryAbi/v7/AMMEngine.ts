/** GENERATED from historical sooth-factory (now sooth-factory-archive) 1aa5fc80e7e4e14df5a4141c3195fd2ee4b302ef:sdk/abi.json.
 * Interface: sooth-factory-v7; bundle keccak256: 0xbbb80127a1464f7f8a754d71ea4dd825664c9892762b57a880258fd3d090025a.
 * Verified against bundled bytes; historical upstream git objects are not verified.
 * Regenerate with node src/factory/factoryAbi/regenerate.mjs
 */
export const AMMEngineAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_marketFactory',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_feeVault',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'accountingLocked',
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
    name: 'claimAvailable',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'units',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'redeemedWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'floorPaid',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'feesPaid',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimFloor',
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
    name: 'claimableFloorLiability',
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
    name: 'feeVault',
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
    name: 'floorEntitlementOf',
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
    name: 'getLiquidity',
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
    name: 'getMarketCollateral',
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
    name: 'getMarketState',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'qYes',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'qNo',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'price',
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
    name: 'getPositionQuote',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'outcome',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'deltaShares',
        type: 'int256',
        internalType: 'int256',
      },
    ],
    outputs: [
      {
        name: 'cost',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'fee',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'netAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'newPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'increaseLiquidity',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'additionalB',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'limits',
        type: 'tuple',
        internalType: 'struct IAMMEngine.LiquidityLimits',
        components: [
          {
            name: 'maxTokenIn',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'minLpOut',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'minYesPrice',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxYesPrice',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'expectedStateHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'depositWad',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'increaseLiquidityFromCreator',
    inputs: [
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
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'initializeMarket',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
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
        name: 'initialLiquidity',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'initialQYes',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'initialQNo',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'creatorDeposit',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'liquidityHeadroom',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'tradeHeadroom',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'admissionHeadroom',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'liquidityStateHash',
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
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lpPositionOf',
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
    name: 'marketFactory',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IMarketFactory',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'mintLPTokens',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'positionManager',
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
    name: 'quoteLiquidity',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'additionalB',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'tokenIn',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receiptUnits',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'quoteLiquidityWithState',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'additionalB',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'tokenIn',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receiptUnits',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'stateHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'redeemLP',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'lpAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'tokenAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'redeemLPPosition',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'tokenADecimalsOf',
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
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenAOf',
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
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
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
    name: 'tradePositions',
    inputs: [
      {
        name: 'market',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'outcome',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'deltaShares',
        type: 'int256',
        internalType: 'int256',
      },
      {
        name: 'maxCostOrMinProceeds',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'actualCost',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'FloorClaimed',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'market',
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
    name: 'LPMinted',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'to',
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
        name: 'newTotalSupply',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LPProceedsClaimed',
    inputs: [
      {
        name: 'holder',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'redeemedWad',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'floorPaid',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'feesPaid',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LPRedeemed',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'market',
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
        name: 'tokenAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityIncreasedFromCreator',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'additionalB',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'depositRequired',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newLiquidity',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityPositionAdded',
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
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'addedDepth',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'depositWad',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketInitialized',
    inputs: [
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'tokenA',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'tokenADecimals',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'initialLiquidity',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'creatorDeposit',
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
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'winningOutcome',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'yesShares',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'noShares',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
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
    name: 'PositionTraded',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'market',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'outcome',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'deltaShares',
        type: 'int256',
        indexed: false,
        internalType: 'int256',
      },
      {
        name: 'cost',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newQYes',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newQNo',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'CostTooHigh',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Domain',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientLP',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientMarketCollateral',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientMarketNo',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientMarketYes',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientNoShares',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientTokenCustody',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientYesShares',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidMarketToken',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidOutcome',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LPTokenAlreadySet',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MarketNotLive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MintingClosed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoPosition',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotAuthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotFinalized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NothingToClaim',
    inputs: [],
  },
  {
    type: 'error',
    name: 'RedeemNotAvailable',
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
    name: 'SlippageExceeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StaleLiquidityQuote',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TopUpsDisabled',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TransferAmountMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnboundedLiquidityLimits',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroDelta',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroFeeVault',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroLiquidity',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroMarket',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroMarketFactory',
    inputs: [],
  },
] as const;
