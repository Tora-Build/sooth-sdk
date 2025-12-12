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
    default: { http: ['https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: { name: 'Basescan', url: 'https://sepolia.basescan.org' },
  },
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
  // BNB Testnet
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

// EVM-only chains for wagmi
export const evmChains = allowedChains.filter(c => c.type === 'evm');

// Export wagmi chains array
export const wagmiChains: Chain[] = [baseSepolia, bnbTestnet];

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
