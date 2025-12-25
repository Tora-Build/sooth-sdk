import { defineChain } from 'viem';
import { Chain } from 'wagmi/chains';

// Chain type for hybrid support
export type ChainType = 'evm' | 'solana';

export interface AllowedChain {
  id: number | string;
  type: ChainType;
  name: string; // Real network name (for ChainSelector)
  displayName: string; // Branded name (for UI)
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  icon: string; // emoji or URL
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Define chains using viem
export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'Basescan', url: 'https://sepolia.basescan.org' },
  },
  /* 
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
    },
  },
  */
  testnet: true,
});

export const bnbTestnet = defineChain({
  id: 97,
  name: 'BNB Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://data-seed-prebsc-1-s1.bnbchain.org:8545'] },
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://testnet.bscscan.com' },
  },
  testnet: true,
});

// Define MegaETH Frontier using viem
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
  testnet: false, // It's "Mainnet" but Frontier phase
});

// Canonical list of allowed chains with metadata
export const allowedChains: AllowedChain[] = [
  {
    id: 84532,
    type: 'evm',
    name: 'Base Sepolia',
    displayName: 'Base',
    shortName: 'Base',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    icon: '🔵',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  // BNB Testnet - HIDDEN
  /*
  {
    id: 97,
    type: 'evm',
    name: 'BNB Testnet',
    displayName: 'BNB',
    shortName: 'BNB',
    rpcUrl: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    explorerUrl: 'https://testnet.bscscan.com',
    icon: '🟡',
    nativeCurrency: {
      name: 'tBNB',
      symbol: 'tBNB',
      decimals: 18,
    },
  },
  */
  // MegaETH Frontier Net (Mainnet)
  {
    id: 4326,
    type: 'evm',
    name: 'MegaETH Frontier',
    displayName: 'MegaETH',
    shortName: 'Mega',
    rpcUrl: 'https://mainnet.megaeth.com/rpc',
    explorerUrl: 'https://explorer.megaeth.com',
    icon: '⚡',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  // Monad Testnet
  {
    id: 10143,
    type: 'evm',
    name: 'Monad Testnet',
    displayName: 'Monad',
    shortName: 'Monad',
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    explorerUrl: 'https://testnet.monadexplorer.com',
    icon: '🟣',
    nativeCurrency: {
      name: 'Monad',
      symbol: 'MON',
      decimals: 18,
    },
  },
  // MegaETH Testnet - HIDDEN (RPC rate limiting)
  // {
  //   id: 6343,
  //   type: 'evm',
  //   name: 'MegaETH Testnet',
  //   displayName: 'MegaETH',
  //   shortName: 'Mega',
  //   rpcUrl: 'https://timothy.megaeth.com/rpc',
  //   explorerUrl: 'https://megaeth-testnet-v2.blockscout.com',
  //   icon: '⚡',
  //   nativeCurrency: {
  //     name: 'Ether',
  //     symbol: 'ETH',
  //     decimals: 18,
  //   },
  // },
];

// Define MegaETH Testnet using viem
export const megaethTestnet = defineChain({
  id: 6343,
  name: 'MegaETH Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://timothy.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://megaeth-testnet-v2.blockscout.com' },
  },
  testnet: true,
});

// Define Monad Testnet using viem
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' },
  },
  testnet: true,
});

// EVM-only chains for wagmi
export const evmChains = allowedChains.filter(c => c.type === 'evm');

// Export wagmi chains array
export const wagmiChains: Chain[] = [baseSepolia, megaethFrontier, monadTestnet];

// Helper to get chain by ID
export function getChainById(chainId: number | string): AllowedChain | undefined {
  return allowedChains.find((c) => c.id === chainId);
}

// Helper to check chain type
export function isEvmChain(chain: AllowedChain): boolean {
  return chain.type === 'evm';
}

export function isSolanaChain(chain: AllowedChain): boolean {
  return chain.type === 'solana';
}

// Default chain (Base Sepolia)
export const DEFAULT_CHAIN_ID = 84532;
