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

export const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  rpc: 'https://testnet-rpc.monad.xyz',
  explorer: 'https://testnet.monadvision.com',
  launchpad: '0x6fd82b76045af934354a2033fde5cb64772ae615',
};

export const SUPPORTED_CHAINS = [
  { id: 84532, name: 'Base Sepolia', color: 'blue' },
  { id: 10143, name: 'Monad Testnet', color: 'purple' },
];

export const CHAIN_ID = 84532;
export const EXPLORER_URL = 'https://sepolia.basescan.org';

export function getAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

export function getTxUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}
