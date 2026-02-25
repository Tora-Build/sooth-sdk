/**
 * Interactive Test Configuration
 * Chain configs, contract addresses, and settings
 */

import type { Chain } from 'viem';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { getAllNodes, getNodeById, getChain } from '@sooth/registry';
import type { SoothNode, ChainMeta } from '@sooth/registry/types';
import { toViemChain } from '@sooth/registry/viem';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from monorepo root
const envPaths = [
  path.join(__dirname, '..', '..', '..', '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
  path.join(process.cwd(), '.env'),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex);
          const value = trimmed.slice(eqIndex + 1);
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
    break;
  }
}

// Chain definitions from registry (with extra Monad RPC fallbacks)
export const monadTestnet: Chain = toViemChain(10143, [
  'https://testnet-rpc.monad.xyz',
  'https://rpc.ankr.com/monad_testnet',
  'https://rpc-testnet.monadinfra.com',
]);

export const arcTestnet: Chain = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
};

export const megaethTestnet: Chain = {
  id: 6343,
  name: 'MegaETH Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://carrot.megaeth.com/rpc'],
    },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://megaeth-testnet-v2.blockscout.com' },
  },
  testnet: true,
};

const LEGACY_ALIASES: Record<string, string> = {
  basesepolia: '03d4f3f7',
  'base-sepolia': '03d4f3f7',
  base: '03d4f3f7',
  baseSepolia: '03d4f3f7',
  monad: 'c5059e71',
  monadtestnet: 'c5059e71',
  'monad-testnet': 'c5059e71',
  monadTestnet: 'c5059e71',
};

function resolveNodeId(input: string): string {
  const trimmed = input.trim();
  if (/^[0-9a-f]{8}$/.test(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const fromAlias = LEGACY_ALIASES[trimmed] || LEGACY_ALIASES[lower];
  if (fromAlias) return fromAlias;
  const node = getAllNodes().find(n => {
    const chain = getChain(n.chainId);
    return chain?.name.toLowerCase().replace(/\s/g, '') === lower;
  });
  if (node) return node.id;
  throw new Error(`Unknown node or alias: "${input}". Available: ${getAllNodes().map(n => n.id).join(', ')}`);
}

export interface Deployment {
  chainId: number;
  chainName: string;
  version: string;
  contracts: {
    SoothBook?: string;
    MockUSDC: string;
    Collateralizer: string;
    AMMEngine: string;
    LaunchpadEngine: string;
    [key: string]: string | undefined;
  };
  markets: Array<{
    key: string;
    name: string;
    yesToken: string;
    noToken: string;
    address?: string;
    marketKey?: string;
    isGraduated?: boolean;
  }>;
}

function nodeToDeployment(node: SoothNode, chain: ChainMeta): Deployment {
  return {
    chainId: node.chainId,
    chainName: chain.name,
    version: '12.0.0',
    contracts: {
      SoothBook: node.contracts.soothBook,
      MockUSDC: node.contracts.usdc,
      Collateralizer: node.contracts.collateralizer,
      AMMEngine: node.contracts.ammEngine,
      LaunchpadEngine: node.contracts.launchpadEngine,
      ProtocolConfig: node.contracts.protocolConfig,
    },
    markets: [],
  };
}

function getRpcUrl(chainId: number, chainMeta: ChainMeta): string {
  const envVars: Record<number, string | undefined> = {
    84532: process.env.BASE_SEPOLIA_RPC_URL,
    10143: process.env.MONAD_TESTNET_RPC_URL,
    5042002: process.env.ARC_TESTNET_RPC_URL,
    6343: process.env.MEGAETH_TESTNET_RPC_URL,
  };
  return envVars[chainId] || chainMeta.rpcUrls[0];
}

function getPostTxWait(chainId: number): number {
  if (chainId === 10143) return 8000;
  return 0;
}

export interface InteractiveConfig {
  chainName: string;
  chain: Chain;
  rpc: string;
  deployment: Deployment;
  gasMultiplier: number;
  confirmations: number;
  postTxWaitMs: number;
  defaultMarketIndex: number;
}

export function createConfig(nodeIdOrAlias: string): InteractiveConfig {
  const nodeId = resolveNodeId(nodeIdOrAlias);
  const node = getNodeById(nodeId);
  if (!node) {
    throw new Error(`Node not found: "${nodeId}". Is it registered in nodes.json?`);
  }
  const chainMeta = getChain(node.chainId);
  if (!chainMeta) {
    throw new Error(`Chain metadata not found for chainId ${node.chainId}`);
  }

  const rpc = getRpcUrl(node.chainId, chainMeta);
  const chain = toViemChain(node.chainId, [rpc]);

  return {
    chainName: chainMeta.name,
    chain,
    rpc,
    deployment: nodeToDeployment(node, chainMeta),
    gasMultiplier: 1.2,
    confirmations: 1,
    postTxWaitMs: getPostTxWait(node.chainId),
    defaultMarketIndex: 0,
  };
}

// Contract ABIs (minimal for interactive testing)
export const ABIS = {
  MockUSDC: [
    { name: 'mint', type: 'function', inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'amount' }], outputs: [], stateMutability: 'nonpayable' },
    { name: 'approve', type: 'function', inputs: [{ type: 'address', name: 'spender' }, { type: 'uint256', name: 'amount' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
    { name: 'balanceOf', type: 'function', inputs: [{ type: 'address', name: 'account' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { name: 'allowance', type: 'function', inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'spender' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
    { name: 'totalSupply', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  ],

  OutcomeToken: [
    { name: 'balanceOf', type: 'function', inputs: [{ type: 'address', name: 'account' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { name: 'approve', type: 'function', inputs: [{ type: 'address', name: 'spender' }, { type: 'uint256', name: 'amount' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
    { name: 'allowance', type: 'function', inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'spender' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { name: 'totalSupply', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  ],

  SoothBook: [
    { name: 'buyYes', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'uint16', name: 'tick' }, { type: 'uint128', name: 'amount' }, { type: 'bool', name: 'escrow' }, { type: 'uint256', name: 'maxCost' }], outputs: [], stateMutability: 'nonpayable' },
    { name: 'buyNo', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'uint16', name: 'tick' }, { type: 'uint128', name: 'amount' }, { type: 'bool', name: 'escrow' }, { type: 'uint256', name: 'maxCost' }], outputs: [], stateMutability: 'nonpayable' },
    { name: 'mint', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'uint256', name: 'amount' }], outputs: [], stateMutability: 'nonpayable' },
    { name: 'merge', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'uint256', name: 'amount' }], outputs: [], stateMutability: 'nonpayable' },
    { name: 'cancel', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'uint8', name: 'side' }, { type: 'uint16', name: 'tick' }], outputs: [], stateMutability: 'nonpayable' },
    { name: 'redeem', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }], outputs: [], stateMutability: 'nonpayable' },
    { name: 'resolveMarket', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'uint8', name: 'outcome' }], outputs: [], stateMutability: 'nonpayable' },
    { name: 'createMarket', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'address', name: 'collateral' }, { type: 'string', name: 'name' }], outputs: [{ type: 'address', name: 'yesToken' }, { type: 'address', name: 'noToken' }], stateMutability: 'nonpayable' },
    { name: 'getBalance', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'address', name: 'user' }], outputs: [{ type: 'uint256', name: 'yes' }, { type: 'uint256', name: 'no' }], stateMutability: 'view' },
    { name: 'getCollateralBacking', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { name: 'getBestTick', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'uint8', name: 'side' }], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
    { name: 'getOrdersAtTick', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'uint8', name: 'side' }, { type: 'uint16', name: 'tick' }], outputs: [{ type: 'uint256', name: 'totalAmount' }, { type: 'uint256', name: 'orderCount' }], stateMutability: 'view' },
    { name: 'getImpliedPrice', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }], outputs: [{ type: 'uint256', name: 'yesPrice' }, { type: 'uint256', name: 'noPrice' }], stateMutability: 'view' },
    { name: 'markets', type: 'function', inputs: [{ type: 'bytes32', name: '' }], outputs: [{ type: 'address', name: 'collateral' }, { type: 'address', name: 'yesToken' }, { type: 'address', name: 'noToken' }, { type: 'bool', name: 'active' }, { type: 'bool', name: 'finalized' }, { type: 'uint8', name: 'outcome' }], stateMutability: 'view' },
    { name: 'feeBps', type: 'function', inputs: [], outputs: [{ type: 'uint24' }], stateMutability: 'view' },
    { name: 'feeRecipient', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
    { name: 'owner', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  ],

  LaunchpadEngine: [
    {
      name: 'tradePositions', type: 'function', inputs: [
        { type: 'address', name: 'market' },
        { type: 'uint8', name: 'outcome' },
        { type: 'int256', name: 'deltaShares' },
        { type: 'uint256', name: 'maxCost' },
      ], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable'
    },
    {
      // V11: lpToken added to markets struct (11 fields total)
      name: 'markets', type: 'function', inputs: [{ type: 'address', name: 'market' }],
      outputs: [
        { type: 'address', name: 'creator' },
        { type: 'address', name: 'lpToken' },
        { type: 'uint256', name: 'bBase' },
        { type: 'uint256', name: 'bCurrent' },
        { type: 'uint256', name: 'creatorDeposit' },
        { type: 'uint256', name: 'feesAccrued' },
        { type: 'uint256', name: 'totalLPSupply' },
        { type: 'uint256', name: 'lpYieldPool' },
        { type: 'bool', name: 'isGraduated' },
        { type: 'uint64', name: 'createdAt' },
        { type: 'uint64', name: 'graduatedAt' },
      ], stateMutability: 'view'
    },
    {
      name: 'getGraduationProgress', type: 'function', inputs: [{ type: 'address', name: 'market' }],
      outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], stateMutability: 'view'
    },
  ],

  AMMEngine: [
    {
      name: 'getPosition', type: 'function', inputs: [{ type: 'address', name: 'market' }, { type: 'address', name: 'user' }],
      outputs: [{ type: 'uint256' }, { type: 'uint256' }], stateMutability: 'view'
    },
    {
      name: 'getBalances', type: 'function', inputs: [{ type: 'address', name: 'user' }],
      outputs: [{ type: 'uint256' }, { type: 'uint256' }], stateMutability: 'view'
    },
  ],
} as const;

export const WAD = 10n ** 18n;
export const MAX_UINT256 = 2n ** 256n - 1n;
