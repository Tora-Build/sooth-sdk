/**
 * Interactive Test Configuration
 * Chain configs, contract addresses, and settings
 */

import { baseSepolia } from 'viem/chains';
import type { Chain } from 'viem';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

// Custom chain definitions
export const monadTestnet: Chain = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        'https://testnet-rpc.monad.xyz',
        'https://rpc.ankr.com/monad_testnet',
        'https://rpc-testnet.monadinfra.com',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'MonadVision', url: 'https://testnet.monadvision.com' },
  },
  testnet: true,
};

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

export interface ChainConfig {
  chain: Chain;
  rpc: string;
  deploymentFile: string;
  confirmations?: number;
  postTxWaitMs?: number;
  aliases?: string[];
}

export const CHAINS: Record<string, ChainConfig> = {
  baseSepolia: {
    chain: baseSepolia,
    rpc: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    deploymentFile: 'baseSepolia.json',
    confirmations: 1,
    postTxWaitMs: 0,
    aliases: ['base', 'base-sepolia', 'basesepolia'],
  },
  monadTestnet: {
    chain: monadTestnet,
    rpc: process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz',
    deploymentFile: 'monadTestnet.json',
    confirmations: 1,
    // Monad testnet RPCs can have noticeable state propagation delay even after TX confirmation.
    postTxWaitMs: 8000,
    aliases: ['monad', 'monad-testnet', 'monadtestnet'],
  },
  arcTestnet: {
    chain: arcTestnet,
    rpc: process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network',
    deploymentFile: 'arcTestnet.json',
    confirmations: 1,
    postTxWaitMs: 2000,
    aliases: ['arc', 'arc-testnet', 'arctestnet'],
  },
  megaethTestnet: {
    chain: megaethTestnet,
    rpc: process.env.MEGAETH_TESTNET_RPC_URL || 'https://carrot.megaeth.com/rpc',
    deploymentFile: 'megaethTestnet.json',
    confirmations: 1,
    postTxWaitMs: 2000,
    aliases: ['megaeth', 'megaeth-testnet', 'megaethtestnet'],
  },
};

function resolveChainKey(input: string): string {
  const normalized = input.trim().toLowerCase();

  for (const key of Object.keys(CHAINS)) {
    if (key.toLowerCase() === normalized) return key;
  }

  for (const [key, cfg] of Object.entries(CHAINS)) {
    if (cfg.aliases?.some(a => a.toLowerCase() === normalized)) return key;
  }

  return input;
}

export interface Deployment {
  chainId: number;
  chainName: string;
  version: string;
  contracts: {
    MockUSDC: string;
    Collateralizer: string;
    AMMEngine: string;
    TickBookVault: string;
    TickBookPoolManager: string;
    TickBook: string;
    LaunchpadEngine: string;
  };
  markets: Array<{
    address: string;
    name: string;
    yesToken?: string;
    noToken?: string;
    marketKey?: string;
    isGraduated?: boolean;
  }>;
}

export function loadDeployment(chainName: string): Deployment {
  const chainKey = resolveChainKey(chainName);
  const config = CHAINS[chainKey];
  if (!config) {
    throw new Error(`Unknown chain: ${chainName}. Available: ${Object.keys(CHAINS).join(', ')}`);
  }

  // Try contracts-core first, then contracts-testing
  const paths = [
    path.join(__dirname, '..', '..', '..', 'contracts-core', 'deployments', config.deploymentFile),
    path.join(__dirname, '..', 'deployments', config.deploymentFile),
  ];

  for (const deployPath of paths) {
    if (fs.existsSync(deployPath)) {
      return JSON.parse(fs.readFileSync(deployPath, 'utf-8'));
    }
  }

  throw new Error(`Deployment file not found: ${config.deploymentFile}`);
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

export function createConfig(chainName: string): InteractiveConfig {
  const chainKey = resolveChainKey(chainName);
  const chainConfig = CHAINS[chainKey];
  if (!chainConfig) {
    throw new Error(`Unknown chain: ${chainName}`);
  }

  const deployment = loadDeployment(chainKey);

  return {
    chainName: chainKey,
    chain: chainConfig.chain,
    rpc: chainConfig.rpc,
    deployment,
    gasMultiplier: 1.2,
    confirmations: chainConfig.confirmations ?? 1,
    postTxWaitMs: chainConfig.postTxWaitMs ?? 0,
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
  ],

  TickBookVault: [
    { name: 'depositUsdc', type: 'function', inputs: [{ type: 'uint256', name: 'amount' }], outputs: [], stateMutability: 'nonpayable' },
    { name: 'withdrawUsdc', type: 'function', inputs: [{ type: 'uint256', name: 'amountWad' }], outputs: [], stateMutability: 'nonpayable' },
    { name: 'availableUsdcWad', type: 'function', inputs: [{ type: 'address', name: 'user' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { name: 'reservedUsdcWad', type: 'function', inputs: [{ type: 'address', name: 'user' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { name: 'getInternalOutcomes', type: 'function', inputs: [{ type: 'address', name: 'market' }, { type: 'address', name: 'user' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }], stateMutability: 'view' },
    { name: 'getLockedOutcome', type: 'function', inputs: [{ type: 'address', name: 'market' }, { type: 'address', name: 'user' }, { type: 'uint8', name: 'outcome' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  ],

  TickBookPoolManager: [
    // V10 Unified Crossing Architecture (spot-first + range)
    {
      name: 'placeOrder', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint8', name: 'outcome' },
        { type: 'uint256', name: 'shares' },
        { type: 'uint16', name: 'tickLower' },
        { type: 'uint16', name: 'tickUpper' },
        { type: 'uint256', name: 'maxCost' },
      ], outputs: [
        { type: 'uint256', name: 'orderId' },
        { type: 'uint256', name: 'filledShares' },
        { type: 'uint256', name: 'filledCost' },
        { type: 'uint256', name: 'restingShares' },
      ], stateMutability: 'nonpayable'
    },
    {
      name: 'cancelOrder', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint256', name: 'orderId' },
      ], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable'
    },
    {
      name: 'claimFills', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint256', name: 'orderId' },
      ], outputs: [{ type: 'uint256' }, { type: 'uint256' }], stateMutability: 'nonpayable'
    },
    {
      name: 'getMarketState', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }],
      outputs: [{ type: 'uint16' }, { type: 'uint128' }, { type: 'uint128' }, { type: 'uint256' }], stateMutability: 'view'
    },
    {
      name: 'getOrder', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'uint256', name: 'orderId' }],
      outputs: [{
        type: 'tuple', components: [
          { name: 'owner', type: 'address' },
          { name: 'outcome', type: 'uint8' },
          { name: 'tickLower', type: 'uint16' },
          { name: 'tickUpper', type: 'uint16' },
          { name: 'active', type: 'bool' },
          { name: 'liquidityRemoved', type: 'bool' },
          { name: 'sharesTotal', type: 'uint128' },
          { name: 'liquidity', type: 'uint128' },
          { name: 'collateralDepositedWad', type: 'uint128' },
          { name: 'filledShares', type: 'uint128' },
          { name: 'collateralUsedWad', type: 'uint128' },
        ]
      }], stateMutability: 'view'
    },
    {
      name: 'getUserOrders', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }, { type: 'address', name: 'user' }],
      outputs: [{ type: 'uint256[]' }], stateMutability: 'view'
    },
    {
      name: 'getMarketInfo', type: 'function', inputs: [{ type: 'bytes32', name: 'marketKey' }],
      outputs: [{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'bool' }], stateMutability: 'view'
    },
    // V10: Spot Sell (unified crossing)
    {
      name: 'placeSpotSell', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint8', name: 'outcome' },
        { type: 'uint256', name: 'shares' },
        { type: 'uint16', name: 'tickLower' },
        { type: 'uint16', name: 'tickUpper' },
      ], outputs: [{ type: 'uint256', name: 'sellId' }], stateMutability: 'nonpayable'
    },
    {
      name: 'cancelSpotSell', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint256', name: 'sellId' },
      ], outputs: [{ type: 'uint256', name: 'sharesReturned' }], stateMutability: 'nonpayable'
    },

    {
      name: 'claimSpotSellProceeds', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint256', name: 'sellId' },
      ], outputs: [{ type: 'uint256', name: 'proceeds' }], stateMutability: 'nonpayable'
    },
    {
      name: 'getUserSpotSells', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'address', name: 'user' },
      ], outputs: [{ type: 'uint256[]' }], stateMutability: 'view'
    },
    {
      name: 'getSpotSellOrder', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint256', name: 'sellId' },
      ], outputs: [{
        type: 'tuple', components: [
          { name: 'owner', type: 'address' },
          { name: 'outcome', type: 'uint8' },
          { name: 'tickLower', type: 'uint16' },
          { name: 'tickUpper', type: 'uint16' },
          { name: 'active', type: 'bool' },
          { name: 'sharesTotal', type: 'uint128' },
          { name: 'sharesFilled', type: 'uint128' },
          { name: 'proceedsWad', type: 'uint128' },
        ]
      }], stateMutability: 'view'
    },
    {
      name: 'getSpotSellLiquidity', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint8', name: 'outcome' },
        { type: 'uint16', name: 'tick' },
      ], outputs: [{ type: 'uint128' }], stateMutability: 'view'
    },
    // V10: Unified tick liquidity view
    {
      name: 'getTickLiquidity', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint8', name: 'outcome' },
        { type: 'uint16', name: 'tick' },
      ], outputs: [
        { type: 'int128', name: 'rangeLiquidityNet' },
        { type: 'uint128', name: 'rangeLiquidityGross' },
        { type: 'uint128', name: 'spotLiquidity' },
      ], stateMutability: 'view'
    },
    // Batch operations
    {
      name: 'batchCancelOrders', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint256[]', name: 'orderIds' },
      ], outputs: [{ type: 'uint256', name: 'totalCollateralReleased' }], stateMutability: 'nonpayable'
    },
    {
      name: 'batchClaimFills', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint256[]', name: 'orderIds' },
      ], outputs: [
        { type: 'uint256', name: 'totalFilledShares' },
        { type: 'uint256', name: 'totalCollateralUsed' },
      ], stateMutability: 'nonpayable'
    },
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
      // V10.8.3: Removed name/symbol fields (now 10 fields, not 12)
      name: 'markets', type: 'function', inputs: [{ type: 'address', name: 'market' }],
      outputs: [
        { type: 'address', name: 'creator' },
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
