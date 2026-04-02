export const TruthMarketABI = [
  {
    "type": "function",
    "name": "adjudicator",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "creator",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "launchpadEngine",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deadline",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint64" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "startTime",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint64" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "questionHash",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bytes32" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "winningOutcome",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint8" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tStar",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint64" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "invalidationBuffer",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint64" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isLive",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isResolving",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isAttested",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isSettled",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isFinalized",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isSettling",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "question",
    "inputs": [],
    "outputs": [{ "name": "", "type": "string" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "state",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint8" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "finalize",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getRedemptionValue",
    "inputs": [{ "name": "outcome", "type": "uint8" }],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "resolve",
    "inputs": [
      { "name": "outcome", "type": "uint8" },
      { "name": "_tStar", "type": "uint64" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "attest",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settle",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "veto",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "MarketCreated",
    "inputs": [
      { "name": "market", "type": "address", "indexed": true },
      { "name": "questionHash", "type": "bytes32", "indexed": false },
      { "name": "question", "type": "string", "indexed": false },
      { "name": "startTime", "type": "uint64", "indexed": false },
      { "name": "deadline", "type": "uint64", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MarketResolved",
    "inputs": [
      { "name": "market", "type": "address", "indexed": true },
      { "name": "outcome", "type": "uint8", "indexed": false },
      { "name": "tStar", "type": "uint64", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MarketAttested",
    "inputs": [
      { "name": "market", "type": "address", "indexed": true },
      { "name": "outcome", "type": "uint8", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MarketSettled",
    "inputs": [
      { "name": "market", "type": "address", "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MarketVetoed",
    "inputs": [
      { "name": "market", "type": "address", "indexed": true },
      { "name": "previousOutcome", "type": "uint8", "indexed": false },
      { "name": "previousTStar", "type": "uint64", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MarketInvalidated",
    "inputs": [
      { "name": "market", "type": "address", "indexed": true },
      { "name": "caller", "type": "address", "indexed": true }
    ],
    "anonymous": false
  }
] as const;
