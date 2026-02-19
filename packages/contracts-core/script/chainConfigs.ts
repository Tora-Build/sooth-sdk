/**
 * Chain Configurations for Multi-Chain Deployment
 * Supports Base Sepolia, MegaETH Frontier, and Monad Testnet
 */

import { defineChain, Chain } from 'viem';

// ============================================
// Chain Definitions
// ============================================

const baseSepoliaRpcCandidates = (process.env.BASE_SEPOLIA_RPC_URL ?? '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http:
        baseSepoliaRpcCandidates.length > 0
          ? baseSepoliaRpcCandidates
          : ['https://sepolia.base.org'],
    },
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

export const megaethTestnet = defineChain({
  id: 6343,
  name: 'MegaETH Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://megaeth-testnet.g.alchemy.com/v2/jbMFWO2gYvRKxW5skck8K'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://megaeth-testnet-v2.blockscout.com' },
  },
  testnet: true,
});

// Monad RPCs: https://docs.monad.xyz/developer-essentials/testnets
// Using private QuickNode RPC for faster state propagation
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        'https://blue-stylish-friday.monad-testnet.quiknode.pro/e8b690b8d333c538f85bab9c93a2a3b512a4cb9a/',
        'https://testnet-rpc.monad.xyz',  // fallback
      ]
    },
  },
  blockExplorers: {
    default: { name: 'MonadVision', url: 'https://testnet.monadvision.com' },
  },
  testnet: true,
});

// Arc Testnet: Circle-backed chain with native USDC as gas token
// Sub-second finality (~350ms), 3000+ TPS
const arcRpcCandidates = (process.env.ARC_TESTNET_RPC_URL ?? '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: {
      http:
        arcRpcCandidates.length > 0
          ? arcRpcCandidates
          : [
            'https://rpc.testnet.arc.network',
            'https://rpc.blockdaemon.testnet.arc.network',
            'https://rpc.drpc.testnet.arc.network',
            'https://rpc.quicknode.testnet.arc.network',
          ],
    },
  },
  blockExplorers: {
    default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
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

  megaethTestnet: {
    chain: megaethTestnet,
    gasSettings: {
      gasPrice: 10_000_000n,
    },
    deploymentConfig: {
      confirmations: 1,
      retryAttempts: 3,
      retryDelay: 1000,
    },
    faucetEnabled: true,
  },

  monadTestnet: {
    chain: monadTestnet,
    gasSettings: {
      // Monad has repriced opcodes: cold access 4x more expensive
      // See: https://docs.monad.xyz/developer-essentials/opcode-pricing
      // Large contracts like SoothBook and LaunchpadEngine need 8M+
      gasLimit: 10_000_000n, // 10M gas for complex contract deployments
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

  arcTestnet: {
    chain: arcTestnet,
    gasSettings: {
      // Arc has stable fee design: minFeePerGas >= 160 Gwei required
      // See: https://docs.arc.network/arc/references/gas-and-fees
      maxFeePerGas: 180_000_000_000n, // 180 gwei (above 160 min)
      maxPriorityFeePerGas: 1_000_000_000n, // 1 gwei priority
    },
    deploymentConfig: {
      confirmations: 1,
      retryAttempts: 3,
      retryDelay: 2000,
    },
    faucetEnabled: true, // Circle faucet: https://faucet.circle.com
    // Note: Arc has native USDC at 0x3600000000000000000000000000000000000000
  },
};

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
  version: string;
  timestamp: string;
  deployer: string;
  contracts: {
    MockUSDC: string;
    Collateralizer: string;
    AMMEngine: string;
    SoothBook: string;
    LaunchpadEngine: string;
    ProtocolConfig?: string;
  };
  markets: {
    address: string;
    name: string;
    symbol: string;
    yesToken: string;
    noToken: string;
    isGraduated: boolean;
    soothBookKey?: string;
  }[];
}
