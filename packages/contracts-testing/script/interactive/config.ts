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
    postTxWaitMs: 8000,
    aliases: ['monad', 'monad-testnet', 'monadtestnet'],
  },
  // V11.1: Disabled - single-chain focus
  /*
  arcTestnet: {
     chain: arcTestnet,
     rpc: process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network',
     deploymentFile: 'arcTestnet.json',
     confirmations: 1,
     postTxWaitMs: 2000,
     aliases: ['arc', 'arc-testnet', 'arctestnet'],
   },
   */
   // V11.1: Disabled - single-chain focus
   /*
   megaethTestnet: {
     chain: megaethTestnet,
     rpc: process.env.MEGAETH_TESTNET_RPC_URL || 'https://carrot.megaeth.com/rpc',
     deploymentFile: 'megaethTestnet.json',
     confirmations: 1,
     postTxWaitMs: 2000,
     aliases: ['megaeth', 'megaeth-testnet', 'megaethtestnet'],
   },
   */
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
    SoothBook?: string;
    MockUSDC: string;
    Collateralizer: string;
    AMMEngine: string;
    TickBookVault: string;
    TickBookPoolManager: string;
    TickBook: string;
    LaunchpadEngine: string;
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
      const parsed = JSON.parse(fs.readFileSync(deployPath, 'utf-8')) as {
        [key: string]: unknown;
        contracts?: Deployment['contracts'];
        markets?: unknown;
      };

      const rawMarkets = Array.isArray(parsed.markets) ? parsed.markets : [];
      const normalizedMarkets: Deployment['markets'] = rawMarkets.map((entry, index) => {
        const market = typeof entry === 'object' && entry !== null
          ? (entry as Record<string, unknown>)
          : {};

        const keyValue = typeof market.key === 'string'
          ? market.key
          : typeof market.marketKey === 'string'
            ? market.marketKey
            : '';
        const nameValue = typeof market.name === 'string' ? market.name : `Market ${index + 1}`;
        const yesTokenValue = typeof market.yesToken === 'string'
          ? market.yesToken
          : '0x0000000000000000000000000000000000000000';
        const noTokenValue = typeof market.noToken === 'string'
          ? market.noToken
          : '0x0000000000000000000000000000000000000000';

        return {
          key: keyValue,
          marketKey: keyValue,
          name: nameValue,
          yesToken: yesTokenValue,
          noToken: noTokenValue,
          address: typeof market.address === 'string' ? market.address : undefined,
        };
      });

      return {
        ...(parsed as Omit<Deployment, 'markets' | 'contracts'>),
        contracts: parsed.contracts as Deployment['contracts'],
        markets: normalizedMarkets,
      };
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
    // Keeper functions
    {
      name: 'claimSpotSellProceedsFor', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
        { type: 'uint256', name: 'sellId' },
      ], outputs: [{ type: 'uint256', name: 'proceeds' }], stateMutability: 'nonpayable'
    },
    // State queries
    {
      name: 'getNextOrderId', type: 'function', inputs: [],
      outputs: [{ type: 'uint256' }], stateMutability: 'view'
    },
    {
      name: 'getNextSpotSellId', type: 'function', inputs: [],
      outputs: [{ type: 'uint256' }], stateMutability: 'view'
    },
    // Refund management
    {
      name: 'getPendingRefunds', type: 'function', inputs: [
        { type: 'address', name: 'user' },
        { type: 'bytes32', name: 'marketKey' },
      ], outputs: [{ type: 'uint256' }], stateMutability: 'view'
    },
    {
      name: 'claimPooledRefunds', type: 'function', inputs: [
        { type: 'bytes32', name: 'marketKey' },
      ], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable'
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
