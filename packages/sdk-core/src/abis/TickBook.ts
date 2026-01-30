export const TickBookABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_vault",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelOrder",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "orderId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "remainingShares",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "collateralReleasedUsdcWad",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimFees",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "executeMarketOrder",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "shares",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limitTick",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [
      {
        "name": "sharesFilled",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "finalTick",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "findNextActiveTick",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "startTick",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "isUp",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "nextTick",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAccruedFees",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "getCurrentTick",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "tickIndex",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "probability",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMarketInfo",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "market",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "yesToken",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "noToken",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "isActive",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOrder",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "orderId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "o",
        "type": "tuple",
        "internalType": "struct ITickBook.OrderView",
        "components": [
          {
            "name": "owner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "outcome",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "tick",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "remaining",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "active",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getQuote",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "shares",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limitTick",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [
      {
        "name": "result",
        "type": "tuple",
        "internalType": "struct ITickBook.QuoteResult",
        "components": [
          {
            "name": "sharesFillable",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "takerCollateralWad",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "finalTick",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTick",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "tickIndex",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [
      {
        "name": "data",
        "type": "tuple",
        "internalType": "struct ITickBook.TickData",
        "components": [
          {
            "name": "yesDepth",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "noDepth",
            "type": "uint128",
            "internalType": "uint128"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getUserOrders",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "orderIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "placeLimitOrder",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "tickLower",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "tickUpper",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "sharesPerTick",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "firstOrderId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "orderCount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registerMarket",
    "inputs": [
      {
        "name": "market",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "yesToken",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "noToken",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "initialProbabilityWad",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "vault",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ITickBookVault"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "MarketOrderExecuted",
    "inputs": [
      {
        "name": "taker",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "marketKey",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "sharesRequested",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "sharesFilled",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "startTick",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "endTick",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OrderCancelled",
    "inputs": [
      {
        "name": "maker",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "marketKey",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "orderId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "tick",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "remainingShares",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "collateralReleasedUsdcWad",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RangeOrderPlaced",
    "inputs": [
      {
        "name": "maker",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "marketKey",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "tickLower",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "tickUpper",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "sharesPerTick",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "totalReservedUsdcWad",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "firstOrderId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "orderCount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  }
] as const;
