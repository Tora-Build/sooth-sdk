export const ITickBookHooksABI = [
  {
    "type": "function",
    "name": "afterCancelOrder",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITickBookHooks.CancelOrderParams",
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
        "name": "collateralReleased",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "afterClaim",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITickBookHooks.ClaimParams",
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
        "name": "collateralUsed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "afterCross",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITickBookHooks.CrossParams",
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
        "name": "newOrderCost",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "oppositeOrderCost",
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
        "internalType": "struct ITickBookHooks.ExecuteOrderParams",
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
        "name": "hookData",
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
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITickBookHooks.PlaceOrderParams",
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
        "name": "orderId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "hookData",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "afterSpotSell",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITickBookHooks.SpotSellParams",
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
        "name": "sharesSold",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "proceeds",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "beforeCancelOrder",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITickBookHooks.CancelOrderParams",
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
        "name": "selector",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "beforeClaim",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITickBookHooks.ClaimParams",
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
        "name": "selector",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "beforeCross",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITickBookHooks.CrossParams",
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
        "name": "selector",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "beforeExecuteOrder",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITickBookHooks.ExecuteOrderParams",
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
        "name": "selector",
        "type": "bytes4",
        "internalType": "bytes4"
      },
      {
        "name": "hookData",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "beforePlaceOrder",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITickBookHooks.PlaceOrderParams",
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
        "name": "selector",
        "type": "bytes4",
        "internalType": "bytes4"
      },
      {
        "name": "hookData",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "beforeSpotSell",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITickBookHooks.SpotSellParams",
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
        "name": "selector",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "nonpayable"
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
  }
] as const;
