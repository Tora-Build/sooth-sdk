export const DynamicFeeHookABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "DEFAULT_FEE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint24",
        "internalType": "uint24"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_FEE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint24",
        "internalType": "uint24"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_FEE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint24",
        "internalType": "uint24"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "VOLUME_WINDOW",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "afterCancelOrder",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.CancelOrderParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "sender",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "orderId",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "afterClaim",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.ClaimParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "sender",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "orderId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "filledShares",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "afterCross",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.CrossParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "newOrderId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "crossedShares",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "crossTick",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "afterExecuteOrder",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.ExecuteOrderParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "sender",
            "type": "address",
            "internalType": "address"
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
            "name": "maxCost",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "sharesFilled",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "totalCost",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "afterPlaceOrder",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.PlaceOrderParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "sender",
            "type": "address",
            "internalType": "address"
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
            "name": "sharesTotal",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "afterSpotSell",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.SpotSellParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "sender",
            "type": "address",
            "internalType": "address"
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
            "name": "minProceeds",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "beforeCancelOrder",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.CancelOrderParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "sender",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "orderId",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "beforeClaim",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.ClaimParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "sender",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "orderId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "filledShares",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "beforeCross",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.CrossParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "newOrderId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "crossedShares",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "crossTick",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "beforeExecuteOrder",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.ExecuteOrderParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "sender",
            "type": "address",
            "internalType": "address"
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
            "name": "maxCost",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes4",
        "internalType": "bytes4"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "beforePlaceOrder",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.PlaceOrderParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "sender",
            "type": "address",
            "internalType": "address"
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
            "name": "sharesTotal",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes4",
        "internalType": "bytes4"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "beforeSpotSell",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IOrderbookHooks.SpotSellParams",
        "components": [
          {
            "name": "marketKey",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "sender",
            "type": "address",
            "internalType": "address"
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
            "name": "minProceeds",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "feeConfigs",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "baseFee",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "maxFee",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "volumeDiscount",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "volatilityPremium",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "windowStart",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "windowVolume",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "lastTick",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "tickMovement",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getDynamicFee",
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
        "name": "baseFee",
        "type": "uint24",
        "internalType": "uint24"
      }
    ],
    "outputs": [
      {
        "name": "fee",
        "type": "uint24",
        "internalType": "uint24"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setFeeConfig",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "baseFee",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "maxFee",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "volumeDiscount",
        "type": "uint24",
        "internalType": "uint24"
      },
      {
        "name": "volatilityPremium",
        "type": "uint24",
        "internalType": "uint24"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "FeeCharged",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "shares",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "fee",
        "type": "uint24",
        "indexed": false,
        "internalType": "uint24"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FeeConfigUpdated",
    "inputs": [
      {
        "name": "marketKey",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "baseFee",
        "type": "uint24",
        "indexed": false,
        "internalType": "uint24"
      },
      {
        "name": "maxFee",
        "type": "uint24",
        "indexed": false,
        "internalType": "uint24"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  }
] as const;
