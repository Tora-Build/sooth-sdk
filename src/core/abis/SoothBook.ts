export const SoothBookABI = [
  {
    "type": "function",
    "name": "buyYes",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" },
      { "name": "tick", "type": "uint16", "internalType": "uint16" },
      { "name": "amount", "type": "uint128", "internalType": "uint128" },
      { "name": "escrow", "type": "bool", "internalType": "bool" },
      { "name": "maxCost", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "buyNo",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" },
      { "name": "tick", "type": "uint16", "internalType": "uint16" },
      { "name": "amount", "type": "uint128", "internalType": "uint128" },
      { "name": "escrow", "type": "bool", "internalType": "bool" },
      { "name": "maxCost", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "mint",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "merge",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancel",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" },
      { "name": "side", "type": "uint8", "internalType": "uint8" },
      { "name": "tick", "type": "uint16", "internalType": "uint16" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelById",
    "inputs": [
      { "name": "orderId", "type": "uint64", "internalType": "uint64" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "redeem",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "resolveMarket",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" },
      { "name": "outcome", "type": "uint8", "internalType": "uint8" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getBalance",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" },
      { "name": "user", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "yes", "type": "uint256", "internalType": "uint256" },
      { "name": "no", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBestTick",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" },
      { "name": "side", "type": "uint8", "internalType": "uint8" }
    ],
    "outputs": [
      { "name": "", "type": "uint16", "internalType": "uint16" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getCollateralBacking",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getImpliedPrice",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" }
    ],
    "outputs": [
      { "name": "yesPrice", "type": "uint256", "internalType": "uint256" },
      { "name": "noPrice", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOrdersAtTick",
    "inputs": [
      { "name": "marketKey", "type": "bytes32", "internalType": "bytes32" },
      { "name": "side", "type": "uint8", "internalType": "uint8" },
      { "name": "tick", "type": "uint16", "internalType": "uint16" }
    ],
    "outputs": [
      { "name": "totalAmount", "type": "uint256", "internalType": "uint256" },
      { "name": "orderCount", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "markets",
    "inputs": [
      { "name": "", "type": "bytes32", "internalType": "bytes32" }
    ],
    "outputs": [
      { "name": "collateral", "type": "address", "internalType": "address" },
      { "name": "yesToken", "type": "address", "internalType": "address" },
      { "name": "noToken", "type": "address", "internalType": "address" },
      { "name": "active", "type": "bool", "internalType": "bool" },
      { "name": "finalized", "type": "bool", "internalType": "bool" },
      { "name": "outcome", "type": "uint8", "internalType": "uint8" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "feeBps",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint24", "internalType": "uint24" }
    ],
    "stateMutability": "view"
  }
] as const;
