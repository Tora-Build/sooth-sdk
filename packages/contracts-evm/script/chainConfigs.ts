/**
 * Chain Configurations for Multi-Chain Deployment
 * Supports Base Sepolia, MegaETH Frontier, and Monad Testnet
 */

import { defineChain, Chain } from 'viem';

// ============================================
// Chain Definitions
// ============================================

export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: { name: 'Basescan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
});

export const megaethFrontier = defineChain({
  id: 4326,
  name: 'MegaETH Frontier',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'MegaExplorer', url: 'https://explorer.megaeth.com' },
  },
  testnet: false, // Frontier is mainnet beta
});

// Monad RPCs: https://docs.monad.xyz/developer-essentials/testnets
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { 
      http: [
        'https://testnet-rpc.monad.xyz',        // QuickNode (25 rps)
        'https://rpc.ankr.com/monad_testnet',   // Ankr (300/10s)
        'https://rpc-testnet.monadinfra.com',   // Monad Foundation (20 rps)
      ] 
    },
  },
  blockExplorers: {
    default: { name: 'MonadVision', url: 'https://testnet.monadvision.com' },
  },
  testnet: true,
});

// ============================================
// Chain Configuration Interface
// ============================================

export interface ChainConfig {
  chain: Chain;
  gasSettings: {
    gasLimit?: bigint;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  };
  deploymentConfig: {
    confirmations: number;
    retryAttempts: number;
    retryDelay: number; // ms
  };
  faucetEnabled: boolean;
}

// ============================================
// Chain Configs Map
// ============================================

export const chainConfigs: Record<string, ChainConfig> = {
  baseSepolia: {
    chain: baseSepolia,
    gasSettings: {
      // Base Sepolia uses EIP-1559
    },
    deploymentConfig: {
      confirmations: 1,
      retryAttempts: 3,
      retryDelay: 2000,
    },
    faucetEnabled: true,
  },

  megaethFrontier: {
    chain: megaethFrontier,
    gasSettings: {
      // MegaETH requires explicit high gas limit
      gasLimit: 999_999_999n,
      gasPrice: 100_000_000n, // 0.1 gwei
    },
    deploymentConfig: {
      confirmations: 1,
      retryAttempts: 5,
      retryDelay: 1000, // MegaETH is fast
    },
    faucetEnabled: true,
  },

  monadTestnet: {
    chain: monadTestnet,
    gasSettings: {
      // Monad has repriced opcodes: cold access 4x more expensive
      // See: https://docs.monad.xyz/developer-essentials/opcode-pricing
      // Using higher gas limits for complex contracts
      gasLimit: 8_000_000n, // 8M gas for Collateralizer/TickBook
      maxFeePerGas: 105_000_000_000n, // 105 gwei (just above min 100 gwei)
      maxPriorityFeePerGas: 1_000_000_000n, // 1 gwei priority
    },
    deploymentConfig: {
      confirmations: 1,
      retryAttempts: 3,
      retryDelay: 2000,
    },
    faucetEnabled: true,
  },
};

// ============================================
// Market Configuration
// ============================================

export interface MarketConfig {
  name: string;
  question: string;
  symbol: string;
  bBase: bigint; // WAD
  deadlineDays: number;
  shouldGraduate: boolean; // If true, execute graduation trades post-deploy
}

export const defaultMarkets: MarketConfig[] = [
  {
    name: 'UN Confirms Alien Life',
    question: 'Will the United Nations officially confirm the existence of extraterrestrial life?',
    symbol: 'ALIEN',
    bBase: 1000n * 10n ** 18n, // 1,000 USDC liquidity
    deadlineDays: 30,
    shouldGraduate: false,
  },
  {
    name: 'BTC TWAP >= $100k',
    question: "Will Bitcoin's 7-day time-weighted average price reach or exceed $100,000?",
    symbol: 'BTC100K',
    bBase: 1000n * 10n ** 18n, // 1,000 USDC liquidity
    deadlineDays: 30,
    shouldGraduate: true, // Graduate this market via trades
  },
];

// ============================================
// Graduation Trade Configuration
// ============================================

/**
 * Trades to graduate a market with bBase = 1000 USDC
 * Graduation threshold = bBase × 2 = 2000 USDC in fees
 * Pre-grad fee = 5%
 * Volume needed = 2000 / 0.05 = 40,000 USDC
 * 
 * We execute ~46k volume to ensure graduation
 */
// Increased trades to ensure graduation (need ~40k USDC volume for 2k USDC in fees at 5%)
export const graduationTrades: bigint[] = [
  10000n * 10n ** 18n,  // buy 10k
  -8000n * 10n ** 18n,  // sell 8k
  12000n * 10n ** 18n,  // buy 12k
  -8000n * 10n ** 18n,  // sell 8k
  15000n * 10n ** 18n,  // buy 15k
  -10000n * 10n ** 18n, // sell 10k
  15000n * 10n ** 18n,  // buy 15k
  -10000n * 10n ** 18n, // sell 10k
  12000n * 10n ** 18n,  // buy 12k
  10000n * 10n ** 18n,  // buy 10k -> should graduate by now
];

// ============================================
// Helper Functions
// ============================================

export function getChainConfig(chainName: string): ChainConfig {
  const config = chainConfigs[chainName];
  if (!config) {
    throw new Error(`Unknown chain: ${chainName}. Available: ${Object.keys(chainConfigs).join(', ')}`);
  }
  return config;
}

export function getAllChainNames(): string[] {
  return Object.keys(chainConfigs);
}

export function getChainById(chainId: number): ChainConfig | undefined {
  return Object.values(chainConfigs).find(c => c.chain.id === chainId);
}

// ============================================
// Deployment Output Interface
// ============================================

export interface DeploymentArtifact {
  chainId: number;
  chainName: string;
  timestamp: string;
  deployer: string;
  contracts: {
    MockUSDC: string;
    Collateralizer: string;
    AMMEngine: string;
    TickBook: string;
    LaunchpadEngine: string;
  };
  markets: {
    address: string;
    name: string;
    symbol: string;
    yesToken: string;
    noToken: string;
    isGraduated: boolean;
    tickBookKey?: string;
  }[];
}

