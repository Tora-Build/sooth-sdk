import { chains as lensChains } from '@lens-chain/sdk/viem';
import {
  createPublicClient,
  encodeAbiParameters,
  http,
  keccak256,
  parseAbiParameters,
  toBytes,
  type Address,
  type Hex,
} from 'viem';
import { LENS_RPC_URL } from './lensConfig';

export const SOOTH_POST_ACTION_TESTNET = '0x7ADCc784b192Ea376820aAa28E358f156E458f84';
export const SOOTH_POST_ACTION_MAINNET = '';

// On Lens testnet this is WGRASS (Wrapped GRASS, the testnet native token).
// Functionally identical to WGHO — ERC-20 wrapper, different naming.
export const WGHO_TESTNET = '0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8';
export const WGHO_MAINNET = '0x6bDc36E20D267Ff0dd6097799f82e78907105e2F';

export const ACTION_HUB_TESTNET = '0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11';
export const ACTION_HUB_MAINNET = '0xc6D57Ee750Ef2ee017a9E985A0C4198bEd16A802';

export const GLOBAL_FEED_TESTNET = '0x31232Cb7dE0dce17949ffA58E9E38EEeB367C871';
export const GLOBAL_FEED_MAINNET = '0xcB5E109FFC0E15565082d78E68dDDf2573703580';

const toParamKey = (name: string): Hex => keccak256(toBytes(name));

export const PARAM_KEYS = {
  B: toParamKey('sooth.param.b'),
  DEADLINE: toParamKey('sooth.param.deadline'),
  FEE_BPS: toParamKey('sooth.param.feeBps'),
  ACTION: toParamKey('sooth.param.action'),
  OUTCOME: toParamKey('sooth.param.outcome'),
  AMOUNT: toParamKey('sooth.param.amount'),
  MAX_COST: toParamKey('sooth.param.maxCost'),
} as const;

export const ACTION = {
  BUY: 0n,
  SELL: 1n,
  RESOLVE: 2n,
  REDEEM: 3n,
} as const;

export const OUTCOME = {
  NO: 0n,
  YES: 1n,
  INVALID: 2n,
} as const;

export const SoothPostActionABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_wgho",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_actionHub",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "actionHub",
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
    "name": "configure",
    "inputs": [
      {
        "name": "originalMsgSender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "feed",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "params",
        "type": "tuple[]",
        "internalType": "struct KeyValue[]",
        "components": [
          {
            "name": "key",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "value",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "execute",
    "inputs": [
      {
        "name": "originalMsgSender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "feed",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "params",
        "type": "tuple[]",
        "internalType": "struct KeyValue[]",
        "components": [
          {
            "name": "key",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "value",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "getPosition",
    "inputs": [
      {
        "name": "feed",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "yesShares",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "noShares",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPrice",
    "inputs": [
      {
        "name": "feed",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
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
    "name": "markets",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "resolver",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "deadline",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "b",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "qYes",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "qNo",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "totalCollateral",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "winningOutcome",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "resolved",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "paused",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "feeBps",
        "type": "uint16",
        "internalType": "uint16"
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
    "name": "positions",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "yesShares",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "noShares",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "quoteBuy",
    "inputs": [
      {
        "name": "feed",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "internalType": "uint256"
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
      }
    ],
    "outputs": [
      {
        "name": "cost",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "fee",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "total",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "quoteSell",
    "inputs": [
      {
        "name": "feed",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "internalType": "uint256"
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
      }
    ],
    "outputs": [
      {
        "name": "proceeds",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "fee",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "total",
        "type": "uint256",
        "internalType": "uint256"
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
    "name": "setDisabled",
    "inputs": [
      {
        "name": "originalMsgSender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "feed",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "isDisabled",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct KeyValue[]",
        "components": [
          {
            "name": "key",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "value",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "setTreasury",
    "inputs": [
      {
        "name": "_treasury",
        "type": "address",
        "internalType": "address"
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
    "type": "function",
    "name": "treasury",
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
    "name": "wgho",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "MarketCreated",
    "inputs": [
      {
        "name": "feed",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "resolver",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "b",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "deadline",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "feeBps",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MarketResolved",
    "inputs": [
      {
        "name": "feed",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "winningOutcome",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
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
    "type": "event",
    "name": "SharesBought",
    "inputs": [
      {
        "name": "feed",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "user",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "shares",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "cost",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SharesRedeemed",
    "inputs": [
      {
        "name": "feed",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "user",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "payout",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SharesSold",
    "inputs": [
      {
        "name": "feed",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "postId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "user",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "shares",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "proceeds",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyResolved",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientShares",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidAction",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidOutcome",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MarketAlreadyExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MarketNotActive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MarketNotResolved",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MarketPaused",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotActionHub",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotResolver",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NothingToRedeem",
    "inputs": []
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
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "SlippageExceeded",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TooEarly",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAmount",
    "inputs": []
  }
] as const;

export const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'allowance', type: 'uint256' }],
  },
] as const;

export const lensPublicClient = createPublicClient({
  chain: lensChains.testnet,
  transport: http(LENS_RPC_URL),
});

export const SOOTH_POST_ACTION_ADDRESS = SOOTH_POST_ACTION_TESTNET as Address;
export const WGHO_ADDRESS = WGHO_TESTNET as Address;
export const ACTION_HUB_ADDRESS = ACTION_HUB_TESTNET as Address;

const UINT256_PARAMS = parseAbiParameters('uint256');
const UINT8_PARAMS = parseAbiParameters('uint8');

export const encodeUint256Param = (value: bigint): Hex =>
  encodeAbiParameters(UINT256_PARAMS, [value]);

export const encodeUint8Param = (value: number | bigint): Hex =>
  encodeAbiParameters(UINT8_PARAMS, [typeof value === 'bigint' ? Number(value) : value]);

export interface ParsedLensPostId {
  feed: Address;
  postId: bigint;
}

export function parseLensPostId(id: string): ParsedLensPostId | null {
  const parts = id.split('/');
  if (parts.length !== 2) {
    return null;
  }

  const [feedPart, postIdPart] = parts;
  if (!/^0x[a-fA-F0-9]{40}$/.test(feedPart)) {
    return null;
  }

  try {
    return {
      feed: feedPart as Address,
      postId: BigInt(postIdPart),
    };
  } catch {
    return null;
  }
}

export const WETH9_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'wad', type: 'uint256' }], outputs: [] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const;
