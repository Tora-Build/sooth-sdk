import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { type AppKitNetwork } from '@reown/appkit/networks';
import { http } from 'viem';
import { defineChain } from 'viem';

export const projectId = '01ecc3f4925fa2e6a5f3f82b74487317';

const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'] } },
  blockExplorers: { default: { name: 'Basescan', url: 'https://sepolia.basescan.org' } },
  testnet: true,
});

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'Monad Vision', url: 'https://testnet.monadvision.com' } },
  testnet: true,
});

export const metadata = {
  name: 'sooth.market',
  description: 'Pro Trading Registry — Sooth Protocol',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://sooth.market',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  baseSepolia as unknown as AppKitNetwork,
  monadTestnet as unknown as AppKitNetwork,
];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org', {
      retryCount: 3,
      retryDelay: 3000,
      timeout: 30_000,
    }),
    [monadTestnet.id]: http(import.meta.env.VITE_MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz', {
      retryCount: 3,
      retryDelay: 5000,
      timeout: 30_000,
    }),
  },
});

export const config = wagmiAdapter.wagmiConfig;
