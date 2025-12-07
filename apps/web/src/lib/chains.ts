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

// Canonical list of allowed chains with metadata
export const allowedChains: AllowedChain[] = [
  {
    id: 84532,
    type: 'evm',
    name: 'Base Sepolia',
    displayName: 'Based',
    shortName: 'Based',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    icon: '🔵',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  // MegaETH Testnet
  {
    id: 6343,
    type: 'evm',
    name: 'MegaETH Testnet',
    displayName: 'Speed',
    shortName: 'Speed',
    rpcUrl: 'https://timothy.megaeth.com/rpc',
    explorerUrl: 'https://megaeth-testnet-v2.blockscout.com',
    icon: '⚡',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  // Solana Devnet
  {
    id: 'devnet',
    type: 'solana',
    name: 'Solana Devnet',
    displayName: 'Solana Devnet',
    shortName: 'Solana',
    rpcUrl: 'https://api.devnet.solana.com',
    explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
    icon: '🟣',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
    },
  },
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
export const wagmiChains: Chain[] = [baseSepolia];

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

