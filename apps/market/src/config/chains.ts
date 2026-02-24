import { defineChain } from 'viem';

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
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 5882,
    },
  },
  testnet: true,
});

export const CHAIN_ID = 84532;
export const EXPLORER_URL = 'https://sepolia.basescan.org';

export function getAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

export function getTxUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}
